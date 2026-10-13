"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { safeStorage } from "@/lib/stand";

// Control de una presentación guiada por la sesión (la misma lógica de
// /stand/pantalla, sacada a un hook para reutilizarla en otras charlas).
//
// Modos:
//   ?k=CLAVE   → controla la sesión (se guarda en localStorage). Cada cambio de
//                paso hace POST al `endpoint` (uno a la vez, con la versión que
//                vio: no pisa un paso más nuevo). ?k=off la borra.
//   sin clave  → solo sigue el paso de la sesión.
//   ?paso=N    → vista previa local del paso N (no toca la sesión).
// Teclado (clicker): → PageDown Espacio Enter = siguiente · ← PageUp Retroceso =
// anterior · f = pantalla completa.

export type DeckMode = { kind: "preview" | "control" | "follow"; key: string | null };
export type DeckSync =
  | "idle"
  | "checking"
  | "ok"
  | "sending"
  | "retrying"
  | "bad-key"
  | "no-secret"
  | "no-service-role";

export type DeckRemote = { step: number | null; updatedAt: string | null; loaded: boolean };

type PushReply = {
  code?: "bad-key" | "no-secret" | "no-service-role" | "conflict" | "bad-base" | string;
  step?: number;
  updated_at?: string | null;
};

const PUSH_TIMEOUT_MS = 7000; // tiempo máximo de cada envío del paso
const RETRY_MS = 2000;

const ts = (s: string | null | undefined) => {
  const n = s ? Date.parse(s) : NaN;
  return Number.isFinite(n) ? n : 0;
};

export type DeckOptions = {
  endpoint: string; // p. ej. "/api/charla/step"
  session: string;
  min: number; // paso «antes de empezar»
  max: number; // paso «fin»
  keyStorage: string; // nombre en localStorage de la clave
  remote: DeckRemote; // el paso guardado en la base (hook de tiempo real)
};

// Modo según la URL (?k=, ?paso=) y la clave guardada. Solo en el navegador.
function readInitialMode(o: Pick<DeckOptions, "keyStorage" | "min" | "max">): {
  mode: DeckMode;
  step: number;
} {
  const sp = new URLSearchParams(window.location.search);
  let key = safeStorage.get(o.keyStorage);
  if (sp.has("k")) {
    const k = (sp.get("k") ?? "").trim();
    key = !k || k === "off" ? null : k;
  }
  const paso = sp.get("paso");
  if (paso !== null && /^\d+$/.test(paso)) {
    return {
      mode: { kind: "preview", key: null },
      step: Math.max(o.min, Math.min(o.max, parseInt(paso, 10))),
    };
  }
  return {
    mode: key ? { kind: "control", key } : { kind: "follow", key: null },
    step: o.min,
  };
}

export function useDeck(o: DeckOptions): {
  mode: DeckMode;
  step: number;
  sync: DeckSync;
  canNav: boolean;
  go: (delta: number) => void;
} {
  const { endpoint, session, min, max, keyStorage, remote } = o;
  const [init] = useState(() => readInitialMode({ keyStorage, min, max }));
  const mode = init.mode;
  const [step, setStep] = useState(init.step);
  const [sync, setSync] = useState<DeckSync>(mode.kind === "control" ? "checking" : "idle");

  const clamp = useCallback((n: number) => Math.max(min, Math.min(max, n)), [min, max]);

  const stepRef = useRef(step);
  const remoteRef = useRef<DeckRemote>({ step: null, updatedAt: null, loaded: false });
  // Envío del paso (modo control): UN solo POST a la vez y siempre el último
  // paso pedido. Cada envío lleva la versión (updated_at) que vio la pantalla;
  // si otro controlador movió la sesión después, el servidor responde 409.
  const pendingRef = useRef<number | null>(null); // paso que falta confirmar
  const requestRef = useRef(false); // hay un POST en vuelo
  const drainingRef = useRef(false); // el ciclo de envío está activo
  const wakeRef = useRef<(() => void) | null>(null); // corta la espera del reintento
  const baseRef = useRef<string | null>(null); // último updated_at conocido (tal cual)
  const brokenRef = useRef(false);
  const lastPushAtRef = useRef(0);
  const aliveRef = useRef(true);

  useEffect(() => {
    stepRef.current = step;
    remoteRef.current = { step: remote.step, updatedAt: remote.updatedAt, loaded: remote.loaded };
  });

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      wakeRef.current?.();
    };
  }, []);

  // Guarda (o borra) la clave de ?k= y la quita de la barra de direcciones;
  // en modo control, verifica la clave con el servidor.
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    if (sp.has("k")) {
      const k = (sp.get("k") ?? "").trim();
      if (!k || k === "off") safeStorage.remove(keyStorage);
      else safeStorage.set(keyStorage, k);
      sp.delete("k");
      const qs = sp.toString();
      window.history.replaceState(null, "", window.location.pathname + (qs ? `?${qs}` : ""));
    }
    const key = mode.kind === "control" ? mode.key : null;
    if (!key) return;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), PUSH_TIMEOUT_MS);
    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ k: key, validate: true }),
      signal: ctrl.signal,
    })
      .then(async (r) => {
        const j = (await r.json().catch(() => ({}))) as { code?: string; serviceRole?: boolean };
        if (r.ok) setSync(j.serviceRole === false ? "no-service-role" : "ok");
        else if (j.code === "bad-key") setSync("bad-key");
        else if (j.code === "no-secret") setSync("no-secret");
        else setSync("ok");
      })
      .catch(() => setSync("ok"))
      .finally(() => clearTimeout(timer));
  }, [mode, endpoint, keyStorage]);

  // Seguir el paso de la sesión (salvo vista previa).
  useEffect(() => {
    if (mode.kind === "preview") return;
    if (remote.step === null) return;
    const target = clamp(remote.step);
    if (mode.kind === "control") {
      if (brokenRef.current) return;
      const at = ts(remote.updatedAt);
      if (pendingRef.current !== null) {
        // Otro controlador movió la sesión después del último estado que vio
        // esta pantalla: gana lo guardado y se descarta lo pendiente. (Si hay
        // un envío en vuelo, lo resuelve su respuesta: 409.)
        if (!requestRef.current && at > ts(baseRef.current)) {
          pendingRef.current = null;
          wakeRef.current?.();
          baseRef.current = remote.updatedAt;
          lastPushAtRef.current = at;
          setSync("ok");
          setStep(target);
        }
        return;
      }
      if (lastPushAtRef.current && at && at < lastPushAtRef.current) return;
      if (at >= ts(baseRef.current)) baseRef.current = remote.updatedAt;
    }
    setStep(target);
  }, [remote.step, remote.updatedAt, mode, clamp]);

  // Manda el paso pendiente: uno a la vez, con tiempo máximo, y al terminar
  // manda el último si hubo más clics. Reintenta cada 2 s si no hay red.
  const drain = useCallback(
    async (key: string) => {
      if (drainingRef.current) return;
      drainingRef.current = true;
      try {
        while (aliveRef.current && pendingRef.current !== null) {
          const target = pendingRef.current;
          setSync("sending");
          const ctrl = new AbortController();
          const timer = setTimeout(() => ctrl.abort(), PUSH_TIMEOUT_MS);
          let status = 0;
          let j: PushReply = {};
          requestRef.current = true;
          try {
            const r = await fetch(endpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                session,
                step: target,
                k: key,
                base_updated_at: baseRef.current,
              }),
              signal: ctrl.signal,
            });
            status = r.status;
            j = (await r.json().catch(() => ({}))) as PushReply;
          } catch {
            status = 0; // sin red o tiempo agotado
          } finally {
            clearTimeout(timer);
            requestRef.current = false;
          }
          if (!aliveRef.current) return;

          if (status >= 200 && status < 300) {
            if (typeof j.updated_at === "string") baseRef.current = j.updated_at;
            lastPushAtRef.current = ts(j.updated_at) || Date.now();
            brokenRef.current = false;
            if (pendingRef.current === target) pendingRef.current = null;
            continue; // si hubo otro clic mientras tanto, se manda el último
          }
          if (status === 409 && typeof j.step === "number") {
            if (typeof j.updated_at === "string") baseRef.current = j.updated_at;
            lastPushAtRef.current = ts(j.updated_at);
            if (j.step === target) {
              // Este paso ya estaba guardado (se había perdido la respuesta).
              if (pendingRef.current === target) pendingRef.current = null;
              continue;
            }
            // Otro controlador movió la sesión: gana lo guardado.
            pendingRef.current = null;
            setStep(clamp(j.step));
            break;
          }
          if (j.code === "bad-key" || j.code === "no-secret" || j.code === "no-service-role") {
            // No se arregla reintentando: la pantalla sigue funcionando sola.
            pendingRef.current = null;
            brokenRef.current = true;
            setSync(j.code as DeckSync);
            return;
          }
          if (status === 400) {
            if (j.code === "bad-base") {
              baseRef.current = null; // versión ilegible: se manda sin ella
              continue;
            }
            pendingRef.current = null; // no se arregla reintentando
            break;
          }
          // Sin red, tiempo agotado o error del servidor: espera 2 s (o menos si
          // llega otro clic) y reintenta con el último paso pedido.
          if (pendingRef.current === null) break;
          setSync("retrying");
          await new Promise<void>((resolve) => {
            const t = setTimeout(done, RETRY_MS);
            function done() {
              clearTimeout(t);
              wakeRef.current = null;
              resolve();
            }
            wakeRef.current = done;
          });
        }
        if (aliveRef.current && !brokenRef.current) {
          setSync("ok");
          // Si mientras se enviaba llegó un paso más nuevo de otro controlador, se sigue.
          const r = remoteRef.current;
          if (r.step !== null && ts(r.updatedAt) > ts(baseRef.current)) {
            baseRef.current = r.updatedAt;
            lastPushAtRef.current = ts(r.updatedAt);
            setStep(clamp(r.step));
          }
        }
      } finally {
        drainingRef.current = false;
      }
    },
    [endpoint, session, clamp]
  );

  const push = useCallback(
    (target: number, key: string) => {
      pendingRef.current = target;
      if (drainingRef.current) wakeRef.current?.(); // si esperaba para reintentar, manda ya
      else void drain(key);
    },
    [drain]
  );

  const go = useCallback(
    (delta: number) => {
      if (mode.kind === "follow") return;
      const next = clamp(stepRef.current + delta);
      if (next === stepRef.current) return;
      stepRef.current = next; // dos clics seguidos antes de volver a pintar
      setStep(next);
      if (mode.kind !== "control" || !mode.key) return;
      // Si la pantalla todavía no ha leído la sesión (se recargó sin red, o falta
      // el SQL), solo se mueve ella: empujar desde el paso 0 haría saltar a toda
      // la sala. Cuando lea la sesión, vuelve al paso guardado.
      if (!remoteRef.current.loaded) return;
      push(next, mode.key);
    },
    [mode, clamp, push]
  );

  // Teclado y clicker.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      // Tecla mantenida (autorrepetición): no avanza varios pasos de golpe.
      if (e.repeat) {
        e.preventDefault();
        return;
      }
      const k = e.key;
      if (k === "f" || k === "F") {
        e.preventDefault();
        if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
        else void document.documentElement.requestFullscreen().catch(() => {});
        return;
      }
      const isNext =
        k === "ArrowRight" || k === "PageDown" || k === " " || k === "Enter" || e.code === "Space";
      const isPrev = k === "ArrowLeft" || k === "PageUp" || k === "Backspace";
      if (!isNext && !isPrev) return;
      e.preventDefault();
      go(isNext ? 1 : -1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  return { mode, step, sync, canNav: mode.kind === "control" || mode.kind === "preview", go };
}
