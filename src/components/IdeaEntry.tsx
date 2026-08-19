"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { onForeground } from "@/lib/realtime";
import { ideaPromptsFor, ATHENEA_URL } from "@/config/event";
import MomentSelection from "@/components/MomentSelection";
import { recoverOrphanIdentity } from "@/lib/participant";
import BrandLogo from "@/components/BrandLogo";
import { BRAND_BG } from "@/lib/brand";

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
  const [changing, setChanging] = useState(false);

  const loadCtx = useCallback(async () => {
    const { data: p, error: pErr } = await supabase
      .from("participants")
      .select("current_table, selected_theme")
      .eq("id", participantId)
      .maybeSingle();
    // Mi fila ya no existe (reset con la pantalla abierta) → re-registrarse.
    if (!pErr && !p) return recoverOrphanIdentity();
    const { data: sel } = await supabase
      .from("moment_selections")
      .select("moment_id")
      .eq("participant_id", participantId)
      .maybeSingle();
    const momentId = (sel?.moment_id as string | null) ?? null;
    let momentText: string | null = null;
    // El tema del MOMENTO manda sobre el que la persona eligió al registrarse:
    // si se cambió a una mesa de otro tema, las preguntas deben ser las de esa
    // mesa (y la idea debe quedar archivada en ese tema).
    let momentTheme: string | null = null;
    if (momentId) {
      const { data: m } = await supabase
        .from("selected_moments")
        .select("text, theme")
        .eq("id", momentId)
        .single();
      momentText = (m?.text as string | null) ?? null;
      momentTheme = (m?.theme as string | null) ?? null;
    }
    const { count } = await supabase
      .from("idea_submissions")
      .select("*", { count: "exact", head: true })
      .eq("participant_id", participantId);
    setCtx({
      table: (p?.current_table as number | null) ?? null,
      theme: momentTheme ?? (p?.selected_theme as string | null) ?? null,
      momentId,
      momentText,
    });
    setSentCount(count ?? 0);
    setLoaded(true);
  }, [participantId]);

  useEffect(() => {
    loadCtx();
    // En vivo: si cambia tu mesa (reasignación) o tu selección de momento en
    // otro dispositivo, el contexto se refresca (no solo al volver a primer plano).
    const channel = supabase
      .channel(`rt-idea-${participantId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "participants",
          filter: `id=eq.${participantId}`,
        },
        () => loadCtx()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "moment_selections",
          filter: `participant_id=eq.${participantId}`,
        },
        () => loadCtx()
      )
      .subscribe();
    const stop = onForeground(loadCtx);
    return () => {
      supabase.removeChannel(channel);
      stop();
    };
  }, [loadCtx, participantId]);

  async function submit() {
    if (saving) return; // evita doble envío
    if (!ai.trim() && !agency.trim()) {
      setError("Escribe al menos una idea antes de enviar.");
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
      <main
        className="flex-1 flex items-center justify-center p-6"
        style={{ background: BRAND_BG }}
      >
        <p className="text-white/80">Cargando…</p>
      </main>
    );
  }

  // Elegir o CAMBIAR de momento: cuando no eligió ninguno, cuando lo pide desde
  // el formulario, o cuando su momento quedó "colgante" (el momentId existe pero
  // el momento fue borrado/reescrito, así que no hay texto). Al elegir, volvemos
  // a las ideas del nuevo momento.
  if (changing || !ctx?.momentId || !ctx?.momentText) {
    return (
      <MomentSelection
        participantId={participantId}
        accent={accent}
        onSelected={() => {
          setChanging(false);
          setJustSent(false);
          loadCtx();
        }}
      />
    );
  }

  // Pantalla posterior al envío: Atenea + enviar más ideas.
  if (justSent) {
    return (
      <main
        className="flex-1 flex items-center justify-center p-6"
        style={{ background: BRAND_BG }}
      >
        <div className="w-full max-w-sm text-center">
          <BrandLogo className="mx-auto mb-6" />
          {accent && (
            <span
              className="mb-4 inline-block h-3 w-3 rounded-full"
              style={{ backgroundColor: accent }}
            />
          )}
          <h1 className="text-2xl font-bold text-white">¡Idea enviada!</h1>
          <p className="mt-2 text-white/80">
            Envía más ideas hasta que tu grupo esté listo para compartir /
            generar ideas conjuntas. Luego una persona de tu grupo presenta las
            mejores ideas a los demás grupos de la mesa.
          </p>
          <div className="mt-8 space-y-3">
            <button
              onClick={() => setJustSent(false)}
              className="w-full rounded-lg bg-[#c8103e] px-4 py-3 font-semibold text-white shadow-sm hover:bg-[#a50d33] active:bg-[#8a0b2b]"
            >
              Enviar otra idea
            </button>
            <a
              href={ATHENEA_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full rounded-lg border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-800 shadow-sm hover:border-[#0c7d75] hover:bg-[#0c7d75]/5"
            >
              Explorar más con Atenea ↗
            </a>
          </div>
        </div>
      </main>
    );
  }

  // Formulario de captura. Las 2 preguntas dependen del tema de la persona.
  const prompts = ideaPromptsFor(ctx.theme);

  return (
    <main
      className="flex-1 flex items-center justify-center p-6"
      style={{ background: BRAND_BG }}
    >
      <div className="w-full max-w-md">
        <BrandLogo className="mx-auto mb-6" />
        <div className="rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-black/5">
          {ctx.momentText && (
            <div className="rounded-lg bg-[#0c7d75]/10 px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#0c7d75]">
                  Tu momento
                </p>
                <button
                  onClick={() => setChanging(true)}
                  className="shrink-0 text-xs font-medium text-[#0c7d75] underline underline-offset-2 hover:text-[#0a635c]"
                >
                  Cambiar momento
                </button>
              </div>
              <p className="mt-0.5 font-medium text-slate-800">{ctx.momentText}</p>
            </div>
          )}

          {/* Primero EMPODERAMIENTO, después IA (orden pedido por el equipo).
              Las preguntas cambian según el tema de la persona. */}
          <div className="mt-5">
            <label className="block text-sm font-medium text-slate-700">
              {prompts.agency.label}
            </label>
            <textarea
              value={agency}
              onChange={(e) => {
                setAgency(e.target.value);
                setError(null);
              }}
              rows={3}
              maxLength={700}
              placeholder={prompts.agency.placeholder}
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm focus:border-[#0c7d75] focus:outline-none focus:ring-2 focus:ring-[#0c7d75]/30"
            />
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-slate-700">
              {prompts.ai.label}
            </label>
            <textarea
              value={ai}
              onChange={(e) => {
                setAi(e.target.value);
                setError(null);
              }}
              rows={3}
              maxLength={700}
              placeholder={prompts.ai.placeholder}
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm focus:border-[#0c7d75] focus:outline-none focus:ring-2 focus:ring-[#0c7d75]/30"
            />
          </div>

          {error && (
            <p className="mt-3 text-sm font-medium text-red-600">{error}</p>
          )}

          <button
            onClick={submit}
            disabled={saving}
            className="mt-5 w-full rounded-lg bg-[#c8103e] px-4 py-3 font-semibold text-white shadow-sm hover:bg-[#a50d33] active:bg-[#8a0b2b] disabled:opacity-60"
          >
            {saving ? "Enviando…" : "Enviar idea"}
          </button>
          {sentCount > 0 && (
            <p className="mt-3 text-center text-xs text-slate-400">
              Ya enviaste {sentCount} {sentCount === 1 ? "idea" : "ideas"}.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
