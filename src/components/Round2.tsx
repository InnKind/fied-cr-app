"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  THEMES,
  ROUND2_QUESTIONS,
  R2_CANT_COMMIT,
  numberedThemeTitle,
} from "@/config/event";
import { BRAND_BG } from "@/lib/brand";
import BrandLogo from "@/components/BrandLogo";

// Fase ROUND2: reflexión final. La mesa NO importa. Guarda en round2_responses
// (una por persona; upsert). Resiliente a recargar.
// Cambio #1: pregunta nueva "¿con qué idea…?" y la opción "no puedo
// comprometerme" que reemplaza el resto por "¿por qué no?".
export default function Round2({
  participantId,
  accent,
}: {
  participantId: string;
  accent?: string;
}) {
  const [theme, setTheme] = useState("");
  const [motivatingIdea, setMotivatingIdea] = useState("");
  const [role1, setRole1] = useState("");
  const [role2, setRole2] = useState("");
  const [role3, setRole3] = useState("");
  const [exp, setExp] = useState("");
  const [cantReason, setCantReason] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const cantCommit = theme === R2_CANT_COMMIT;

  useEffect(() => {
    let active = true;
    supabase
      .from("round2_responses")
      .select(
        "selected_theme, motivating_idea, role_1, role_2, role_3, experience_text, cant_commit, cant_commit_reason"
      )
      .eq("participant_id", participantId)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        if (data) {
          if (data.cant_commit) {
            setTheme(R2_CANT_COMMIT);
            setCantReason((data.cant_commit_reason as string | null) ?? "");
          } else {
            setTheme((data.selected_theme as string | null) ?? "");
          }
          setMotivatingIdea((data.motivating_idea as string | null) ?? "");
          setRole1((data.role_1 as string | null) ?? "");
          setRole2((data.role_2 as string | null) ?? "");
          setRole3((data.role_3 as string | null) ?? "");
          setExp((data.experience_text as string | null) ?? "");
          setDone(true);
        }
        setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [participantId]);

  async function submit() {
    if (!theme) {
      setError("Elige una opción para continuar.");
      return;
    }
    setSaving(true);
    setError(null);

    const row: {
      participant_id: string;
      selected_theme: string | null;
      cant_commit: boolean;
      cant_commit_reason: string | null;
      motivating_idea: string | null;
      role_1: string | null;
      role_2: string | null;
      role_3: string | null;
      experience_text: string | null;
    } = cantCommit
      ? {
          participant_id: participantId,
          selected_theme: null,
          cant_commit: true,
          cant_commit_reason: cantReason.trim() || null,
          motivating_idea: null,
          role_1: null,
          role_2: null,
          role_3: null,
          experience_text: null,
        }
      : {
          participant_id: participantId,
          selected_theme: theme,
          cant_commit: false,
          cant_commit_reason: null,
          motivating_idea: motivatingIdea.trim() || null,
          role_1: role1.trim() || null,
          role_2: role2.trim() || null,
          role_3: role3.trim() || null,
          experience_text: exp.trim() || null,
        };

    const { error: dbErr } = await supabase
      .from("round2_responses")
      .upsert(row, { onConflict: "participant_id" });
    setSaving(false);
    if (dbErr) {
      setError("No se pudo enviar. Intenta de nuevo.");
      return;
    }
    setDone(true);
  }

  if (!loaded) {
    return (
      <main className="flex-1 flex items-center justify-center p-6" style={{ background: BRAND_BG }}>
        <p className="text-white/80">Cargando…</p>
      </main>
    );
  }

  if (done) {
    return (
      <main className="flex-1 flex items-center justify-center p-6" style={{ background: BRAND_BG }}>
        <div className="w-full max-w-sm text-center">
          <BrandLogo className="mx-auto mb-6" />
          {accent && (
            <span
              className="mb-4 inline-block h-3 w-3 rounded-full"
              style={{ backgroundColor: accent }}
            />
          )}
          <h1 className="text-2xl font-bold text-white">¡Gracias!</h1>
          <p className="mt-3 text-white/80">
            {cantCommit
              ? "Gracias por compartirnos tu reflexión. Ahora comparte tu plan con 1 persona a tu lado."
              : "Ahora comparte tu plan con 1 persona a tu lado."}
          </p>
          <button
            onClick={() => setDone(false)}
            className="mt-6 text-sm font-medium text-teal-200 underline underline-offset-2 hover:text-teal-100"
          >
            Editar mis respuestas
          </button>
        </div>
      </main>
    );
  }

  const inputCls =
    "w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm focus:border-[#0c7d75] focus:outline-none focus:ring-2 focus:ring-[#0c7d75]/30";

  return (
    <main className="flex-1 flex items-center justify-center p-6" style={{ background: BRAND_BG }}>
      <div className="w-full max-w-md">
        <BrandLogo className="mb-6" />
        <h2 className="text-2xl font-bold text-white">
          Llévalo a tu contexto
        </h2>

        <div className="mt-5 rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-black/5">
          <div>
            <label className="block text-sm font-medium text-slate-700">
              {ROUND2_QUESTIONS.theme}
            </label>
            <select
              value={theme}
              onChange={(e) => {
                setTheme(e.target.value);
                setError(null);
              }}
              className={`mt-2 ${inputCls}`}
            >
              <option value="" disabled>
                Selecciona una opción…
              </option>
              {THEMES.map((t) => (
                <option key={t.id} value={t.id}>
                  {numberedThemeTitle(t.id)}
                </option>
              ))}
              <option value={R2_CANT_COMMIT}>
                {ROUND2_QUESTIONS.cantCommitOption}
              </option>
            </select>
          </div>

          {/* Rama "no puedo comprometerme": solo la pregunta del porqué. */}
          {cantCommit ? (
            <div className="mt-5">
              <label className="block text-sm font-medium text-slate-700">
                {ROUND2_QUESTIONS.cantCommitReason}
              </label>
              <textarea
                value={cantReason}
                onChange={(e) => setCantReason(e.target.value)}
                rows={3}
                placeholder="Qué te frena…"
                className={`mt-2 ${inputCls}`}
              />
            </div>
          ) : theme ? (
            <>
              <div className="mt-5">
                <label className="block text-sm font-medium text-slate-700">
                  {ROUND2_QUESTIONS.motivatingIdea}
                </label>
                <textarea
                  value={motivatingIdea}
                  onChange={(e) => setMotivatingIdea(e.target.value)}
                  rows={2}
                  placeholder="La idea con la que quieres empezar…"
                  className={`mt-2 ${inputCls}`}
                />
              </div>

              <div className="mt-5">
                <label className="block text-sm font-medium text-slate-700">
                  {ROUND2_QUESTIONS.roles}
                </label>
                <div className="mt-2 space-y-2">
                  <input
                    value={role1}
                    onChange={(e) => setRole1(e.target.value)}
                    placeholder="Rol 1 (ej: Decano/a)"
                    className={inputCls}
                  />
                  <input
                    value={role2}
                    onChange={(e) => setRole2(e.target.value)}
                    placeholder="Rol 2 (ej: Jefatura de TI)"
                    className={inputCls}
                  />
                  <input
                    value={role3}
                    onChange={(e) => setRole3(e.target.value)}
                    placeholder="Rol 3 (ej: Representante estudiantil)"
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="mt-5">
                <label className="block text-sm font-medium text-slate-700">
                  {ROUND2_QUESTIONS.experience}
                </label>
                <textarea
                  value={exp}
                  onChange={(e) => setExp(e.target.value)}
                  rows={3}
                  placeholder="El paso que vas a dar…"
                  className={`mt-2 ${inputCls}`}
                />
              </div>
            </>
          ) : null}

          {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}

          <button
            onClick={submit}
            disabled={saving}
            className="mt-5 w-full rounded-lg bg-[#c8103e] px-4 py-3 font-semibold text-white shadow-sm hover:bg-[#a50d33] active:bg-[#8a0b2b] disabled:opacity-60"
          >
            {saving ? "Enviando…" : "Enviar"}
          </button>
        </div>
      </div>
    </main>
  );
}
