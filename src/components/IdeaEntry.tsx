"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { IDEA_PROMPTS, ATHENEA_URL } from "@/config/event";
import MomentSelection from "@/components/MomentSelection";

type Ctx = {
  table: number | null;
  theme: string | null;
  momentId: string | null;
  momentText: string | null;
};

// Fase IDEA_ENTRY: 2 campos largos (IA + Agency), no obligatorios, ligados al
// momento que la persona eligió. Puede enviar VARIAS ideas (N por sesión).
export default function IdeaEntry({
  participantId,
  accent,
}: {
  participantId: string;
  accent?: string;
}) {
  const [ctx, setCtx] = useState<Ctx | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [ai, setAi] = useState("");
  const [agency, setAgency] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentCount, setSentCount] = useState(0);
  const [justSent, setJustSent] = useState(false);

  const loadCtx = useCallback(async () => {
    const { data: p } = await supabase
      .from("participants")
      .select("current_table, selected_theme")
      .eq("id", participantId)
      .single();
    const { data: sel } = await supabase
      .from("moment_selections")
      .select("moment_id")
      .eq("participant_id", participantId)
      .maybeSingle();
    const momentId = (sel?.moment_id as string | null) ?? null;
    let momentText: string | null = null;
    if (momentId) {
      const { data: m } = await supabase
        .from("selected_moments")
        .select("text")
        .eq("id", momentId)
        .single();
      momentText = (m?.text as string | null) ?? null;
    }
    const { count } = await supabase
      .from("idea_submissions")
      .select("*", { count: "exact", head: true })
      .eq("participant_id", participantId);
    setCtx({
      table: (p?.current_table as number | null) ?? null,
      theme: (p?.selected_theme as string | null) ?? null,
      momentId,
      momentText,
    });
    setSentCount(count ?? 0);
    setLoaded(true);
  }, [participantId]);

  useEffect(() => {
    loadCtx();
  }, [loadCtx]);

  async function submit() {
    if (!ai.trim() && !agency.trim()) {
      setError("Escribe al menos una idea (IA o Agency) antes de enviar.");
      return;
    }
    setSaving(true);
    setError(null);
    const { error: dbErr } = await supabase.from("idea_submissions").insert({
      participant_id: participantId,
      table_number: ctx?.table ?? null,
      theme: ctx?.theme ?? null,
      moment_id: ctx?.momentId ?? null,
      ai_text: ai.trim() || null,
      agency_text: agency.trim() || null,
    });
    setSaving(false);
    if (dbErr) {
      setError("No se pudo enviar. Intenta de nuevo.");
      return;
    }
    setSentCount((c) => c + 1);
    setAi("");
    setAgency("");
    setJustSent(true);
  }

  if (!loaded) {
    return (
      <main className="flex-1 flex items-center justify-center p-6 bg-slate-50">
        <p className="text-slate-500">Cargando…</p>
      </main>
    );
  }

  // Todavía no eligió un momento (p.ej. no alcanzó a elegirlo antes de que el
  // evento avanzara de fase): que lo elija aquí mismo y seguimos con las ideas.
  if (!ctx?.momentId) {
    return (
      <MomentSelection
        participantId={participantId}
        accent={accent}
        onSelected={loadCtx}
      />
    );
  }

  // Pantalla posterior al envío: Athenea + enviar más ideas.
  if (justSent) {
    return (
      <main className="flex-1 flex items-center justify-center p-6 bg-slate-50">
        <div className="w-full max-w-sm text-center">
          {accent && (
            <span
              className="mb-4 inline-block h-3 w-3 rounded-full"
              style={{ backgroundColor: accent }}
            />
          )}
          <h1 className="text-2xl font-bold text-slate-900">¡Idea enviada!</h1>
          <p className="mt-2 text-slate-600">
            Llevas {sentCount} {sentCount === 1 ? "idea enviada" : "ideas enviadas"}.
          </p>
          <div className="mt-8 space-y-3">
            <button
              onClick={() => setJustSent(false)}
              className="w-full rounded-lg bg-blue-700 px-4 py-3 font-semibold text-white shadow-sm hover:bg-blue-800"
            >
              Enviar otra idea
            </button>
            <a
              href={ATHENEA_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full rounded-lg border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-800 shadow-sm hover:border-blue-400 hover:bg-blue-50"
            >
              Explorar más con Athenea ↗
            </a>
          </div>
          <p className="mt-6 text-xs text-slate-400">
            Mientras tanto, comparte tus ideas con tu subgrupo.
          </p>
        </div>
      </main>
    );
  }

  // Formulario de captura.
  return (
    <main className="flex-1 flex items-center justify-center p-6 bg-slate-50">
      <div className="w-full max-w-md">
        {ctx.momentText && (
          <div className="rounded-lg bg-blue-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">
              Tu momento
            </p>
            <p className="mt-0.5 font-medium text-slate-800">{ctx.momentText}</p>
          </div>
        )}

        <div className="mt-5">
          <label className="block text-sm font-medium text-slate-700">
            {IDEA_PROMPTS.ai}
          </label>
          <textarea
            value={ai}
            onChange={(e) => {
              setAi(e.target.value);
              setError(null);
            }}
            rows={3}
            placeholder="Tus ideas sobre la IA…"
            className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-slate-700">
            {IDEA_PROMPTS.agency}
          </label>
          <textarea
            value={agency}
            onChange={(e) => {
              setAgency(e.target.value);
              setError(null);
            }}
            rows={3}
            placeholder="Tus ideas sobre la autonomía / voz…"
            className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>

        {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}

        <button
          onClick={submit}
          disabled={saving}
          className="mt-5 w-full rounded-lg bg-blue-700 px-4 py-3 font-semibold text-white shadow-sm hover:bg-blue-800 disabled:opacity-60"
        >
          {saving ? "Enviando…" : "Enviar idea"}
        </button>
        {sentCount > 0 && (
          <p className="mt-3 text-center text-xs text-slate-400">
            Ya enviaste {sentCount} {sentCount === 1 ? "idea" : "ideas"}.
          </p>
        )}
      </div>
    </main>
  );
}
