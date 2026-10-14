"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  ANON_NOTE,
  END_STEP,
  FORM_INTRO,
  FORM_TITLE,
  MOMENT_OPENS_AT,
  PRIVACY_URL,
  QUESTIONS,
  QUESTION_ORDER,
  SESSION,
  openQuestions,
  stepAt,
  type Contact,
  type ContactOptionId,
  type QuestionId,
} from "@/config/charla";
import { useCharlaStep } from "@/hooks/useCharla";
import { onForeground } from "@/lib/realtime";
import {
  fetchMe,
  getPid,
  isAnswered,
  safeSession,
  safeStorage,
  saveAnswer,
  sendContact,
  type CharlaAnswer,
  type CharlaError,
  type Mine,
} from "@/lib/charla";
import { BrandLogos, SERIF } from "@/components/charla/CharlaUI";
import PhoneContact from "@/components/charla/PhoneContact";
import PhoneDone, { type ContactState } from "@/components/charla/PhoneDone";
import PhoneQuestion, { QuestionHeader } from "@/components/charla/PhoneQuestion";
import { BTN_PRIMARY } from "@/components/charla/PhoneUI";

// Lo que este celular recuerda (localStorage): si ya pasó la bienvenida, la
// copia de sus respuestas, las preguntas opcionales que saltó, hasta dónde
// llegó la pantalla y qué hizo con el contacto del final. Nada de esto lleva
// nombre ni correo: las respuestas son anónimas.
const WELCOME_KEY = `charla_inicio_${SESSION}`;
const MINE_KEY = `charla_mine_${SESSION}`;
const SKIP_KEY = `charla_skip_${SESSION}`;
const REACH_KEY = `charla_reach_${SESSION}`;
const CONTACT_KEY = `charla_contacto_${SESSION}`;

// La versión anterior pedía nombre, organización, cargo y correo y los
// guardaba en el celular: se borran al entrar.
const OLD_KEYS = [`charla_reg_${SESSION}`, `charla_profile_${SESSION}`];
const OLD_DRAFT_KEY = `charla_profile_draft_${SESSION}`;

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

function readContact(): ContactState {
  const v = safeStorage.get(CONTACT_KEY);
  return v === "enviado" || v === "no" ? v : null;
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

// El celular lee su código anónimo y la copia local de sus respuestas, que solo
// existen en el navegador: se monta después de hidratar.
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

// ?paso=N → vista previa: muestra lo que ve una persona en el paso N, empezando
// sin respuestas, y NO guarda nada (ni en la base ni en el navegador). Con
// ?paso=N&inicio=1 empieza en la bienvenida. Sirve para ensayar y revisar
// pantallas sin tocar los datos.
function readPreview(): number | null {
  const p = new URLSearchParams(window.location.search).get("paso");
  if (p === null || !/^\d+$/.test(p)) return null;
  return Math.max(0, Math.min(END_STEP, parseInt(p, 10)));
}

function previewWithWelcome(): boolean {
  return new URLSearchParams(window.location.search).get("inicio") === "1";
}

const toTop = () => window.scrollTo({ top: 0 });

function PhoneApp() {
  const remote = useCharlaStep(5000);
  const [preview, setPreview] = useState<number | null>(readPreview);
  const isPreview = preview !== null;
  // En vista previa no se crea el código del celular (getPid lo guarda).
  const [pid] = useState(() => (isPreview ? "" : getPid()));
  // Primero lo que recuerda el celular… (en vista previa se empieza en blanco)
  const [mine, setMine] = useState<Mine>(() => (isPreview ? {} : readMine()));
  const [welcomed, setWelcomed] = useState(() =>
    isPreview
      ? !previewWithWelcome()
      : safeStorage.get(WELCOME_KEY) === "1" || Object.keys(readMine()).length > 0
  );
  const [skipped, setSkipped] = useState<QuestionId[]>(() => (isPreview ? [] : readSkipped()));
  const [contact, setContact] = useState<ContactState>(() => (isPreview ? null : readContact()));
  // Hasta que la base responde la primera vez se confía en el celular, pero no
  // se deja guardar.
  const [meLoaded, setMeLoaded] = useState(isPreview);
  const [busy, setBusy] = useState(false);
  // El aviso de «no se pudo guardar» es de la pantalla donde falló el envío.
  const [saveErr, setSaveErr] = useState<{ at: QuestionId | "contacto"; error: CharlaError } | null>(
    null
  );
  // Desde «Sus respuestas»: la pregunta que se está cambiando o completando.
  const [editing, setEditing] = useState<QuestionId | null>(null);
  // Desde «Sus respuestas»: el contacto, si al final dijo que no.
  const [contactOpen, setContactOpen] = useState(false);
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
  // número. Lo guardado aquí (savedHere: pregunta → número) gana sobre una
  // lectura que salió antes; una que salió después ya lo trae, y ahí manda la
  // base.
  const clock = useRef(0);
  const savedHere = useRef<Map<QuestionId, number>>(new Map());
  // Vuelve a leer la base (lo define el efecto de abajo).
  const resync = useRef<() => void>(() => {});
  const lastStep = useRef<number | null>(null);

  // Datos personales que dejó en este celular la versión con registro.
  useEffect(() => {
    if (isPreview) return;
    for (const k of OLD_KEYS) safeStorage.remove(k);
    safeSession.remove(OLD_DRAFT_KEY);
  }, [isPreview]);

  // …y luego la base, que manda: si se reinició (entre ensayos), aquí se borran
  // las respuestas, las preguntas saltadas y lo hecho con el contacto. Sin
  // conexión se conserva lo local y se reintenta: al rato, al volver a primer
  // plano y cuando la pantalla retrocede.
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
        // El celular tenía respuestas y la base no trae ninguna: se reinició.
        const wiped =
          Object.keys(res.answers).length === 0 &&
          keep.length === 0 &&
          Object.keys(readMine()).length > 0;
        setMine((prev) => {
          const next: Mine = { ...res.answers };
          for (const q of keep) next[q] = prev[q];
          safeStorage.set(MINE_KEY, JSON.stringify(next));
          return next;
        });
        // Empezar de cero incluye olvidar las preguntas que saltó y el contacto
        // (el reinicio también borra los contactos).
        if (wiped) {
          setSkipped([]);
          safeStorage.remove(SKIP_KEY);
          setReach(0);
          safeStorage.remove(REACH_KEY);
          setContact(null);
          safeStorage.remove(CONTACT_KEY);
          setEditing(null);
          setContactOpen(false);
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

  const start = () => {
    if (!isPreview) safeStorage.set(WELCOME_KEY, "1");
    setWelcomed(true);
    toTop();
  };

  const save = async (qid: QuestionId, answer: CharlaAnswer): Promise<boolean> => {
    if (!isPreview) {
      setBusy(true);
      setSaveErr(null);
      const error = await saveAnswer(pid, qid, answer);
      setBusy(false);
      if (error) {
        setSaveErr({ at: qid, error });
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

  const decideContact = (v: Exclude<ContactState, null>) => {
    if (!isPreview) safeStorage.set(CONTACT_KEY, v);
    setContact(v);
    setContactOpen(false);
    setSaveErr(null);
    toTop();
  };

  // El contacto va sin el código del celular: no se puede unir con las respuestas.
  const submitContact = async (opciones: ContactOptionId[], c: Contact): Promise<boolean> => {
    if (!isPreview) {
      setBusy(true);
      setSaveErr(null);
      const error = await sendContact(opciones, c, true);
      setBusy(false);
      if (error) {
        setSaveErr({ at: "contacto", error });
        return false;
      }
    }
    decideContact("enviado");
    return true;
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
  // El contacto se ofrece solo una vez, al terminar las preguntas del último momento.
  const offerContact = !pendingId && openStep >= MOMENT_OPENS_AT[3] && contact === null;

  const movePreview = (d: number) => {
    setPreview((p) => Math.max(0, Math.min(END_STEP, (p ?? 0) + d)));
    setEditing(null);
    setContactOpen(false);
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

  // --- Bienvenida (una vez): de qué se trata y que es anónimo ---
  if (!welcomed) {
    const note = ended
      ? "La charla ya terminó, pero todavía puede dejar sus respuestas."
      : step >= 1
        ? "La charla ya empezó: unirse toma un minuto."
        : null;
    return (
      <Shell banner={banner}>
        <h1 className="text-[30px] leading-[1.15] text-white" style={SERIF}>
          {FORM_TITLE}
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-[#DCE4FF]">{FORM_INTRO}</p>
        <p className="mt-5 rounded-xl bg-white/10 px-4 py-3 text-[16px] font-bold leading-snug text-white">
          {ANON_NOTE}
        </p>
        {note && <p className="mt-4 text-sm font-bold text-white">{note}</p>}
        <button type="button" onClick={start} className={`mt-7 ${BTN_PRIMARY}`}>
          Empezar
        </button>
        <p className="mt-4 text-[13px] leading-relaxed text-[#DCE4FF]">
          <a
            href={PRIVACY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block py-1 font-bold text-white underline"
          >
            Aviso de privacidad
          </a>
        </p>
      </Shell>
    );
  }

  // --- Contacto opcional: al terminar, o desde «Sus respuestas» ---
  if (contactOpen || offerContact) {
    return (
      <Shell banner={banner}>
        <PhoneContact
          persist={!isPreview}
          busy={busy}
          error={saveErr?.at === "contacto" ? saveErr.error : null}
          onSend={submitContact}
          onDecline={() => {
            if (!contactOpen) return decideContact("no");
            setContactOpen(false);
            setSaveErr(null);
            toTop();
          }}
          declineLabel={contactOpen ? "Cancelar" : "No, gracias"}
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
        contact={contact}
        onEdit={(id) => {
          setSaveErr(null);
          setEditing(id);
          toTop();
        }}
        onContact={() => {
          setSaveErr(null);
          setContactOpen(true);
          toTop();
        }}
      />
    </Shell>
  );
}
