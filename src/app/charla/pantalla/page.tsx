"use client";

import { useEffect, useLayoutEffect, useState, useSyncExternalStore } from "react";
import {
  C,
  CHARLA_SHORT_URL,
  END_STEP,
  LOGOS,
  MOMENTS,
  PRE_STEP,
  QR,
  RESULTS_SHORT_URL,
  SESSION,
  STEPS,
  TALK_TITLE,
  stepAt,
  type MomentId,
  type QuestionId,
  type Step,
} from "@/config/charla";
import { useCharlaResults, useCharlaStep, type CharlaResultsState } from "@/hooks/useCharla";
import { useDeck, type DeckMode, type DeckSync } from "@/hooks/useDeck";
import { demoResults } from "@/lib/charla-demo";
import { BrandLogos, Kicker, SERIF } from "@/components/charla/CharlaUI";
import { LAMINA_H, LAMINA_W, Lamina, isDark, qrBox } from "@/components/charla/Lamina";
import { TvResultados } from "@/components/charla/TvResultados";

// Pantalla de la charla (proyector 16:9). Lienzo fijo de 1920x1080 que se
// escala para caber SIN scroll en cualquier pantalla.
//
// Modos (ver src/hooks/useDeck.ts):
//   ?k=CLAVE   → controla la sesión; la clave es la misma del stand y se guarda
//                en este navegador. ?k=off la borra.
//   sin clave  → solo sigue el paso de la sesión.
//   ?paso=N    → vista previa local del paso N (no mueve a la sala).
//   ?paso=N&demo=1 → vista previa con respuestas de EJEMPLO (para ensayar).
// Teclado (clicker): → PageDown Espacio Enter = siguiente · ← PageUp Retroceso =
// anterior · f = pantalla completa.

const KEY_STORAGE = "stand_key"; // misma clave (STAND_SECRET) que /stand/pantalla

// Pregunta cuyo número de respuestas se cuenta en la lámina de cada participación.
const COUNT_QUESTION: Record<MomentId, QuestionId> = { 1: "PREP", 2: "PASANTIAS", 3: "CAPACIDADES" };

// ---------------------------------------------------------------------------
// Lienzo escalado
// ---------------------------------------------------------------------------
function Stage({ children }: { children: React.ReactNode }) {
  const [scale, setScale] = useState(0); // 0 = aún sin medir
  useLayoutEffect(() => {
    const fit = () =>
      setScale(Math.max(0.05, Math.min(window.innerWidth / LAMINA_W, window.innerHeight / LAMINA_H)));
    fit();
    window.addEventListener("resize", fit);
    document.addEventListener("visibilitychange", fit);
    document.addEventListener("fullscreenchange", fit);
    return () => {
      window.removeEventListener("resize", fit);
      document.removeEventListener("visibilitychange", fit);
      document.removeEventListener("fullscreenchange", fit);
    };
  }, []);
  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-hidden bg-[#152a45]">
      <div
        style={{
          position: "relative",
          width: LAMINA_W,
          height: LAMINA_H,
          flex: "none",
          transform: `scale(${scale || 1})`,
          visibility: scale ? "visible" : "hidden",
        }}
      >
        {children}
      </div>
    </div>
  );
}

const people = (n: number) => (n === 1 ? "1 persona" : `${n} personas`);

// Respuestas de ejemplo (solo en vista previa con &demo=1).
const DEMO: CharlaResultsState = { ...demoResults(), loaded: true, error: null };

// ---------------------------------------------------------------------------
// Pantallas
// ---------------------------------------------------------------------------

// Lámina de participación: la del .pptx, con el QR en su cuadro blanco y el
// conteo en vivo abajo a la derecha.
function EscanearScreen({ s, res }: { s: Step; res: CharlaResultsState }) {
  const n = s.lamina ?? 0;
  const box = qrBox(n);
  const dark = isDark(n);
  const moment = s.moment ?? 1;
  const answered = res.answered[COUNT_QUESTION[moment]] ?? 0;
  // El QR es cuadrado; si el cuadro es más alto que ancho, la dirección va debajo.
  const pad = 30;
  const side = box ? Math.min(box.w, box.h) - pad * 2 : 0;
  const room = box ? box.h - side - pad * 2 : 0;
  return (
    <Lamina
      n={n}
      qr={
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={QR.entrar} alt="" style={{ marginTop: pad, width: side, height: side }} />
          {room >= 28 && (
            <p
              style={{
                margin: 0,
                height: room,
                display: "flex",
                alignItems: "center",
                fontSize: 23,
                fontWeight: 800,
                color: C.navy,
              }}
            >
              {CHARLA_SHORT_URL}
            </p>
          )}
        </div>
      }
    >
      <div
        style={{
          position: "absolute",
          right: 128,
          bottom: 52,
          display: "flex",
          alignItems: "baseline",
          gap: 16,
          color: dark ? C.cream : C.navy,
        }}
      >
        <span style={{ ...SERIF, fontSize: 84, lineHeight: 1, color: C.orange }}>{answered}</span>
        <span style={{ fontSize: 26, lineHeight: 1.25 }}>
          <strong>{answered === 1 ? "respuesta" : "respuestas"}</strong>
          <br />
          <span style={{ color: dark ? C.ice : C.slate }}>{people(res.people)} en la sala</span>
        </span>
      </div>
    </Lamina>
  );
}

function QrCard({ src, size, title, sub }: { src: string; size: number; title: string; sub: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
      <div style={{ borderRadius: 28, background: C.white, padding: 22 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" width={size} height={size} style={{ display: "block", width: size, height: size }} />
      </div>
      <p style={{ margin: "22px 0 0", fontSize: 32, fontWeight: 800, color: C.cream }}>{title}</p>
      <p style={{ margin: "4px 0 0", fontSize: 24, color: C.ice }}>{sub}</p>
    </div>
  );
}

const DARK_BG = `linear-gradient(160deg, ${C.navy2} 0%, ${C.navy} 70%)`;

function PreScreen({ res }: { res: CharlaResultsState }) {
  return (
    <div
      style={{
        width: LAMINA_W,
        height: LAMINA_H,
        background: DARK_BG,
        padding: "128px",
        display: "flex",
        alignItems: "center",
        gap: 96,
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <BrandLogos height={96} />
        <h1 style={{ ...SERIF, margin: "64px 0 0", fontSize: 104, lineHeight: 1.08, color: C.cream }}>{TALK_TITLE}</h1>
        <p style={{ margin: "40px 0 0", fontSize: 38, lineHeight: 1.35, color: C.ice }}>
          Esta charla se responde desde el celular.
          <br />
          Escanee el código: es anónimo y toma un minuto.
        </p>
        {res.people > 0 && (
          <p style={{ margin: "36px 0 0", fontSize: 30, fontWeight: 700, color: C.cream }}>
            {people(res.people)} ya {res.people === 1 ? "respondió" : "respondieron"}
          </p>
        )}
      </div>
      <QrCard src={QR.entrar} size={430} title="Entre desde su celular" sub={CHARLA_SHORT_URL} />
    </div>
  );
}

function EndScreen({ res }: { res: CharlaResultsState }) {
  return (
    <div
      style={{
        width: LAMINA_W,
        height: LAMINA_H,
        background: DARK_BG,
        padding: "112px 128px",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Kicker style={{ margin: 0, fontSize: 28, color: C.ice }}>{TALK_TITLE}</Kicker>
      <h1 style={{ ...SERIF, margin: "20px 0 0", fontSize: 96, lineHeight: 1.08, color: C.cream }}>
        Gracias por participar
      </h1>
      <p style={{ margin: "24px 0 0", fontSize: 34, lineHeight: 1.35, color: C.ice }}>
        Sus respuestas alimentan InnKind Intelligence. Si pidió los resultados al final, se los enviaremos.
        {res.people > 0 ? ` Hoy ${res.people === 1 ? "participó" : "participaron"} ${people(res.people)}.` : ""}
      </p>
      <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 120 }}>
          <QrCard src={QR.entrar} size={300} title="Complete sus respuestas" sub={CHARLA_SHORT_URL} />
          <QrCard src={QR.resultados} size={300} title="Lo que dijo la sala" sub={RESULTS_SHORT_URL} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 44 }}>
          <BrandLogos height={84} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGOS.central.src} alt={LOGOS.central.alt} style={{ height: 96, width: "auto" }} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Estado del control (píldora arriba a la derecha)
// ---------------------------------------------------------------------------
function statusOf(mode: DeckMode, sync: DeckSync, remoteError: boolean, remoteLoaded: boolean) {
  const WARN = "#fde047";
  const BAD = "#f87171";
  const OK = "#4ade80";
  if (mode.kind === "preview") return { color: WARN, text: "Vista previa: no mueve a la sala", calm: true };
  if (mode.kind === "control") {
    // Sin haber leído la sesión nunca, la pantalla no empuja el paso.
    if (!remoteLoaded && remoteError)
      return { color: WARN, text: "Sin leer la sesión: solo se mueve esta pantalla", calm: false };
    switch (sync) {
      case "bad-key":
        return { color: BAD, text: "Clave incorrecta: los celulares no siguen esta pantalla", calm: false };
      case "no-secret":
        return { color: BAD, text: "El servidor no tiene STAND_SECRET: los celulares no siguen", calm: false };
      case "no-service-role":
        return { color: BAD, text: "Falta SUPABASE_SERVICE_ROLE en el servidor", calm: false };
      case "retrying":
        return { color: WARN, text: "Sin conexión: reintentando", calm: false };
      case "sending":
      case "checking":
        return { color: WARN, text: "Sincronizando…", calm: true };
      default:
        return remoteError
          ? { color: WARN, text: "Control · sin lectura de la sesión", calm: false }
          : { color: OK, text: "Control", calm: true };
    }
  }
  return remoteError
    ? { color: BAD, text: "Sin conexión con la sesión", calm: false }
    : { color: OK, text: "En vivo", calm: true };
}

// Se muestra unos segundos al cambiar de paso (se vuelve a montar con key) o al
// mover el ratón, y se queda fija (`pinned`) si algo anda mal. Quien solo sigue
// la sesión no la ve, salvo que haya un problema.
function StatusPill({
  pinned,
  color,
  text,
  label,
  go,
}: {
  pinned: boolean;
  color: string;
  text: string;
  label: string;
  go: ((delta: number) => void) | null;
}) {
  const [awake, setAwake] = useState(true);
  useEffect(() => {
    let t = setTimeout(() => setAwake(false), 3000);
    const wake = () => {
      setAwake(true);
      clearTimeout(t);
      t = setTimeout(() => setAwake(false), 3000);
    };
    window.addEventListener("mousemove", wake);
    return () => {
      clearTimeout(t);
      window.removeEventListener("mousemove", wake);
    };
  }, []);
  const show = pinned || (!!go && awake);
  return (
    <div
      style={{
        position: "absolute",
        top: 18,
        right: 22,
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: go ? "8px 10px 8px 18px" : "10px 18px",
        borderRadius: 999,
        background: "rgba(21,42,69,0.82)",
        color: "#ffffff",
        fontSize: 19,
        opacity: show ? 0.92 : 0,
        transition: "opacity 400ms",
        pointerEvents: go ? "auto" : "none",
      }}
    >
      <span style={{ display: "inline-block", width: 12, height: 12, borderRadius: 999, background: color }} />
      <span>{text}</span>
      <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{label}</span>
      {go && (
        <span style={{ display: "flex", gap: 6 }}>
          {[-1, 1].map((d) => (
            <button
              key={d}
              type="button"
              tabIndex={-1}
              aria-label={d < 0 ? "Anterior" : "Siguiente"}
              onClick={(e) => {
                e.currentTarget.blur();
                go(d);
              }}
              style={{
                width: 46,
                height: 38,
                borderRadius: 999,
                border: 0,
                background: "rgba(255,255,255,0.14)",
                color: "#ffffff",
                fontSize: 22,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {d < 0 ? "‹" : "›"}
            </button>
          ))}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------
const noopSubscribe = () => () => {};

// El modo depende de la URL y del localStorage: se monta después de hidratar.
export default function Pantalla() {
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  if (!mounted) {
    return (
      <Stage>
        <div style={{ width: "100%", height: "100%", background: C.navy }} />
      </Stage>
    );
  }
  return <Deck />;
}

function Deck() {
  const remote = useCharlaStep(3000);
  const { mode, step, sync, canNav, go } = useDeck({
    endpoint: "/api/charla/step",
    session: SESSION,
    min: PRE_STEP,
    max: END_STEP,
    keyStorage: KEY_STORAGE,
    remote,
  });

  const [demo] = useState(
    () => mode.kind === "preview" && new URLSearchParams(window.location.search).get("demo") === "1"
  );

  const current = stepAt(step);
  // Conteos en vivo: antes de empezar, al final y en las participaciones.
  const live = !current || current.kind !== "lamina";
  const fetched = useCharlaResults(live && !demo, 2000);
  const results = demo ? DEMO : fetched;

  const status = statusOf(mode, sync, !!remote.error, remote.loaded);
  const dbMissing =
    (mode.kind !== "preview" && remote.error?.kind === "missing") ||
    (live && results.error?.kind === "missing");

  let screen: React.ReactNode;
  if (!current) {
    screen = step >= END_STEP ? <EndScreen res={results} /> : <PreScreen res={results} />;
  } else if (current.kind === "escanear") {
    screen = <EscanearScreen s={current} res={results} />;
  } else if (current.kind === "resultados") {
    screen = <TvResultados moment={current.moment ?? 1} res={results} />;
  } else {
    screen = <Lamina n={current.lamina ?? 1} />;
  }

  const label =
    step <= PRE_STEP
      ? "Antes de empezar"
      : step >= END_STEP
        ? "Fin"
        : `${step} / ${STEPS.length}${current?.moment ? ` · ${MOMENTS[current.moment].kicker}` : ""}`;

  return (
    <Stage>
      <div key={`paso-${step}`} style={{ position: "absolute", inset: 0 }}>
        {screen}
      </div>
      <StatusPill
        key={`estado-${step}`}
        pinned={!status.calm || !!dbMissing || mode.kind === "preview"}
        color={status.color}
        text={
          dbMissing
            ? "Falta correr supabase/14-charla.sql en Supabase"
            : demo
              ? "Vista previa · respuestas de EJEMPLO"
              : status.text
        }
        label={label}
        go={canNav ? go : null}
      />
    </Stage>
  );
}
