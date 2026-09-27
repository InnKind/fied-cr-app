"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  ACT_LABEL,
  ATENEA_GPT_URL,
  END_STEP,
  NUMBERED_QUESTIONS,
  R1,
  R2,
  SESSION,
  stepAt,
  type QuestionId,
} from "@/config/stand";
import { useStandStep } from "@/hooks/useStand";
import {
  fetchMyAnswers,
  getAnonId,
  safeStorage,
  saveAnswer,
  type StandAnswer,
  type StandError,
} from "@/lib/stand";
import { BrandMark } from "@/components/stand/StandUI";
import ThreeDoors from "@/components/stand/ThreeDoors";
import {
  DoneCard,
  QuestionStep,
  SingleQuestion,
  type Mine,
} from "@/components/stand/PhoneQuestions";

const MINE_KEY = `stand_mine_${SESSION}`;
const DOORS_DONE_KEY = `stand_doors_done_${SESSION}`;

function readMine(): Mine {
  try {
    const raw = safeStorage.get(MINE_KEY);
    const v = raw ? JSON.parse(raw) : null;
    return v && typeof v === "object" ? (v as Mine) : {};
  } catch {
    return {};
  }
}

function Shell({
  children,
  banner,
  bottom,
}: {
  children: React.ReactNode;
  banner?: React.ReactNode;
  bottom?: React.ReactNode;
}) {
  return (
    <main className="flex min-h-dvh flex-1 flex-col bg-[#223c5d] text-white">
      <header className="flex items-center justify-between gap-3 px-5 pb-2 pt-5">
        <BrandMark className="text-lg" />
        <span className="text-xs font-medium text-white/60">GET Forum 2026</span>
      </header>
      {banner}
      <div className={`mx-auto w-full max-w-md flex-1 px-5 pt-4 ${bottom ? "pb-32" : "pb-10"}`}>
        {children}
      </div>
      {bottom}
    </main>
  );
}

function TalkBar({ onClick }: { onClick: () => void }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-[#1a3050]/95 px-5 pb-[max(14px,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
      <button
        type="button"
        onClick={onClick}
        className="mx-auto block w-full max-w-md rounded-xl bg-white/10 px-4 py-3.5 text-[16px] font-semibold text-white ring-1 ring-white/50 active:bg-white/20"
      >
        Quiero hablar con ustedes
      </button>
    </div>
  );
}

function LinkButtons() {
  return (
    <div className="space-y-3">
      <a
        href={ATENEA_GPT_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full rounded-xl bg-[#c9283f] px-4 py-3.5 text-center font-semibold text-white shadow"
      >
        Pregúntale a Atenea (GPT) ↗
      </a>
      <a
        href="/stand/resultados"
        className="block w-full rounded-xl bg-white px-4 py-3.5 text-center font-semibold text-[#223c5d] shadow"
      >
        Ver lo que dijo la sala
      </a>
    </div>
  );
}

// Si no se guarda, la persona vuelve a tocar su respuesta (o "Enviar"): así se
// reintenta la acción completa de esa pantalla.
function ErrorBox({ error }: { error: StandError }) {
  return (
    <div className="rounded-xl bg-[#fff1f3] px-4 py-3 text-sm text-[#9f1239]">
      <p className="font-semibold">
        {error.kind === "missing"
          ? "No se pudo guardar: el modo stand todavía no está activado."
          : "No se pudo guardar tu respuesta. Revisa tu conexión y vuelve a tocarla para reintentar."}
      </p>
      {error.detail && <p className="mt-1 text-xs opacity-70">{error.detail}</p>}
    </div>
  );
}

const noopSubscribe = () => () => {};

// La app del celular lee el id anónimo y la copia local de sus respuestas, que
// solo existen en el navegador: se monta después de hidratar.
export default function StandPhone() {
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  if (!mounted) {
    return (
      <Shell>
        <p className="mt-20 text-center text-white/70">Cargando…</p>
      </Shell>
    );
  }
  return <PhoneApp />;
}

// ?paso=N → vista previa: muestra lo que ve una persona registrada en el paso N
// (el registro se ve en el paso 0 y en s03) y NO guarda nada: ni respuestas ni
// contactos. Sirve para ensayar y revisar pantallas sin tocar los datos.
function readPreview(): number | null {
  const p = new URLSearchParams(window.location.search).get("paso");
  if (p === null || !/^\d+$/.test(p)) return null;
  return Math.max(0, Math.min(END_STEP, parseInt(p, 10)));
}

function PhoneApp() {
  const remote = useStandStep(5000);
  const [preview, setPreview] = useState<number | null>(readPreview);
  const [anonId] = useState(getAnonId);
  // Primero la copia local… (en vista previa se empieza en blanco)
  const [mine, setMine] = useState<Mine>(() => (preview === null ? readMine() : {}));
  const [mineLoaded, setMineLoaded] = useState(preview !== null);
  const [view, setView] = useState<"session" | "doors">(() =>
    new URLSearchParams(window.location.search).get("puertas") === "1" ? "doors" : "session"
  );
  const [doorsDone, setDoorsDone] = useState(
    () => preview === null && safeStorage.get(DOORS_DONE_KEY) === "1"
  );
  const [busy, setBusy] = useState(false);
  const [saveErr, setSaveErr] = useState<StandError | null>(null);
  const isPreview = preview !== null;
  const state = isPreview
    ? { step: preview, updatedAt: null, loaded: true, error: null }
    : remote;

  // Preguntas guardadas en esta visita: ganan sobre una lectura de la base que
  // haya salido antes de guardarlas.
  const savedHere = useRef<Set<string>>(new Set());

  // …y luego la base (si la base se reinició, manda la base).
  useEffect(() => {
    if (isPreview) return;
    let alive = true;
    fetchMyAnswers(anonId).then(({ answers }) => {
      if (!alive) return;
      if (answers) {
        setMine((prev) => {
          const next: Mine = { ...answers };
          for (const q of savedHere.current) next[q] = prev[q];
          safeStorage.set(MINE_KEY, JSON.stringify(next));
          return next;
        });
      }
      setMineLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, [anonId, isPreview]);

  const save = useCallback(
    async (qid: QuestionId, answer: StandAnswer): Promise<boolean> => {
      if (isPreview) {
        setMine((prev) => ({ ...prev, [qid]: answer }));
        return true;
      }
      setBusy(true);
      setSaveErr(null);
      const error = await saveAnswer(anonId, qid, answer);
      setBusy(false);
      if (error) {
        setSaveErr(error);
        return false;
      }
      savedHere.current.add(qid);
      setMine((prev) => {
        const next = { ...prev, [qid]: answer };
        safeStorage.set(MINE_KEY, JSON.stringify(next));
        return next;
      });
      return true;
    },
    [anonId, isPreview]
  );

  const markDoorsDone = () => {
    setDoorsDone(true);
    if (!isPreview) safeStorage.set(DOORS_DONE_KEY, "1");
    window.scrollTo({ top: 0 });
  };
  const anotherDoor = () => {
    setDoorsDone(false);
    if (!isPreview) safeStorage.remove(DOORS_DONE_KEY);
    window.scrollTo({ top: 0 });
  };
  const openDoors = () => {
    setView("doors");
    window.scrollTo({ top: 0 });
  };

  // --- Cargando / sin conexión ---
  if (!state.loaded && !state.error) {
    return (
      <Shell>
        <p className="mt-20 text-center text-white/70">Cargando…</p>
      </Shell>
    );
  }

  if (!state.loaded && state.error) {
    return (
      <Shell>
        <div className="mt-10 space-y-5">
          <h1 className="text-2xl font-bold">
            {state.error.kind === "missing"
              ? "La sesión todavía no está abierta"
              : "No pudimos conectarnos"}
          </h1>
          <p className="text-white/80">
            {state.error.kind === "missing"
              ? "Vuelve a escanear el código cuando empiece la sesión."
              : "Revisa tu conexión a internet. Seguimos intentando."}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full rounded-xl bg-white px-4 py-3.5 font-semibold text-[#223c5d] shadow"
          >
            Reintentar
          </button>
          <a
            href={ATENEA_GPT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full rounded-xl px-4 py-3.5 text-center font-semibold text-white ring-1 ring-white/40"
          >
            Mientras tanto, pregúntale a Atenea (GPT) ↗
          </a>
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
  const registered =
    (!!mine.R1?.choice && !!mine.R2?.choice) ||
    (isPreview && step !== 0 && current?.kind !== "registro");

  const movePreview = (d: number) => {
    setPreview((p) => Math.max(0, Math.min(END_STEP, (p ?? 0) + d)));
    setView("session");
    window.scrollTo({ top: 0 });
  };

  const banner = isPreview ? (
    <div className="mx-5 flex items-center gap-2 rounded-lg bg-[#fde047] px-3 py-1.5 text-xs font-semibold text-[#3a2c00]">
      <button type="button" onClick={() => movePreview(-1)} className="px-2 text-base" aria-label="Paso anterior">
        ‹
      </button>
      <span className="flex-1 text-center">
        Vista previa · {current ? `${current.id} ${current.label}` : step >= END_STEP ? "fin" : "antes"} · no se guarda nada
      </span>
      <button type="button" onClick={() => movePreview(1)} className="px-2 text-base" aria-label="Paso siguiente">
        ›
      </button>
    </div>
  ) : state.error ? (
    <p className="mx-5 rounded-lg bg-[#fde047] px-3 py-1.5 text-center text-xs font-semibold text-[#3a2c00]">
      Sin conexión con la sesión. Reintentando…
    </p>
  ) : null;

  const errorBox = saveErr ? (
    <div className="mb-4">
      <ErrorBox error={saveErr} />
    </div>
  ) : null;

  // --- Tres puertas (botón permanente) ---
  if (view === "doors") {
    const pendingQuestion =
      current?.kind === "question" &&
      !!current.questionIds?.some((q) => !mine[q] && q !== "ABIERTA");
    return (
      <Shell banner={banner}>
        {pendingQuestion && (
          <button
            type="button"
            onClick={() => setView("session")}
            className="mb-5 w-full rounded-xl bg-[#fde047] px-4 py-3 text-left text-sm font-semibold text-[#3a2c00]"
          >
            Hay una pregunta abierta en la sesión. Responder →
          </button>
        )}
        <ThreeDoors
          preview={isPreview}
          done={doorsDone}
          onDone={markDoorsDone}
          onAnother={anotherDoor}
          onBack={() => {
            setView("session");
            window.scrollTo({ top: 0 });
          }}
        />
      </Shell>
    );
  }

  // --- La sesión terminó: Tres puertas + resultados + Atenea ---
  if (ended) {
    return (
      <Shell banner={banner}>
        <div className="space-y-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-white/60">
              Stand de SenecaLab e InnKind
            </p>
            <h1 className="mt-1 text-2xl font-bold">La sesión ya terminó</h1>
            <p className="mt-2 text-white/80">
              Mira lo que dijo la sala, pregúntale a Atenea o elige cómo seguir con nosotros.
            </p>
          </div>
          <LinkButtons />
          <div className="border-t border-white/15 pt-6">
            <ThreeDoors
              preview={isPreview}
              done={doorsDone}
              onDone={markDoorsDone}
              onAnother={anotherDoor}
            />
          </div>
        </div>
      </Shell>
    );
  }

  const talk = <TalkBar onClick={openDoors} />;

  // --- Registro (R1 y R2): primero siempre, también si llega tarde ---
  if (!registered) {
    const q = !mine.R1?.choice ? R1 : R2;
    return (
      <Shell banner={banner} bottom={talk}>
        {step === 0 ? (
          <div className="mb-6">
            <h1 className="text-2xl font-bold">Te damos la bienvenida</h1>
            <p className="mt-1 text-white/80">
              Son 2 toques. Tus respuestas son anónimas: no te pedimos tu nombre.
            </p>
          </div>
        ) : (
          <p className="mb-5 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold">
            La sesión ya empezó: son 2 toques y entras.
          </p>
        )}
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-white/60">
          {q.id === "R1" ? "1" : "2"} de 2
        </p>
        {errorBox}
        <SingleQuestion
          q={q}
          value={mine[q.id]?.choice}
          busy={busy || !mineLoaded}
          onPick={(id) => void save(q.id, { choice: id })}
        />
      </Shell>
    );
  }

  // --- Antes de empezar ---
  if (step === 0 || !current) {
    return (
      <Shell banner={banner} bottom={talk}>
        <div className="space-y-6">
          <DoneCard
            title="Ya estás dentro"
            lines={[]}
            extra={
              <p className="mt-2 text-[15px] text-slate-600">
                La sesión todavía no empieza. Cuando empiece, las preguntas aparecerán aquí solas.
              </p>
            }
          />
          <a
            href={ATENEA_GPT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full rounded-xl px-4 py-3.5 text-center font-semibold text-white ring-1 ring-white/40"
          >
            Mientras tanto, pregúntale a Atenea (GPT) ↗
          </a>
        </div>
      </Shell>
    );
  }

  // --- Preguntas ---
  if (current.kind === "question" && current.questionIds?.length) {
    return (
      <Shell banner={banner} bottom={talk}>
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-white/60">
          {NUMBERED_QUESTIONS.includes(current.questionIds[0])
            ? `Pregunta ${NUMBERED_QUESTIONS.indexOf(current.questionIds[0]) + 1} de ${NUMBERED_QUESTIONS.length} · `
            : ""}
          {ACT_LABEL[current.act]}
        </p>
        {errorBox}
        <QuestionStep
          key={current.id}
          ids={current.questionIds}
          mine={mine}
          save={save}
          busy={busy}
        />
      </Shell>
    );
  }

  // --- Cierre: Tres puertas en el celular ---
  if (current.kind === "puertas" || current.kind === "gracias") {
    return (
      <Shell banner={banner}>
        <ThreeDoors
          preview={isPreview}
          key="doors-inline"
          done={doorsDone}
          onDone={markDoorsDone}
          onAnother={anotherDoor}
          intro={
            <p className="mt-1 text-[15px] text-white/80">
              Por primera vez te pedimos tu nombre. Elige cómo quieres seguir con nosotros.
            </p>
          }
        />
        {current.kind === "gracias" && (
          <div className="mt-8 border-t border-white/15 pt-6">
            <LinkButtons />
          </div>
        )}
      </Shell>
    );
  }

  // --- Resto: mira la pantalla ---
  const watchText =
    current.kind === "registro"
      ? "Tu registro quedó listo."
      : current.kind === "atenea"
        ? "Atenea está respondiendo el reto que eligió la sala."
        : current.kind === "resumen"
          ? "En pantalla: lo que dijo la sala."
          : null;

  return (
    <Shell banner={banner} bottom={talk}>
      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-white/60">
        {ACT_LABEL[current.act]}
      </p>
      <div className="rounded-2xl bg-white/10 p-6 text-center ring-1 ring-white/15">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white/15">
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <rect x="2" y="4" width="20" height="13" rx="2" />
            <path d="M8 21h8M12 17v4" strokeLinecap="round" />
          </svg>
        </div>
        <h1 className="mt-4 text-2xl font-bold">
          {current.kind === "registro" ? "Listo, mira la pantalla" : "Mira la pantalla"}
        </h1>
        <p className="mt-2 text-white/80">
          {watchText ?? "Cuando haya una pregunta, aparecerá aquí sola."}
        </p>
      </div>
    </Shell>
  );
}
