"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { classifyError } from "@/lib/stand";
import {
  ATENEA_GPT_URL,
  CONSENTS,
  DOORS,
  DOOR_EVIDENCE_PROMPT,
  DOOR_TIMING,
  DOOR_TIMING_PROMPT,
  EVENT_CODE,
  LIMITS,
  PRIVACY_FOOTER,
  PRIVACY_URL,
  SESSION,
  type DoorId,
} from "@/config/stand";
import { Chip } from "@/components/stand/StandUI";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type Form = {
  door: DoorId | null;
  options: string[];
  timing: string | null;
  evidence: string;
  referral_org: string;
  referral_role: string;
  name: string;
  role: string;
  org: string;
  country: string;
  email: string;
  consent_contact: boolean;
  consent_results: boolean;
  consent_news: boolean;
};

const EMPTY: Form = {
  door: null,
  options: [],
  timing: null,
  evidence: "",
  referral_org: "",
  referral_role: "",
  name: "",
  role: "",
  org: "",
  country: "",
  email: "",
  consent_contact: false,
  consent_results: false,
  consent_news: false,
};

const inputCls =
  "w-full rounded-xl border-0 bg-white px-4 py-3 text-base text-slate-900 placeholder:text-slate-400 outline-none ring-2 ring-transparent focus:ring-[#c9283f]";

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-white">
        {label}
        {required && <span className="ml-1 text-[#ffb3bf]">*</span>}
      </span>
      {children}
    </label>
  );
}

function Check({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-white/5 p-3 ring-1 ring-white/15">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-5 w-5 shrink-0 accent-[#c9283f]"
      />
      <span className="text-[15px] leading-snug text-white">{children}</span>
    </label>
  );
}

function missingFields(f: Form): string[] {
  const out: string[] = [];
  if (!f.door) {
    out.push("Elige una puerta");
    return out;
  }
  if (f.door !== "0") {
    if (!f.name.trim()) out.push("Nombre");
    if (!f.role.trim()) out.push("Cargo");
    if (!f.org.trim()) out.push("Organización");
    if (!f.country.trim()) out.push("País");
  }
  if (!f.email.trim()) out.push("Correo");
  else if (!EMAIL_RE.test(f.email.trim())) out.push("Un correo válido");
  return out;
}

const nz = (s: string) => (s.trim() ? s.trim() : null);

// Formulario de las Tres puertas (cierre). Los contactos van a stand_contacts,
// que el navegador puede insertar pero NO leer. No se une al id anónimo.
export default function ThreeDoors({
  done,
  onDone,
  onAnother,
  onBack,
  intro,
  preview = false,
}: {
  preview?: boolean; // vista previa: no inserta nada
  done: boolean;
  onDone: () => void;
  onAnother: () => void;
  onBack?: () => void; // "Volver a la sesión"
  intro?: React.ReactNode;
}) {
  const [f, setF] = useState<Form>(EMPTY);
  const [tried, setTried] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendDetail, setSendDetail] = useState<string | null>(null);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((prev) => ({ ...prev, [k]: v }));

  const door = DOORS.find((d) => d.id === f.door) ?? null;
  const missing = missingFields(f);

  const toggleOption = (id: string) =>
    setF((prev) => ({
      ...prev,
      options: prev.options.includes(id)
        ? prev.options.filter((x) => x !== id)
        : [...prev.options, id],
    }));

  const chooseDoor = (id: DoorId) =>
    setF((prev) => (prev.door === id ? prev : { ...prev, door: id, options: [] }));

  async function submit() {
    setTried(true);
    if (missing.length > 0 || !f.door || sending) return;
    setSending(true);
    setSendError(null);
    setSendDetail(null);
    const d = f.door;
    const payload = {
      session: SESSION,
      event_code: EVENT_CODE,
      door: d,
      options: (d === "1" || d === "3") && f.options.length ? f.options : null,
      name: d !== "0" ? nz(f.name) : null,
      role: d !== "0" ? nz(f.role) : null,
      org: d !== "0" ? nz(f.org) : null,
      country: d !== "0" ? nz(f.country) : null,
      email: f.email.trim(),
      timing: d === "1" ? f.timing : null,
      evidence: d === "1" ? nz(f.evidence) : null,
      referral_org: d === "2" ? nz(f.referral_org) : null,
      referral_role: d === "2" ? nz(f.referral_role) : null,
      consent_contact: f.consent_contact,
      consent_results: f.consent_results,
      consent_news: f.consent_news,
    };
    try {
      // Sin .select(): el público no puede leer esta tabla.
      const { error } = preview
        ? { error: null }
        : await supabase.from("stand_contacts").insert(payload);
      if (error) {
        const c = classifyError(error);
        setSendError(
          c.kind === "missing"
            ? "El formulario todavía no está activado. Mientras tanto, usa el talón de papel del tríptico."
            : "No pudimos enviar tus datos. Revisa tu conexión y vuelve a intentarlo. Lo que escribiste sigue aquí."
        );
        setSendDetail(c.detail ?? null);
      } else {
        setF(EMPTY);
        setTried(false);
        onDone();
      }
    } catch (e) {
      const c = classifyError(e as Error);
      setSendError(
        "No pudimos enviar tus datos. Revisa tu conexión y vuelve a intentarlo. Lo que escribiste sigue aquí."
      );
      setSendDetail(c.detail ?? null);
    } finally {
      setSending(false);
    }
  }

  if (done) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl bg-white p-6 text-center text-[#223c5d] shadow-lg">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#c9283f] text-3xl font-bold text-white">
            ✓
          </div>
          <h2 className="mt-4 text-2xl font-bold">¡Gracias!</h2>
          <p className="mt-2 text-[15px] text-slate-600">
            Recibimos tus datos. Solo los usaremos para lo que marcaste.
          </p>
        </div>
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
        <button
          type="button"
          onClick={onAnother}
          className="block w-full rounded-xl px-4 py-3 text-center font-semibold text-white ring-1 ring-white/40"
        >
          Elegir otra puerta
        </button>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="block w-full px-4 py-2 text-center text-sm font-semibold text-white/80 underline"
          >
            Volver a la sesión
          </button>
        )}
      </div>
    );
  }

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      noValidate
    >
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="text-sm font-semibold text-white/80 underline"
        >
          ← Volver a la sesión
        </button>
      )}

      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-white/60">
          Quiero hablar con ustedes
        </p>
        <h2 className="mt-1 text-2xl font-bold text-white">Tres puertas</h2>
        {intro ?? (
          <p className="mt-1 text-[15px] text-white/80">Elige cómo quieres seguir con nosotros.</p>
        )}
      </div>

      {/* Puertas */}
      <fieldset className="space-y-2.5">
        <legend className="sr-only">Elige una puerta</legend>
        {DOORS.map((d) => {
          const on = f.door === d.id;
          return (
            <button
              type="button"
              key={d.id}
              onClick={() => chooseDoor(d.id)}
              aria-pressed={on}
              className={`w-full rounded-2xl px-4 py-3.5 text-left shadow transition ${
                on ? "bg-[#c9283f] text-white ring-2 ring-white" : "bg-white text-[#223c5d]"
              }`}
            >
              <span className="block text-[17px] font-bold">{d.title}</span>
              {d.id === "0" && d.text && (
                <span className={`mt-0.5 block text-sm ${on ? "text-white/90" : "text-slate-600"}`}>
                  {d.text}
                </span>
              )}
            </button>
          );
        })}
      </fieldset>

      {door && (door.id === "1" || door.id === "3") && door.options && (
        <div className="space-y-2.5">
          <p className="text-sm font-semibold text-white">
            Opciones
            <span className="ml-1 font-normal text-white/60">(puedes marcar varias)</span>
          </p>
          {door.options.map((o) => (
            <Check key={o.id} checked={f.options.includes(o.id)} onChange={() => toggleOption(o.id)}>
              {o.label}
            </Check>
          ))}
        </div>
      )}

      {door?.id === "1" && (
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-semibold text-white">{DOOR_TIMING_PROMPT}</p>
            <div className="grid grid-cols-3 gap-2">
              {DOOR_TIMING.map((t) => {
                const on = f.timing === t.id;
                return (
                  <button
                    type="button"
                    key={t.id}
                    onClick={() => set("timing", on ? null : t.id)}
                    aria-pressed={on}
                    className={`rounded-xl px-2 py-3 text-sm font-semibold shadow ${
                      on ? "bg-[#c9283f] text-white ring-2 ring-white" : "bg-white text-[#223c5d]"
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>
          <Field label={DOOR_EVIDENCE_PROMPT}>
            <textarea
              rows={2}
              maxLength={LIMITS.evidence}
              value={f.evidence}
              onChange={(e) => set("evidence", e.target.value)}
              className={inputCls}
            />
          </Field>
        </div>
      )}

      {door?.id === "2" && (
        <div className="space-y-4">
          <p className="text-[15px] text-white/85">{door.text}</p>
          <Field label="Organización de la persona">
            <input
              maxLength={LIMITS.referral_org}
              value={f.referral_org}
              onChange={(e) => set("referral_org", e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Cargo de la persona">
            <input
              maxLength={LIMITS.referral_role}
              value={f.referral_role}
              onChange={(e) => set("referral_role", e.target.value)}
              className={inputCls}
            />
          </Field>
        </div>
      )}

      {door && (
        <div className="space-y-4">
          <p className="text-sm font-semibold uppercase tracking-widest text-white/60">Tus datos</p>
          {door.id !== "0" && (
            <>
              <Field label="Nombre" required>
                <input
                  autoComplete="name"
                  maxLength={LIMITS.name}
                  value={f.name}
                  onChange={(e) => set("name", e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Cargo" required>
                <input
                  autoComplete="organization-title"
                  maxLength={LIMITS.role}
                  value={f.role}
                  onChange={(e) => set("role", e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Organización" required>
                <input
                  autoComplete="organization"
                  maxLength={LIMITS.org}
                  value={f.org}
                  onChange={(e) => set("org", e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="País" required>
                <input
                  autoComplete="country-name"
                  maxLength={LIMITS.country}
                  value={f.country}
                  onChange={(e) => set("country", e.target.value)}
                  className={inputCls}
                />
              </Field>
            </>
          )}
          <Field label="Correo" required>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              maxLength={LIMITS.email}
              value={f.email}
              onChange={(e) => set("email", e.target.value)}
              className={inputCls}
            />
          </Field>
        </div>
      )}

      {door && (
        <div className="space-y-2.5">
          <Check checked={f.consent_contact} onChange={(v) => set("consent_contact", v)}>
            {CONSENTS.contact}
          </Check>
          <Check checked={f.consent_results} onChange={(v) => set("consent_results", v)}>
            {CONSENTS.results}
          </Check>
          <Check checked={f.consent_news} onChange={(v) => set("consent_news", v)}>
            {CONSENTS.news}
          </Check>
          {door.id !== "0" && !f.consent_contact && (
            <p className="px-1 text-xs text-white/70">
              Sin la primera casilla no podremos contactarte sobre la opción que elegiste.
            </p>
          )}
          {door.id === "0" && !f.consent_results && (
            <p className="px-1 text-xs text-white/70">
              Sin la segunda casilla no podremos mandarte los resultados.
            </p>
          )}
        </div>
      )}

      {door && tried && missing.length > 0 && (
        <p className="rounded-xl bg-[#fff1f3] px-4 py-3 text-sm font-semibold text-[#9f1239]">
          Falta: {missing.join(", ")}.
        </p>
      )}

      {sendError && (
        <div className="rounded-xl bg-[#fff1f3] px-4 py-3 text-sm text-[#9f1239]">
          <p className="font-semibold">{sendError}</p>
          {sendDetail && <p className="mt-1 text-xs opacity-70">{sendDetail}</p>}
        </div>
      )}

      {door && (
        <button
          type="submit"
          disabled={sending}
          className="w-full rounded-xl bg-[#c9283f] px-4 py-4 text-lg font-bold text-white shadow-lg disabled:opacity-60"
        >
          {sending ? "Enviando…" : sendError ? "Reintentar" : "Enviar"}
        </button>
      )}

      <p className="text-xs leading-relaxed text-white/70">
        {PRIVACY_FOOTER} Aviso de privacidad:{" "}
        {PRIVACY_URL ? (
          <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer" className="underline">
            {PRIVACY_URL}
          </a>
        ) : (
          <Chip kind="PEDIR" text="enlace del aviso de privacidad de las inscripciones del FIEd" />
        )}
      </p>
    </form>
  );
}
