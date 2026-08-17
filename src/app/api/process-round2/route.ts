import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { processRound2 } from "@/lib/gemini";
import { THEMES } from "@/config/event";

// Agregación de la Ronda 2 (SOLO admin). No se proyecta en vivo; es para
// análisis: nº por tema, distribución de roles de participantes, roles
// recurrentes a involucrar (IA) y experiencias por criterio (IA).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { code } = body as { code?: string };

  const secret = process.env.ADMIN_SECRET;
  if (secret && code !== secret) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { data: responses, error: rErr } = await supabaseAdmin
    .from("round2_responses")
    .select(
      "participant_id, selected_theme, motivating_idea, role_1, role_2, role_3, experience_text, cant_commit"
    );
  if (rErr) return NextResponse.json({ error: rErr.message }, { status: 500 });

  const { data: parts, error: pErr } = await supabaseAdmin
    .from("participants")
    .select("id, role");
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

  const roleOf = new Map<string, string>();
  for (const p of parts ?? []) roleOf.set(p.id as string, (p.role as string) ?? "");

  const all = responses ?? [];
  if (all.length === 0) {
    return NextResponse.json(
      { error: "No hay reflexiones de la Ronda 2 todavía." },
      { status: 400 }
    );
  }

  const themesOut: unknown[] = [];
  for (const theme of THEMES) {
    const inTheme = all.filter((r) => r.selected_theme === theme.id);
    if (inTheme.length === 0) continue;

    // Distribución de roles de los participantes que eligieron este tema.
    const roleDistribution: Record<string, number> = {};
    for (const r of inTheme) {
      const role = roleOf.get(r.participant_id as string) || "sin-rol";
      roleDistribution[role] = (roleDistribution[role] ?? 0) + 1;
    }

    const roles = inTheme
      .flatMap((r) => [r.role_1, r.role_2, r.role_3])
      .map((x) => (x as string | null)?.trim())
      .filter((x): x is string => !!x);
    const experiences = inTheme
      .map((r) => (r.experience_text as string | null)?.trim())
      .filter((x): x is string => !!x);
    const ideas = inTheme
      .map((r) => (r.motivating_idea as string | null)?.trim())
      .filter((x): x is string => !!x);

    let ai: {
      topRoles: { role: string; count: number }[];
      topIdeas: { idea: string; count: number }[];
      experiences: unknown;
    } = { topRoles: [], topIdeas: [], experiences: {} };
    try {
      ai = await processRound2(theme.title, roles, experiences, ideas);
    } catch (e) {
      ai = { topRoles: [], topIdeas: [], experiences: {} };
      console.error("R2 IA falló para", theme.id, e instanceof Error ? e.message : e);
    }

    themesOut.push({
      themeId: theme.id,
      themeTitle: theme.title,
      peopleCount: inTheme.length,
      roleDistribution,
      topRoles: ai.topRoles,
      topIdeas: ai.topIdeas,
      experiences: ai.experiences,
    });
  }

  // Conteo global de quienes eligieron "no puedo comprometerme" (Cambio #1).
  const cantCommitCount = all.filter((r) => r.cant_commit === true).length;

  const payload = { kind: "round2", themes: themesOut, cantCommitCount };
  const { error: upErr } = await supabaseAdmin
    .from("synthesis")
    .upsert({ round: 2, payload }, { onConflict: "round" });
  if (upErr) console.error("No se pudo guardar R2:", upErr.message);

  return NextResponse.json(payload);
}
