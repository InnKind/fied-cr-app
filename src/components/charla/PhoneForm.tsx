"use client";

import { useId, useState } from "react";
import {
  EMAIL_RE,
  FORM_CONSENT,
  FORM_INTRO,
  FORM_TITLE,
  MOMENTS,
  PRIVACY_URL,
  PROFILE_FIELDS,
  SESSION,
  type Profile,
  type ProfileField,
} from "@/config/charla";
import { safeSession, type CharlaError } from "@/lib/charla";
import { Kicker, SERIF } from "@/components/charla/CharlaUI";
import { BTN_PRIMARY, BTN_SECONDARY, ErrorBox, HINT, INPUT } from "@/components/charla/PhoneUI";

export const EMPTY_PROFILE: Profile = { nombre: "", organizacion: "", cargo: "", correo: "" };

// Lo escrito sin enviar (sessionStorage): si el celular recarga, no se pierde.
// Se borra al guardar o al cancelar.
const DRAFT_KEY = `charla_profile_draft_${SESSION}`;

// Lee un perfil guardado como JSON (el del registro o el borrador). Deja solo
// los cuatro campos, como texto y sin pasarse del máximo.
export function parseProfile(raw: string | null): Profile | null {
  if (!raw) return null;
  try {
    const v: unknown = JSON.parse(raw);
    if (!v || typeof v !== "object" || Array.isArray(v)) return null;
    const r = v as Partial<Record<ProfileField, unknown>>;
    const out: Profile = { ...EMPTY_PROFILE };
    for (const f of PROFILE_FIELDS) {
      const x = r[f.id];
      if (typeof x === "string") out[f.id] = x.slice(0, f.max);
    }
    return out;
  } catch {
    return null;
  }
}

function trimAll(p: Profile): Profile {
  return {
    nombre: p.nombre.trim(),
    organizacion: p.organizacion.trim(),
    cargo: p.cargo.trim(),
    correo: p.correo.trim(),
  };
}

// Las mismas reglas de charla_register (supabase/14-charla.sql). El nombre se
// cuenta por caracteres, como en la base (Array.from: un emoji cuenta 1).
function check(p: Profile): Partial<Record<ProfileField, string>> {
  const e: Partial<Record<ProfileField, string>> = {};
  if (Array.from(p.nombre).length < 2) e.nombre = "Escriba su nombre.";
  if (!p.organizacion) e.organizacion = "Escriba el nombre de su organización.";
  if (!p.cargo) e.cargo = "Escriba su cargo.";
  if (!p.correo) e.correo = "Escriba su correo.";
  else if (!EMAIL_RE.test(p.correo)) e.correo = "Revise su correo: debe ser como nombre@organizacion.com.";
  return e;
}

// Registro (sección «Su perfil» del formulario) y «Corregir mis datos».
export default function PhoneForm({
  mode,
  initial,
  note,
  persist,
  busy,
  ready,
  error,
  onSubmit,
  onCancel,
}: {
  mode: "registro" | "corregir";
  initial: Profile; // perfil guardado en este celular (rellena el formulario)
  note?: string | null;
  persist: boolean; // false en vista previa: no toca el navegador
  busy: boolean; // guardando
  ready: boolean; // ya se supo si la base conoce a esta persona
  error: CharlaError | null;
  onSubmit: (p: Profile) => Promise<boolean>;
  onCancel?: () => void;
}) {
  const uid = useId();
  const [form, setFormState] = useState<Profile>(
    () => (persist ? parseProfile(safeSession.get(DRAFT_KEY)) : null) ?? initial
  );
  // Los avisos de cada campo aparecen después del primer intento de enviar.
  const [tried, setTried] = useState(false);
  const errors = tried ? check(trimAll(form)) : {};

  const setField = (id: ProfileField, value: string) => {
    const next = { ...form, [id]: value };
    setFormState(next);
    if (persist) safeSession.set(DRAFT_KEY, JSON.stringify(next));
  };

  const submit = async () => {
    if (busy || !ready) return;
    const clean = trimAll(form);
    const problems = check(clean);
    const bad = PROFILE_FIELDS.find((f) => problems[f.id]);
    if (bad) {
      setTried(true);
      document.getElementById(`${uid}-${bad.id}`)?.focus();
      return;
    }
    if ((await onSubmit(clean)) && persist) safeSession.remove(DRAFT_KEY);
  };

  const sendLabel = mode === "registro" ? "Continuar" : "Guardar";

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      {mode === "registro" ? (
        <>
          <h1 className="text-[30px] leading-[1.15] text-white" style={SERIF}>
            {FORM_TITLE}
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-[#DCE4FF]">{FORM_INTRO}</p>
        </>
      ) : (
        <h1 className="text-[30px] leading-[1.15] text-white" style={SERIF}>
          Sus datos
        </h1>
      )}

      {note && (
        <p className="mt-4 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-bold text-white">{note}</p>
      )}

      {mode === "registro" && (
        <Kicker className="mt-7 text-xs text-[#DCE4FF]">{MOMENTS[1].title}</Kicker>
      )}

      <div className={`space-y-4 ${mode === "registro" ? "mt-3" : "mt-6"}`}>
        {PROFILE_FIELDS.map((f, i) => {
          const id = `${uid}-${f.id}`;
          const err = errors[f.id];
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
                enterKeyHint={i === PROFILE_FIELDS.length - 1 ? "done" : "next"}
                required
                maxLength={f.max}
                value={form[f.id]}
                disabled={busy}
                aria-invalid={!!err}
                aria-describedby={err ? `${id}-aviso` : undefined}
                onChange={(e) => setField(f.id, e.target.value)}
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

      <div className="mt-6 space-y-4">
        {error && (
          <ErrorBox
            error={error}
            text={`No se pudieron guardar sus datos. Revise su conexión y toque «${sendLabel}» otra vez.`}
          />
        )}
        <div className={onCancel ? "grid grid-cols-2 gap-3" : ""}>
          {onCancel && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (persist) safeSession.remove(DRAFT_KEY);
                onCancel();
              }}
              className={BTN_SECONDARY}
            >
              Cancelar
            </button>
          )}
          <button type="submit" disabled={busy || !ready} className={BTN_PRIMARY}>
            {busy ? "Guardando…" : sendLabel}
          </button>
        </div>
      </div>

      <p className="mt-4 text-[13px] leading-relaxed text-[#DCE4FF]">
        {FORM_CONSENT}{" "}
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
