"use client";

import { useId, useState } from "react";
import {
  CONTACT,
  CONTACT_FIELDS,
  EMAIL_RE,
  PRIVACY_URL,
  SESSION,
  type Contact,
  type ContactField,
  type ContactOptionId,
} from "@/config/charla";
import { safeSession, type CharlaError } from "@/lib/charla";
import { SERIF } from "@/components/charla/CharlaUI";
import { OptionCard } from "@/components/charla/PhoneQuestion";
import { BTN_PRIMARY, BTN_SECONDARY, CheckIcon, ErrorBox, HINT, INPUT } from "@/components/charla/PhoneUI";

const EMPTY: Contact = { nombre: "", correo: "", organizacion: "", cargo: "" };
type Draft = { opciones: ContactOptionId[]; fields: Contact; consent: boolean };

// Lo escrito sin enviar (sessionStorage): si el celular recarga, no se pierde.
// Se borra al enviar o al decir que no.
const DRAFT_KEY = `charla_contact_draft_${SESSION}`;

const isOption = (x: unknown): x is ContactOptionId =>
  typeof x === "string" && CONTACT.options.some((o) => o.id === x);

// Lee el borrador: deja solo opciones que existen, los cuatro campos como texto
// sin pasarse del máximo y la casilla como sí/no.
function readDraft(): Draft | null {
  try {
    const raw = safeSession.get(DRAFT_KEY);
    const v: unknown = raw ? JSON.parse(raw) : null;
    if (!v || typeof v !== "object" || Array.isArray(v)) return null;
    const r = v as { opciones?: unknown; fields?: unknown; consent?: unknown };
    const opciones = Array.isArray(r.opciones) ? Array.from(new Set(r.opciones.filter(isOption))) : [];
    const fields: Contact = { ...EMPTY };
    if (r.fields && typeof r.fields === "object") {
      const f = r.fields as Partial<Record<ContactField, unknown>>;
      for (const c of CONTACT_FIELDS) {
        const x = f[c.id];
        if (typeof x === "string") fields[c.id] = x.slice(0, c.max);
      }
    }
    return { opciones, fields, consent: r.consent === true };
  } catch {
    return null;
  }
}

function trimAll(c: Contact): Contact {
  return {
    nombre: c.nombre.trim(),
    correo: c.correo.trim(),
    organizacion: c.organizacion.trim(),
    cargo: c.cargo.trim(),
  };
}

// Las mismas reglas de charla_contact (supabase/15-charla-anonima.sql). El
// nombre se cuenta por caracteres, como en la base (Array.from: un emoji cuenta 1).
type Problems = Partial<Record<ContactField | "opciones" | "consent", string>>;
function check(d: Draft): Problems {
  const c = trimAll(d.fields);
  const e: Problems = {};
  if (d.opciones.length === 0) e.opciones = "Marque al menos una opción.";
  if (Array.from(c.nombre).length < 2) e.nombre = "Escriba su nombre.";
  if (!c.correo) e.correo = "Escriba su correo.";
  else if (!EMAIL_RE.test(c.correo)) e.correo = "Revise su correo: debe ser como nombre@organizacion.com.";
  if (!d.consent) e.consent = "Marque la casilla para poder enviar sus datos.";
  return e;
}

// Contacto opcional del final. No recibe ni envía el código del celular: se
// guarda aparte de las respuestas (ver sendContact en src/lib/charla.ts).
export default function PhoneContact({
  persist,
  busy,
  error,
  onSend,
  onDecline,
  declineLabel,
}: {
  persist: boolean; // false en vista previa: no toca el navegador
  busy: boolean; // enviando
  error: CharlaError | null;
  onSend: (opciones: ContactOptionId[], c: Contact) => Promise<boolean>;
  onDecline: () => void;
  declineLabel: string; // «No, gracias» al final; «Cancelar» si lo abrió desde sus respuestas
}) {
  const uid = useId();
  const [draft, setDraftState] = useState<Draft>(
    () => (persist ? readDraft() : null) ?? { opciones: [], fields: { ...EMPTY }, consent: false }
  );
  // Los avisos aparecen después del primer intento de enviar.
  const [tried, setTried] = useState(false);
  const problems = tried ? check(draft) : {};

  const setDraft = (next: Draft) => {
    setDraftState(next);
    if (persist) safeSession.set(DRAFT_KEY, JSON.stringify(next));
  };

  const toggle = (id: ContactOptionId) => {
    const on = draft.opciones.includes(id);
    // En el orden de las opciones, no en el que las tocó.
    const opciones = CONTACT.options
      .map((o) => o.id)
      .filter((x) => (x === id ? !on : draft.opciones.includes(x)));
    setDraft({ ...draft, opciones });
  };

  const submit = async () => {
    if (busy) return;
    const found = check(draft);
    const first = (["opciones", ...CONTACT_FIELDS.map((f) => f.id), "consent"] as const).find(
      (k) => found[k]
    );
    if (first) {
      setTried(true);
      document.getElementById(`${uid}-${first}`)?.focus();
      return;
    }
    if ((await onSend(draft.opciones, trimAll(draft.fields))) && persist) safeSession.remove(DRAFT_KEY);
  };

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <h1 className="text-[30px] leading-[1.15] text-white" style={SERIF}>
        {CONTACT.title}
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-[#DCE4FF]">{CONTACT.intro}</p>

      <fieldset className="mt-7">
        <legend
          id={`${uid}-opciones`}
          tabIndex={-1}
          className="text-[19px] font-bold leading-snug text-white outline-none"
        >
          {CONTACT.prompt}
        </legend>
        <p className="mt-1 text-[15px] text-[#DCE4FF]">Puede elegir más de una opción.</p>
        <div className="mt-3 space-y-2.5">
          {CONTACT.options.map((o) => (
            <OptionCard
              key={o.id}
              shape="check"
              label={o.label}
              selected={draft.opciones.includes(o.id)}
              disabled={busy}
              onClick={() => toggle(o.id)}
            />
          ))}
        </div>
        {problems.opciones && <p className={`mt-1.5 ${HINT}`}>{problems.opciones}</p>}
      </fieldset>

      <div className="mt-7 space-y-4">
        {CONTACT_FIELDS.map((f, i) => {
          const id = `${uid}-${f.id}`;
          const err = problems[f.id];
          return (
            <div key={f.id}>
              <label htmlFor={id} className="block text-sm font-bold text-white">
                {f.label}
              </label>
              <input
                id={id}
                name={f.id}
                type={f.type}
                inputMode={f.type === "email" ? "email" : "text"}
                autoComplete={f.autoComplete}
                autoCapitalize={f.type === "email" ? "none" : f.id === "nombre" ? "words" : "sentences"}
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint={i === CONTACT_FIELDS.length - 1 ? "done" : "next"}
                required={f.required}
                maxLength={f.max}
                value={draft.fields[f.id]}
                disabled={busy}
                aria-invalid={!!err}
                aria-describedby={err ? `${id}-aviso` : undefined}
                onChange={(e) => setDraft({ ...draft, fields: { ...draft.fields, [f.id]: e.target.value } })}
                className={`mt-1.5 ${INPUT}`}
              />
              {err && (
                <p id={`${id}-aviso`} className={`mt-1.5 ${HINT}`}>
                  {err}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-6">
        <button
          id={`${uid}-consent`}
          type="button"
          role="checkbox"
          aria-checked={draft.consent}
          disabled={busy}
          onClick={() => setDraft({ ...draft, consent: !draft.consent })}
          className="flex min-h-12 w-full items-start gap-3 text-left text-[15px] leading-snug text-white disabled:opacity-70"
        >
          <span
            aria-hidden="true"
            className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 ${
              draft.consent ? "border-[#FF5800] bg-[#FF5800] text-white" : "border-white/70 bg-white"
            }`}
          >
            {draft.consent && <CheckIcon className="h-4 w-4" />}
          </span>
          <span>{CONTACT.consent}</span>
        </button>
        {problems.consent && <p className={`mt-1.5 ${HINT}`}>{problems.consent}</p>}
      </div>

      <div className="mt-6 space-y-4">
        {error && (
          <ErrorBox
            error={error}
            text="No se pudieron enviar sus datos. Revise su conexión y toque «Enviar» otra vez."
          />
        )}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (persist) safeSession.remove(DRAFT_KEY);
              onDecline();
            }}
            className={BTN_SECONDARY}
          >
            {declineLabel}
          </button>
          <button type="submit" disabled={busy} className={BTN_PRIMARY}>
            {busy ? "Enviando…" : "Enviar"}
          </button>
        </div>
      </div>

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
    </form>
  );
}
