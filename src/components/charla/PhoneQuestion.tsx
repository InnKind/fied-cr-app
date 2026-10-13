"use client";

import { useId, useState } from "react";
import { MOMENTS, OTHER_MAX, SESSION, type Option, type Question } from "@/config/charla";
import {
  isAnswered,
  safeSession,
  toggleChoice,
  type CharlaAnswer,
  type CharlaError,
} from "@/lib/charla";
import { Kicker, SERIF } from "@/components/charla/CharlaUI";
import {
  BTN_PRIMARY,
  BTN_SECONDARY,
  CheckIcon,
  ErrorBox,
  HINT,
  INPUT,
} from "@/components/charla/PhoneUI";

// Lo que la persona lleva marcado o escrito en una pregunta, antes de enviarlo.
type Draft = { sel: string[]; other: string; text: string };

// Borrador sin enviar (sessionStorage): si el celular recarga a media pregunta,
// no se pierde lo marcado ni lo escrito. Se borra al guardar.
const draftKey = (q: Question) => `charla_draft_${SESSION}_${q.id}`;

// Deja solo lo que la pregunta admite: opciones que existen, el máximo, «Ninguna
// por ahora» sola (toggleChoice) y los textos sin pasarse del largo.
function clean(q: Question, d: { sel?: unknown; other?: unknown; text?: unknown }): Draft {
  const raw = Array.isArray(d.sel)
    ? Array.from(new Set(d.sel.filter((x): x is string => typeof x === "string")))
    : [];
  let sel: string[] = [];
  if (q.mode === "multi") {
    for (const id of raw) sel = toggleChoice(q, sel, id).sel;
  } else {
    const first = raw.find((id) => q.options.some((o) => o.id === id));
    if (first) sel = [first];
  }
  return {
    sel,
    other: typeof d.other === "string" ? d.other.slice(0, OTHER_MAX) : "",
    text: typeof d.text === "string" ? d.text.slice(0, q.textMax ?? 0) : "",
  };
}

function fromAnswer(q: Question, a: CharlaAnswer | undefined): Draft {
  return clean(q, {
    sel: q.mode === "multi" ? a?.choices : a?.choice ? [a.choice] : [],
    other: a?.other,
    text: a?.text,
  });
}

function readDraft(q: Question): Draft | null {
  try {
    const raw = safeSession.get(draftKey(q));
    const v: unknown = raw ? JSON.parse(raw) : null;
    if (!v || typeof v !== "object" || Array.isArray(v)) return null;
    return clean(q, v as { sel?: unknown; other?: unknown; text?: unknown });
  } catch {
    return null;
  }
}

// La respuesta con la forma que acepta charla_answer (supabase/14-charla.sql):
// {choice} / {choices} / {text}, y «other» SOLO si eligió «Otros» y escribió
// algo (nunca other: ""). null = todavía no hay nada que enviar.
function toAnswer(q: Question, d: Draft): CharlaAnswer | null {
  if (q.mode === "text") {
    const text = d.text.trim().slice(0, q.textMax ?? 0).trim();
    return text ? { text } : null;
  }
  const otherOpt = q.options.find((o) => o.other);
  const other = d.other.trim().slice(0, OTHER_MAX);
  const extra = otherOpt && d.sel.includes(otherOpt.id) && other ? { other } : {};
  if (q.mode === "multi") {
    // En el orden de las opciones, no en el que las tocó.
    const choices = q.options.map((o) => o.id).filter((id) => d.sel.includes(id));
    return choices.length > 0 ? { choices, ...extra } : null;
  }
  return d.sel[0] ? { choice: d.sel[0], ...extra } : null;
}

// Rótulo de arriba: momento, «Pregunta i de n» (dentro del momento) y, si se
// pide, la introducción del momento en su primera pregunta.
export function QuestionHeader({ q, intro = false }: { q: Question; intro?: boolean }) {
  const moment = MOMENTS[q.moment];
  const index = moment.questions.indexOf(q.id);
  return (
    <div className="mb-5">
      <Kicker className="text-xs text-[#DCE4FF]">
        {moment.kicker} · {moment.title}
      </Kicker>
      <p className="mt-1.5 text-sm font-bold text-white">
        Pregunta {index + 1} de {moment.questions.length}
        {!q.required && <span className="font-normal text-[#DCE4FF]"> · Opcional</span>}
      </p>
      {intro && index === 0 && moment.intro && (
        <p className="mt-4 rounded-xl bg-white/10 px-4 py-3 text-[15px] leading-relaxed text-[#DCE4FF]">
          {moment.intro}
        </p>
      )}
    </div>
  );
}

// Tarjeta de opción. shape: círculo = se elige una; cuadro = se eligen varias.
function OptionCard({
  label,
  selected,
  disabled,
  shape,
  onClick,
}: {
  label: string;
  selected: boolean;
  disabled: boolean;
  shape: "radio" | "check";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={`flex min-h-[56px] w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-[#223C5D] shadow transition active:scale-[0.99] disabled:opacity-70 ${
        selected ? "bg-[#FFF3EC] ring-[3px] ring-inset ring-[#FF5800]" : "bg-white"
      }`}
    >
      <span
        aria-hidden="true"
        className={`flex h-6 w-6 shrink-0 items-center justify-center border-2 ${
          shape === "radio" ? "rounded-full" : "rounded-md"
        } ${selected ? "border-[#FF5800] bg-[#FF5800] text-white" : "border-[#C9D2DE] bg-white"}`}
      >
        {selected && <CheckIcon className="h-4 w-4" />}
      </span>
      <span className="min-w-0 text-[17px] font-semibold leading-snug">{label}</span>
    </button>
  );
}

// Botones de abajo: «Saltar» o «Cancelar» a la izquierda y «Enviar» a la derecha.
// Sin onClick, «Enviar» es el botón del formulario (lo dispara también el
// teclado del celular).
function Actions({
  secondary,
  send,
  busy,
}: {
  secondary: { label: string; run: () => void } | null;
  send: { disabled: boolean; onClick?: () => void } | null;
  busy: boolean;
}) {
  if (!secondary && !send) return null;
  return (
    <div className={secondary && send ? "grid grid-cols-2 gap-3" : ""}>
      {secondary && (
        <button type="button" onClick={secondary.run} disabled={busy} className={BTN_SECONDARY}>
          {secondary.label}
        </button>
      )}
      {send && (
        <button
          type={send.onClick ? "button" : "submit"}
          onClick={send.onClick}
          disabled={busy || send.disabled}
          className={BTN_PRIMARY}
        >
          {busy ? "Enviando…" : "Enviar"}
        </button>
      )}
    </div>
  );
}

const SAVING = "text-sm font-bold text-[#DCE4FF]";
const RETRY_TAP = "No se pudo guardar su respuesta. Revise su conexión y vuelva a tocarla para reintentar.";
const RETRY_SEND = "No se pudo guardar su respuesta. Revise su conexión y toque «Enviar» otra vez.";

// Una pregunta en el celular. Se monta con key={q.id}: cada pregunta empieza
// con su propio borrador.
//   single → tocar una opción la guarda al instante (menos «Otros», que pide «Enviar»)
//   scale  → tocar un número lo guarda al instante
//   multi  → casillas + «Enviar»
//   text   → texto + «Enviar»
export default function PhoneQuestion({
  q,
  saved,
  busy,
  ready,
  error,
  persist,
  onSave,
  onSkip,
  onCancel,
}: {
  q: Question;
  saved?: CharlaAnswer; // respuesta guardada (rellena el editor)
  busy: boolean; // guardando
  ready: boolean; // ya se leyó la base: se puede guardar
  error: CharlaError | null;
  persist: boolean; // false en vista previa: no toca el navegador
  onSave: (answer: CharlaAnswer) => Promise<boolean>;
  onSkip?: () => void; // solo en preguntas opcionales
  onCancel?: () => void; // al editar desde «Sus respuestas»
}) {
  const fieldId = useId();
  // El borrador solo se usa mientras la pregunta no tiene respuesta guardada:
  // al cambiar una respuesta se parte de lo guardado.
  const drafting = persist && !isAnswered(q, saved);
  const [draft, setDraftState] = useState<Draft>(
    () => (drafting ? readDraft(q) : null) ?? fromAnswer(q, saved)
  );
  // Aviso de toggleChoice («Máximo 3…»), debajo de la opción que se tocó.
  const [hint, setHint] = useState<{ at: string; text: string } | null>(null);
  // El campo de «Otros» toma el foco solo cuando la persona acaba de tocarlo.
  const [focusOther, setFocusOther] = useState(false);

  // store=false: una opción que se guarda al instante no se deja como borrador
  // (al recargar parecería respondida sin estarlo).
  const setDraft = (next: Draft, store = true) => {
    setDraftState(next);
    if (!drafting) return;
    if (store && (next.sel.length > 0 || next.other || next.text)) {
      safeSession.set(draftKey(q), JSON.stringify(next));
    } else {
      safeSession.remove(draftKey(q));
    }
  };

  const send = async (d: Draft) => {
    const answer = toAnswer(q, d);
    if (!answer || busy || !ready) return;
    if ((await onSave(answer)) && persist) safeSession.remove(draftKey(q));
  };

  // Una opción (single y scale).
  const pick = (o: Option) => {
    const next = { ...draft, sel: [o.id] };
    if (o.other) {
      setFocusOther(true);
      setDraft(next);
      return;
    }
    setDraft(next, false);
    void send(next);
  };

  // Varias opciones (multi): el máximo y «Ninguna por ahora» los cuida toggleChoice.
  const toggle = (o: Option) => {
    const r = toggleChoice(q, draft.sel, o.id);
    setDraft({ ...draft, sel: r.sel });
    setHint(r.hint ? { at: o.id, text: r.hint } : null);
  };

  const canSend = toAnswer(q, draft) !== null;
  const secondary = onCancel
    ? { label: "Cancelar", run: onCancel }
    : onSkip
      ? { label: "Saltar", run: onSkip }
      : null;

  const otherField = (
    <div className="mt-2.5">
      <label htmlFor={fieldId} className="block text-sm font-bold text-white">
        Especifique <span className="font-normal text-[#DCE4FF]">(opcional)</span>
      </label>
      <input
        id={fieldId}
        type="text"
        value={draft.other}
        maxLength={OTHER_MAX}
        disabled={busy}
        autoFocus={focusOther}
        autoComplete="off"
        enterKeyHint="done"
        placeholder="Escriba aquí"
        onChange={(e) => setDraft({ ...draft, other: e.target.value })}
        className={`mt-1.5 ${INPUT}`}
      />
    </div>
  );

  const titleId = `${fieldId}-titulo`;
  const title = (
    <h1 id={titleId} className="text-[26px] leading-[1.2] text-white" style={SERIF}>
      {q.prompt}
    </h1>
  );

  // --- Texto libre ---
  if (q.mode === "text") {
    const max = q.textMax ?? 0;
    return (
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void send(draft);
        }}
      >
        {title}
        {q.long ? (
          <textarea
            aria-labelledby={titleId}
            rows={5}
            value={draft.text}
            maxLength={max}
            disabled={busy}
            placeholder="Escriba aquí"
            onChange={(e) => setDraft({ ...draft, text: e.target.value })}
            className={`mt-5 ${INPUT}`}
          />
        ) : (
          <input
            aria-labelledby={titleId}
            type="text"
            value={draft.text}
            maxLength={max}
            disabled={busy}
            autoComplete="off"
            enterKeyHint="send"
            placeholder="Escriba aquí"
            onChange={(e) => setDraft({ ...draft, text: e.target.value })}
            className={`mt-5 ${INPUT}`}
          />
        )}
        <p className="mt-1.5 text-right text-xs text-[#DCE4FF]">
          {draft.text.length}/{max}
        </p>
        <div className="mt-5 space-y-4">
          {error && <ErrorBox error={error} text={RETRY_SEND} />}
          <Actions secondary={secondary} send={{ disabled: !canSend || !ready }} busy={busy} />
        </div>
      </form>
    );
  }

  // --- Escala 1–5 ---
  if (q.mode === "scale") {
    const last = q.options.length - 1;
    return (
      <div>
        {title}
        <div role="group" aria-labelledby={titleId} className="mt-6 grid grid-cols-5 gap-2">
          {q.options.map((o, i) => {
            const on = draft.sel[0] === o.id;
            const end = i === 0 ? q.minLabel : i === last ? q.maxLabel : undefined;
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => pick(o)}
                disabled={busy || !ready}
                aria-pressed={on}
                aria-label={end ? `${o.label}: ${end}` : o.label}
                className={`flex h-16 items-center justify-center rounded-2xl text-2xl font-bold shadow transition active:scale-[0.97] disabled:opacity-70 ${
                  on ? "bg-[#FF5800] text-white ring-2 ring-white" : "bg-white text-[#223C5D]"
                }`}
              >
                {o.label}
              </button>
            );
          })}
        </div>
        <div className="mt-2.5 flex justify-between gap-6 text-sm leading-snug text-[#DCE4FF]">
          <span>{q.minLabel}</span>
          <span className="text-right">{q.maxLabel}</span>
        </div>
        {busy && <p className={`mt-4 text-center ${SAVING}`}>Guardando…</p>}
        {(error || secondary) && (
          <div className="mt-6 space-y-4">
            {error && <ErrorBox error={error} text={RETRY_TAP} />}
            <Actions secondary={secondary} send={null} busy={busy} />
          </div>
        )}
      </div>
    );
  }

  // --- Varias opciones ---
  if (q.mode === "multi") {
    return (
      <div>
        {title}
        <p className="mt-2 text-[15px] text-[#DCE4FF]">
          {q.max ? `Elija hasta ${q.max}.` : "Puede elegir más de una opción."}
        </p>
        <div role="group" aria-labelledby={titleId} className="mt-4 space-y-2.5">
          {q.options.map((o) => {
            const on = draft.sel.includes(o.id);
            return (
              <div key={o.id}>
                <OptionCard
                  shape="check"
                  label={o.label}
                  selected={on}
                  disabled={busy}
                  onClick={() => toggle(o)}
                />
                {hint?.at === o.id && (
                  <p role="status" className={`mt-1.5 ${HINT}`}>
                    {hint.text}
                  </p>
                )}
                {on && o.other && <div className="mb-4">{otherField}</div>}
              </div>
            );
          })}
        </div>
        <div className="mt-6 space-y-4">
          {error && <ErrorBox error={error} text={RETRY_SEND} />}
          <Actions
            secondary={secondary}
            send={{ disabled: !canSend || !ready, onClick: () => void send(draft) }}
            busy={busy}
          />
        </div>
      </div>
    );
  }

  // --- Una opción ---
  // El error sale debajo de la opción que se tocó (la lista puede ser larga).
  const footError = !q.options.some((o) => o.id === draft.sel[0]) ? error : null;
  return (
    <div>
      {title}
      <div role="group" aria-labelledby={titleId} className="mt-5 space-y-2.5">
        {q.options.map((o) => {
          const on = draft.sel[0] === o.id;
          return (
            <div key={o.id}>
              <OptionCard
                shape="radio"
                label={o.label}
                selected={on}
                disabled={busy || !ready}
                onClick={() => pick(o)}
              />
              {on && busy && !o.other && <p className={`mt-1.5 ${SAVING}`}>Guardando…</p>}
              {on && o.other && (
                <form
                  noValidate
                  onSubmit={(e) => {
                    e.preventDefault();
                    void send(draft);
                  }}
                >
                  {otherField}
                  <button type="submit" disabled={busy || !ready} className={`mt-3 ${BTN_PRIMARY}`}>
                    {busy ? "Enviando…" : "Enviar"}
                  </button>
                </form>
              )}
              {on && error && (
                <div className="mt-2.5">
                  <ErrorBox error={error} text={o.other ? RETRY_SEND : RETRY_TAP} />
                </div>
              )}
            </div>
          );
        })}
      </div>
      {(footError || secondary) && (
        <div className="mt-6 space-y-4">
          {footError && <ErrorBox error={footError} text={RETRY_TAP} />}
          <Actions secondary={secondary} send={null} busy={busy} />
        </div>
      )}
    </div>
  );
}
