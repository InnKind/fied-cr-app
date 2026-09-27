"use client";

import { useState } from "react";
import {
  ABIERTA,
  ABIERTA_MAX,
  P3,
  P3B,
  P3_NONE,
  P5,
  QUESTIONS,
  displayOption,
  optionLabel,
  type Question,
  type QuestionId,
} from "@/config/stand";
import type { StandAnswer } from "@/lib/stand";
import { Rich } from "@/components/stand/StandUI";

export type SaveFn = (qid: QuestionId, answer: StandAnswer) => Promise<boolean>;
export type Mine = Record<string, StandAnswer | undefined>;


function OptionButton({
  letter,
  label,
  detail,
  selected,
  disabled,
  onClick,
}: {
  letter?: string | null;
  label: string;
  detail?: string;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={`flex w-full items-start gap-3 rounded-2xl px-4 py-3.5 text-left shadow transition active:scale-[0.99] disabled:opacity-70 ${
        selected ? "bg-[#c9283f] text-white ring-2 ring-white" : "bg-white text-[#223c5d]"
      }`}
    >
      {letter && (
        <span
          className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
            selected ? "bg-white text-[#c9283f]" : "bg-[#223c5d] text-white"
          }`}
        >
          {letter}
        </span>
      )}
      <span className="min-w-0">
        <span className="block text-[17px] font-semibold leading-snug">
          <Rich text={label} />
        </span>
        {detail && (
          <span className={`mt-1 block text-sm leading-snug ${selected ? "text-white/90" : "text-slate-600"}`}>
            <Rich text={detail} />
          </span>
        )}
      </span>
    </button>
  );
}

export function SingleQuestion({
  q,
  value,
  busy,
  onPick,
}: {
  q: Question;
  value?: string;
  busy: boolean;
  onPick: (id: string) => void;
}) {
  return (
    <div>
      <h2 className="text-[22px] font-bold leading-snug text-white">{q.prompt}</h2>
      <div className="mt-4 space-y-2.5">
        {q.options.map((o) => {
          const d = displayOption(q, o);
          return (
            <OptionButton
              key={o.id}
              letter={d.letter}
              label={d.label}
              selected={value === o.id}
              disabled={busy}
              onClick={() => onPick(o.id)}
            />
          );
        })}
      </div>
    </div>
  );
}

export function DoneCard({
  title = "Listo, mira la pantalla",
  lines,
  onChange,
  extra,
}: {
  title?: string;
  lines: string[];
  onChange?: () => void;
  extra?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-white p-6 text-center text-[#223c5d] shadow-lg">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#c9283f] text-3xl font-bold text-white">
        ✓
      </div>
      <h2 className="mt-4 text-2xl font-bold">{title}</h2>
      {lines.length > 0 && (
        <div className="mt-3 space-y-1 text-[15px] text-slate-600">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Tu respuesta
          </p>
          {lines.map((l, i) => (
            <p key={i} className="font-medium text-slate-700">
              {l}
            </p>
          ))}
        </div>
      )}
      {onChange && (
        <button
          type="button"
          onClick={onChange}
          className="mt-5 w-full rounded-xl px-4 py-3 text-sm font-semibold text-[#223c5d] ring-1 ring-[#223c5d]/30"
        >
          Cambiar mi respuesta
        </button>
      )}
      {extra}
    </div>
  );
}

// --- Pregunta de una opción (P0, P1, P2, P4) ---
function SimpleStep({ q, mine, save, busy }: { q: Question; mine: Mine; save: SaveFn; busy: boolean }) {
  const answered = mine[q.id]?.choice;
  const [changing, setChanging] = useState(false);
  if (answered && !changing) {
    return <DoneCard lines={[optionLabel(q, answered)]} onChange={() => setChanging(true)} />;
  }
  return (
    <SingleQuestion
      q={q}
      value={answered}
      busy={busy}
      onPick={async (id) => {
        if (await save(q.id, { choice: id })) setChanging(false);
      }}
    />
  );
}

// --- P3 (máximo 2) + P3b en la misma pantalla ---
function BudgetStep({ mine, save, busy }: { mine: Mine; save: SaveFn; busy: boolean }) {
  const saved = mine.P3?.choices ?? [];
  const savedWho = mine.P3b?.choice ?? null;
  const [changing, setChanging] = useState(false);
  const [sel, setSel] = useState<string[]>(saved);
  const [who, setWho] = useState<string | null>(savedWho);
  const [hint, setHint] = useState<string | null>(null);
  const max = P3.max ?? 2;
  const onlyNone = sel.length === 1 && sel[0] === P3_NONE;

  if (saved.length > 0 && !changing) {
    const lines = saved.map((id) => optionLabel(P3, id));
    if (savedWho) lines.push(`${P3B.prompt} ${optionLabel(P3B, savedWho)}`);
    return (
      <DoneCard
        lines={lines}
        onChange={() => {
          setSel(saved);
          setWho(savedWho);
          setChanging(true);
        }}
      />
    );
  }

  // "Ninguna" excluye a las demás; máximo 2.
  const toggle = (id: string) => {
    setHint(null);
    if (id === P3_NONE) {
      setSel(sel.includes(P3_NONE) ? [] : [P3_NONE]);
      return;
    }
    const rest = sel.filter((x) => x !== P3_NONE);
    if (rest.includes(id)) {
      setSel(rest.filter((x) => x !== id));
    } else if (rest.length >= max) {
      setSel(rest);
      setHint(`Máximo ${max}: quita una para elegir otra.`);
    } else {
      setSel([...rest, id]);
    }
  };

  const ready = sel.length > 0 && (onlyNone || !!who);

  // Primero P3b y luego P3: la tarjeta de "Listo" solo aparece cuando P3 quedó
  // guardada, así que si algo falla no queda P3 sin su P3b.
  const send = async () => {
    if (!ready) return;
    if (!onlyNone && who) {
      if (!(await save("P3b", { choice: who }))) return;
    }
    if (!(await save("P3", { choices: sel }))) return;
    setChanging(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[22px] font-bold leading-snug text-white">{P3.prompt}</h2>
        <p className="mt-1 text-sm text-white/70">Elige hasta {max}.</p>
        <div className="mt-4 space-y-2.5">
          {P3.options.map((o) => (
            <OptionButton
              key={o.id}
              label={o.label}
              selected={sel.includes(o.id)}
              disabled={busy}
              onClick={() => toggle(o.id)}
            />
          ))}
        </div>
        {hint && <p className="mt-2 text-sm font-semibold text-[#ffd1d8]">{hint}</p>}
      </div>

      {!onlyNone && (
        <div>
          <h3 className="text-lg font-bold text-white">{P3B.prompt}</h3>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {P3B.options.map((o) => {
              const on = who === o.id;
              return (
                <button
                  type="button"
                  key={o.id}
                  onClick={() => setWho(on ? null : o.id)}
                  disabled={busy}
                  aria-pressed={on}
                  className={`rounded-xl px-2 py-3.5 text-[15px] font-semibold shadow ${
                    on ? "bg-[#c9283f] text-white ring-2 ring-white" : "bg-white text-[#223c5d]"
                  }`}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={send}
        disabled={!ready || busy}
        className="w-full rounded-xl bg-[#c9283f] px-4 py-4 text-lg font-bold text-white shadow-lg disabled:opacity-50"
      >
        {busy ? "Guardando…" : "Enviar"}
      </button>
    </div>
  );
}

// --- P5 + pregunta abierta opcional ---
function FrenoStep({ mine, save, busy }: { mine: Mine; save: SaveFn; busy: boolean }) {
  const p5 = mine.P5?.choice;
  const savedText = mine.ABIERTA?.text ?? "";
  const [changing, setChanging] = useState(false);
  const [openDone, setOpenDone] = useState(!!savedText);
  const [text, setText] = useState(savedText);

  if (!p5 || changing) {
    return (
      <SingleQuestion
        q={P5}
        value={p5}
        busy={busy}
        onPick={async (id) => {
          if (await save("P5", { choice: id })) setChanging(false);
        }}
      />
    );
  }

  if (!openDone) {
    return (
      <div className="space-y-4">
        <p className="rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-white">
          ✓ Guardamos tu respuesta. Una más, si quieres:
        </p>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-white/60">Opcional</p>
          <h2 className="mt-1 text-[22px] font-bold leading-snug text-white">{ABIERTA.prompt}</h2>
        </div>
        <textarea
          rows={4}
          maxLength={ABIERTA_MAX}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full rounded-xl border-0 bg-white px-4 py-3 text-base text-slate-900 outline-none ring-2 ring-transparent placeholder:text-slate-400 focus:ring-[#c9283f]"
          placeholder="Escribe aquí tu idea"
        />
        <p className="text-xs text-white/60">
          No escribas tu nombre: esta respuesta es anónima. {text.length}/{ABIERTA_MAX}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setOpenDone(true)}
            disabled={busy}
            className="rounded-xl px-4 py-3.5 font-semibold text-white ring-1 ring-white/40"
          >
            Saltar
          </button>
          <button
            type="button"
            disabled={busy || !text.trim()}
            onClick={async () => {
              if (await save("ABIERTA", { text: text.trim().slice(0, ABIERTA_MAX) })) setOpenDone(true);
            }}
            className="rounded-xl bg-[#c9283f] px-4 py-3.5 font-bold text-white shadow disabled:opacity-50"
          >
            {busy ? "Enviando…" : "Enviar"}
          </button>
        </div>
      </div>
    );
  }

  const lines = [optionLabel(P5, p5)];
  if (savedText) lines.push(`Tu propuesta: «${savedText}»`);
  return (
    <DoneCard
      lines={lines}
      onChange={() => setChanging(true)}
      extra={
        <button
          type="button"
          onClick={() => {
            setText(savedText);
            setOpenDone(false);
          }}
          className="mt-2 w-full px-4 py-2 text-sm font-semibold text-[#223c5d] underline"
        >
          {savedText ? "Cambiar mi propuesta" : "Escribir una propuesta"}
        </button>
      }
    />
  );
}

export function QuestionStep({
  ids,
  mine,
  save,
  busy,
}: {
  ids: QuestionId[];
  mine: Mine;
  save: SaveFn;
  busy: boolean;
}) {
  if (ids[0] === "P3") return <BudgetStep mine={mine} save={save} busy={busy} />;
  if (ids[0] === "P5") return <FrenoStep mine={mine} save={save} busy={busy} />;
  return <SimpleStep q={QUESTIONS[ids[0]]} mine={mine} save={save} busy={busy} />;
}
