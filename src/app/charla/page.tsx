"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  END_STEP,
  QUESTIONS,
  QUESTION_ORDER,
  SESSION,
  openQuestions,
  stepAt,
  type Profile,
  type QuestionId,
} from "@/config/charla";
import { useCharlaStep } from "@/hooks/useCharla";
import { onForeground } from "@/lib/realtime";
import {
  fetchMe,
  getPid,
  isAnswered,
  registerProfile,
  safeStorage,
  saveAnswer,
  type CharlaAnswer,
  type CharlaError,
  type Mine,
} from "@/lib/charla";
import { BrandLogos, SERIF } from "@/components/charla/CharlaUI";
import PhoneDone from "@/components/charla/PhoneDone";
import PhoneForm, { EMPTY_PROFILE, parseProfile } from "@/components/charla/PhoneForm";
import PhoneQuestion, { QuestionHeader } from "@/components/charla/PhoneQuestion";
import { BTN_PRIMARY } from "@/components/charla/PhoneUI";

// Lo que este celular recuerda (localStorage): si ya se registró, sus datos,
// la copia de sus respuestas y las preguntas opcionales que saltó.
const REG_KEY = `charla_reg_${SESSION}`;
const PROFILE_KEY = `charla_profile_${SESSION}`;
const MINE_KEY = `charla_mine_${SESSION}`;
const SKIP_KEY = `charla_skip_${SESSION}`;
const REACH_KEY = `charla_reach_${SESSION}`;

// Cada cuánto se reintenta leer la base cuando no hubo conexión.
const ME_RETRY_MS = 5000;

const isQuestionId = (x: unknown): x is QuestionId =>
  typeof x === "string" && QUESTION_ORDER.includes(x as QuestionId);

function readMine(): Mine {
  try {
    const raw = safeStorage.get(MINE_KEY);
    const v: unknown = raw ? JSON.parse(raw) : null;
    if (!v || typeof v !== "object" || Array.isArray(v)) return {};
    const out: Mine = {};
    for (const [q, a] of Object.entries(v as Record<string, unknown>)) {
      if (isQuestionId(q) && a && typeof a === "object") out[q] = a as CharlaAnswer;
    }
    return out;
  } catch {
    return {};
  }
}

function readSkipped(): QuestionId[] {
  try {
    const raw = safeStorage.get(SKIP_KEY);
    const v: unknown = raw ? JSON.parse(raw) : null;
    return Array.isArray(v) ? v.filter(isQuestionId) : [];
  } catch {
    return [];
  }
}

function Shell({ children, banner }: { children: React.ReactNode; banner?: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-1 flex-col bg-[#223C5D] text-white">
      <header className="mx-auto flex w-full max-w-md items-center px-5 pb-2 pt-5">
        <BrandLogos height={26} tone="blanco" />
      </header>
      {banner && <div className="mx-auto w-full max-w-md px-5">{banner}</div>}
      <div className="mx-auto w-full max-w-md flex-1 px-5 pb-[calc(env(safe-area-inset-bottom)_+_2.5rem)] pt-4">
        {children}
      </div>
    </main>
  );
}

const noopSubscribe = () => () => {};

// El celular lee el código de la persona y la copia local de sus datos y
// respuestas, que solo existen en el navegador: se monta después de hidratar.
export default function CharlaPhone() {
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  if (!mounted) {
    return (
      <Shell>
        <p className="mt-20 text-center text-[#DCE4FF]">Cargando…</p>
      </Shell>
    );
  }
  return <PhoneApp />;
}

// ?paso=N → vista previa: muestra lo que ve una persona ya registrada en el
// paso N, empezando sin respuestas, y NO guarda nada (ni en la base ni en el
// navegador). Con ?paso=N&registro=1 empieza sin registrar, para ver también el
// formulario. Sirve para ensayar y revisar pantallas sin tocar los datos.
function readPreview(): number | null {
  const p = new URLSearchParams(window.location.search).get("paso");
  if (p === null || !/^\d+$/.test(p)) return null;
  return Math.max(0, Math.min(END_STEP, parseInt(p, 10)));
}

function previewWithForm(): boolean {
  return new URLSearchParams(window.location.search).get("registro") === "1";
}

const toTop = () => window.scrollTo({ top: 0 });

function PhoneApp() {
  const remote = useCharlaStep(5000);
  const [preview, setPreview] = useState<number | null>(readPreview);
  const isPreview = preview !== null;
  // En vista previa no se crea el código de la persona (getPid lo guarda).
  const [pid] = useState(() => (isPreview ? "" : getPid()));
  // Primero lo que recuerda el celular… (en vista previa se empieza en blanco)
  const [registered, setRegistered] = useState(() =>
    isPreview ? !previewWithForm() : safeStorage.get(REG_KEY) === "1"
  );
  const [profile, setProfile] = useState<Profile>(() =>
    isPreview ? EMPTY_PROFILE : (parseProfile(safeStorage.get(PROFILE_KEY)) ?? EMPTY_PROFILE)
  );
  const [mine, setMine] = useState<Mine>(() => (isPreview ? {} : readMine()));
  const [skipped, setSkipped] = useState<QuestionId[]>(() => (isPreview ? [] : readSkipped()));
  // Hasta que la base responde la primera vez se confía en el celular, pero no
  // se deja guardar.
  const [meLoaded, setMeLoaded] = useState(isPreview);
  const [busy, setBusy] = useState(false);
  // El aviso de «no se pudo guardar» es de la pantalla donde falló el envío.
  const [saveErr, setSaveErr] = useState<{ at: QuestionId | "perfil"; error: CharlaError } | null>(
    null
  );
  // Desde «Sus respuestas»: la pregunta que se está cambiando o completando.
  const [editing, setEditing] = useState<QuestionId | null>(null);
  const [editProfile, setEditProfile] = useState(false);
  // El paso más alto que vio este celular: un momento que ya se abrió no se
  // cierra si la pantalla retrocede (un clic de más, o volver a una lámina en
  // las preguntas del final). Se olvida si la base se reinicia entre ensayos.
  const [reach, setReach] = useState(() =>
    isPreview ? 0 : Math.max(0, Math.min(END_STEP, Number(safeStorage.get(REACH_KEY)) || 0))
  );
  const state = isPreview
    ? { step: preview, updatedAt: null, loaded: true, error: null }
    : remote;

  // Reloj de esta visita: cada lectura de la base y cada guardado toman un
  // número. Lo guardado aquí (savedHere: pregunta → número; registeredHere) gana
  // sobre una lectura que salió antes; una que salió después ya lo trae, y ahí
  // manda la base.
  const clock = useRef(0);
  const savedHere = useRef<Map<QuestionId, number>>(new Map());
  const registeredHere = useRef(0);
  // Vuelve a leer la base (lo define el efecto de abajo).
  const resync = useRef<() => void>(() => {});
  const lastStep = useRef<number | null>(null);

  // …y luego la base, que manda: si se reinició (entre ensayos), aquí se borran
  // las respuestas y el registro, y vuelve el formulario relleno con los datos
  // guardados. Sin conexión se conserva lo local y se reintenta: al rato, al
  // volver a primer plano y cuando la pantalla retrocede.
  useEffect(() => {
    if (isPreview) return;
    let alive = true;
    let inflight = false;
    let again = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    // force: si ya hay una lectura en camino, se hace otra al terminar (esa
    // pudo salir antes de lo que se quiere comprobar).
    const load = async (force = false) => {
      if (inflight) {
        if (force) again = true;
        return;
      }
      inflight = true;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      const started = ++clock.current;
      const res = await fetchMe(pid);
      inflight = false;
      if (!alive) return;

      if (res.error) {
        timer = setTimeout(() => void load(), ME_RETRY_MS);
      } else {
        const keep = Array.from(savedHere.current)
          .filter(([, at]) => at > started)
          .map(([q]) => q);
        const isReg = res.registered || registeredHere.current > started;
        // El celular tenía respuestas y la base no trae ninguna: se reinició.
        const wiped =
          Object.keys(res.answers).length === 0 &&
          keep.length === 0 &&
          Object.keys(readMine()).length > 0;
        setRegistered(isReg);
        if (isReg) safeStorage.set(REG_KEY, "1");
        else safeStorage.remove(REG_KEY);
        setMine((prev) => {
          const next: Mine = { ...res.answers };
          for (const q of keep) next[q] = prev[q];
          safeStorage.set(MINE_KEY, JSON.stringify(next));
          return next;
        });
        // Empezar de cero incluye olvidar las preguntas que saltó.
        if (!isReg || wiped) {
          setSkipped([]);
          safeStorage.remove(SKIP_KEY);
          setReach(0);
          safeStorage.remove(REACH_KEY);
        }
        if (!isReg) {
          setEditing(null);
          setEditProfile(false);
          setSaveErr(null);
        }
      }
      // Con o sin conexión, la persona ya puede intentar guardar.
      setMeLoaded(true);

      if (again) {
        again = false;
        void load();
      }
    };

    resync.current = () => void load(true);
    void load();
    const stop = onForeground(() => void load());
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      stop();
      resync.current = () => {};
    };
  }, [pid, isPreview]);

  // La pantalla retrocedió: puede ser un ensayo que vuelve a empezar.
  useEffect(() => {
    const s = remote.step;
    if (s === null) return;
    if (lastStep.current !== null && s < lastStep.current) resync.current();
    lastStep.current = s;
    if (!isPreview && s > (Number(safeStorage.get(REACH_KEY)) || 0)) {
      safeStorage.set(REACH_KEY, String(s));
    }
  }, [remote.step, isPreview]);

  const register = async (p: Profile): Promise<boolean> => {
    if (!isPreview) {
      setBusy(true);
      setSaveErr(null);
      const error = await registerProfile(pid, p);
      setBusy(false);
      if (error) {
        setSaveErr({ at: "perfil", error });
        return false;
      }
      registeredHere.current = ++clock.current;
      safeStorage.set(PROFILE_KEY, JSON.stringify(p));
      safeStorage.set(REG_KEY, "1");
    }
    setProfile(p);
    setRegistered(true);
    setEditProfile(false);
    toTop();
    return true;
  };

  const save = async (qid: QuestionId, answer: CharlaAnswer): Promise<boolean> => {
    if (!isPreview) {
      setBusy(true);
      setSaveErr(null);
      const error = await saveAnswer(pid, qid, answer);
      setBusy(false);
      if (error) {
        setSaveErr({ at: qid, error });
        // La base ya no conoce a esta persona (se reinició): se vuelve a leer y
        // aparece el formulario.
        if (/sin registrar/i.test(error.detail ?? "")) resync.current();
        return false;
      }
      savedHere.current.set(qid, ++clock.current);
    }
    setMine((prev) => {
      const next = { ...prev, [qid]: answer };
      if (!isPreview) safeStorage.set(MINE_KEY, JSON.stringify(next));
      return next;
    });
    // Si la había saltado, ya no cuenta como saltada.
    setSkipped((prev) => {
      if (!prev.includes(qid)) return prev;
      const next = prev.filter((x) => x !== qid);
      if (!isPreview) safeStorage.set(SKIP_KEY, JSON.stringify(next));
      return next;
    });
    toTop();
    return true;
  };

  // «Saltar» (solo preguntas opcionales): no se vuelve a preguntar, pero queda
  // en «Sus respuestas» como «Sin responder».
  const skip = (qid: QuestionId) => {
    setSaveErr(null);
    setSkipped((prev) => {
      if (prev.includes(qid)) return prev;
      const next = [...prev, qid];
      if (!isPreview) safeStorage.set(SKIP_KEY, JSON.stringify(next));
      return next;
    });
    toTop();
  };

  // --- Cargando / sin conexión ---
  if (!state.loaded && !state.error) {
    return (
      <Shell>
        <p className="mt-20 text-center text-[#DCE4FF]">Cargando…</p>
      </Shell>
    );
  }

  if (!state.loaded && state.error) {
    const missing = state.error.kind === "missing";
    return (
      <Shell>
        <div className="mt-10 space-y-5">
          <h1 className="text-[30px] leading-tight" style={SERIF}>
            {missing ? "La sesión todavía no está abierta" : "No pudimos conectarnos"}
          </h1>
          <p className="text-[#DCE4FF]">
            {missing
              ? "Vuelva a escanear el código cuando empiece la charla."
              : "Revise su conexión a internet. Seguimos intentando."}
          </p>
          <button type="button" onClick={() => window.location.reload()} className={BTN_PRIMARY}>
            Reintentar
          </button>
          <p className="text-xs text-white/50">
            {state.error.message} {state.error.detail}
          </p>
        </div>
      </Shell>
    );
  }

  const step = state.step ?? 0;
  const ended = step >= END_STEP;
  const current = stepAt(step);
  if (!isPreview && step > reach) setReach(step);
  const openStep = isPreview ? step : Math.max(step, reach);
  const open = openQuestions(openStep);
  // La primera pregunta abierta que no respondió ni saltó.
  const pendingId =
    open.find((id) => !isAnswered(QUESTIONS[id], mine[id]) && !skipped.includes(id)) ?? null;

  const movePreview = (d: number) => {
    setPreview((p) => Math.max(0, Math.min(END_STEP, (p ?? 0) + d)));
    setEditing(null);
    setEditProfile(false);
    toTop();
  };

  const banner = isPreview ? (
    <div className="flex items-center gap-2 rounded-lg bg-[#fde047] px-3 py-1.5 text-xs font-semibold text-[#3a2c00]">
      <button type="button" onClick={() => movePreview(-1)} className="px-2 text-base" aria-label="Paso anterior">
        ‹
      </button>
      <span className="flex-1 text-center">
        Vista previa · {current ? `${current.id} ${current.label}` : ended ? "fin" : "antes"} · no se guarda nada
      </span>
      <button type="button" onClick={() => movePreview(1)} className="px-2 text-base" aria-label="Paso siguiente">
        ›
      </button>
    </div>
  ) : state.error ? (
    <p className="rounded-lg bg-[#fde047] px-3 py-1.5 text-center text-xs font-semibold text-[#3a2c00]">
      Sin conexión con la sesión. Reintentando…
    </p>
  ) : null;

  // --- Registro (primero siempre, también si llega tarde) y «Corregir mis datos» ---
  if (!registered || editProfile) {
    const fixing = registered;
    // Con datos guardados y sin registro: la base se reinició.
    const note = fixing
      ? null
      : profile.nombre
        ? "Confirme sus datos para continuar."
        : ended
          ? "La charla ya terminó, pero todavía puede dejar sus respuestas."
          : step >= 1
            ? "La charla ya empezó: unirse toma un minuto."
            : null;
    return (
      <Shell banner={banner}>
        <PhoneForm
          key={fixing ? "corregir" : "registro"}
          mode={fixing ? "corregir" : "registro"}
          initial={profile}
          note={note}
          persist={!isPreview}
          busy={busy}
          ready={meLoaded}
          error={saveErr?.at === "perfil" ? saveErr.error : null}
          onSubmit={register}
          onCancel={
            fixing
              ? () => {
                  setEditProfile(false);
                  setSaveErr(null);
                  toTop();
                }
              : undefined
          }
        />
      </Shell>
    );
  }

  // --- Cambiar o completar una respuesta (desde «Sus respuestas») ---
  if (editing && open.includes(editing)) {
    const q = QUESTIONS[editing];
    return (
      <Shell banner={banner}>
        <QuestionHeader q={q} />
        <PhoneQuestion
          key={`cambiar-${q.id}`}
          q={q}
          saved={mine[q.id]}
          busy={busy}
          ready={meLoaded}
          error={saveErr?.at === q.id ? saveErr.error : null}
          persist={!isPreview}
          onSave={async (answer) => {
            const ok = await save(q.id, answer);
            if (ok) setEditing(null);
            return ok;
          }}
          onCancel={() => {
            setEditing(null);
            setSaveErr(null);
            toTop();
          }}
        />
      </Shell>
    );
  }

  // --- Preguntas pendientes: una a la vez ---
  if (pendingId) {
    const q = QUESTIONS[pendingId];
    return (
      <Shell banner={banner}>
        {ended && (
          <p className="mb-5 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-bold text-white">
            La charla ya terminó, pero todavía puede dejar sus respuestas.
          </p>
        )}
        <QuestionHeader q={q} intro />
        <PhoneQuestion
          key={q.id}
          q={q}
          saved={mine[q.id]}
          busy={busy}
          ready={meLoaded}
          error={saveErr?.at === q.id ? saveErr.error : null}
          persist={!isPreview}
          onSave={(answer) => save(q.id, answer)}
          onSkip={q.required ? undefined : () => skip(q.id)}
        />
      </Shell>
    );
  }

  // --- Nada pendiente: mire la pantalla (o gracias) + sus respuestas ---
  return (
    <Shell banner={banner}>
      <PhoneDone
        step={step}
        openStep={openStep}
        mine={mine}
        onEdit={(id) => {
          setSaveErr(null);
          setEditing(id);
          toTop();
        }}
        onEditProfile={() => {
          setSaveErr(null);
          setEditProfile(true);
          toTop();
        }}
      />
    </Shell>
  );
}
