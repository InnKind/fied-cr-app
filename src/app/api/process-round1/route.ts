import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { processRound1, type MomentInput } from "@/lib/gemini";
import { THEMES } from "@/config/event";

// Procesamiento de la Ronda 1 (coffee break, SOLO admin): reúne los momentos y
// las ideas por tema, corre la IA (agrupa momentos + arma diapositivas con 3
// ideas de IA y 3 de Agency por criterio) y guarda el resultado en `synthesis`.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { code } = body as { code?: string };

  const secret = process.env.ADMIN_SECRET;
  if (secret && code !== secret) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { data: moments, error: mErr } = await supabaseAdmin
    .from("selected_moments")
    .select("id, table_number, theme, text");
  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 });

  const { data: ideas, error: iErr } = await supabaseAdmin
    .from("idea_submissions")
    .select("moment_id, theme, ai_text, agency_text");
  if (iErr) return NextResponse.json({ error: iErr.message }, { status: 500 });

  const allMoments = moments ?? [];
  const allIdeas = ideas ?? [];

  const themesOut: unknown[] = [];
  for (const theme of THEMES) {
    const tMoments = allMoments.filter((m) => m.theme === theme.id);
    if (tMoments.length === 0) continue;

    const momentInputs: MomentInput[] = tMoments.map((m) => {
      const mi = allIdeas.filter((x) => x.moment_id === m.id);
      return {
        table: (m.table_number as number | null) ?? null,
        text: m.text as string,
        aiIdeas: mi
          .map((x) => x.ai_text as string | null)
          .filter((t): t is string => !!t),
        agencyIdeas: mi
          .map((x) => x.agency_text as string | null)
          .filter((t): t is string => !!t),
      };
    });

    try {
      const { slides } = await processRound1(theme.title, momentInputs);
      themesOut.push({ themeId: theme.id, themeTitle: theme.title, slides });
    } catch (e) {
      themesOut.push({
        themeId: theme.id,
        themeTitle: theme.title,
        slides: [],
        error: e instanceof Error ? e.message : "error",
      });
    }
  }

  if (themesOut.length === 0) {
    return NextResponse.json(
      { error: "No hay momentos para procesar todavía." },
      { status: 400 }
    );
  }

  const payload = { kind: "round1", themes: themesOut };
  const { error: upErr } = await supabaseAdmin
    .from("synthesis")
    .upsert({ round: 1, payload }, { onConflict: "round" });
  if (upErr) console.error("No se pudo guardar el procesamiento:", upErr.message);

  return NextResponse.json(payload);
}
