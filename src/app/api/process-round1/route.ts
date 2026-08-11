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

  // Preservar la curaduría: si al reprocesar un momento reaparece con el mismo
  // texto, mantené su marca "en vivo" (best-effort; si la IA lo reformula, no
  // coincide y simplemente se pierde la marca, sin romper nada).
  const { data: prev } = await supabaseAdmin
    .from("synthesis")
    .select("payload")
    .eq("round", 1)
    .maybeSingle();
  const liveKeys = new Set<string>();
  const prevThemes =
    (prev?.payload as {
      themes?: {
        themeId?: string;
        slides?: { moment?: string; live?: boolean }[];
      }[];
    } | null)?.themes ?? [];
  // Diapositivas previas por tema (para no pisar datos buenos si un reproceso
  // deja un tema vacío por un fallo transitorio de la IA).
  const prevSlidesByTheme = new Map<string, unknown[]>();
  for (const pt of prevThemes) {
    if (pt.themeId) prevSlidesByTheme.set(pt.themeId, pt.slides ?? []);
    for (const ps of pt.slides ?? [])
      if (ps.live) liveKeys.add(`${pt.themeId}::${(ps.moment || "").trim().toLowerCase()}`);
  }

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

    let slidesForTheme: unknown[] = [];
    try {
      const { slides } = await processRound1(theme.title, momentInputs);
      slidesForTheme = slides.map((s) =>
        liveKeys.has(`${theme.id}::${(s.moment || "").trim().toLowerCase()}`)
          ? { ...s, live: true }
          : s
      );
    } catch (e) {
      console.error(
        "R1 IA falló para",
        theme.id,
        e instanceof Error ? e.message : e
      );
      slidesForTheme = [];
    }

    // Si esta corrida quedó vacía pero antes había diapositivas, conservarlas.
    const prevSlides = prevSlidesByTheme.get(theme.id) ?? [];
    if (slidesForTheme.length === 0 && prevSlides.length > 0) {
      slidesForTheme = prevSlides;
    }

    themesOut.push({
      themeId: theme.id,
      themeTitle: theme.title,
      slides: slidesForTheme,
    });
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
