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

  // Bloques previos por tema: si un reproceso deja un tema vacío por un fallo
  // transitorio de la IA, se conservan los datos buenos (igual que en R1).
  const { data: prev } = await supabaseAdmin
    .from("synthesis")
    .select("payload")
    .eq("round", 2)
    .maybeSingle();
  const prevByTheme = new Map<string, Record<string, unknown>>();
  for (const pt of ((prev?.payload as { themes?: Record<string, unknown>[] } | null)
    ?.themes ?? [])) {
    const id = pt?.themeId as string | undefined;
    if (id) prevByTheme.set(id, pt);
  }
  const isEmptyBlock = (b: {
    topRoles?: unknown[];
    topIdeas?: unknown[];
    ideaCriteria?: unknown;
    experiences?: unknown;
  }) => {
    const hasText = (t: unknown) =>
      !!t &&
      typeof t === "object" &&
      Object.values(t as Record<string, unknown>).some(
        (v) => typeof v === "string" && v.trim()
      );
    return (
      (b.topRoles?.length ?? 0) === 0 &&
      (b.topIdeas?.length ?? 0) === 0 &&
      !hasText(b.ideaCriteria) &&
      !hasText(b.experiences)
    );
  };

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
      ideaCriteria: unknown;
      experiences: unknown;
    } = { topRoles: [], topIdeas: [], ideaCriteria: {}, experiences: {} };
    try {
      ai = await processRound2(theme.title, roles, experiences, ideas);
    } catch (e) {
      ai = { topRoles: [], topIdeas: [], ideaCriteria: {}, experiences: {} };
      console.error("R2 IA falló para", theme.id, e instanceof Error ? e.message : e);
    }

    const block = {
      themeId: theme.id,
      themeTitle: theme.title,
      peopleCount: inTheme.length,
      roleDistribution,
      topRoles: ai.topRoles,
      topIdeas: ai.topIdeas,
      ideaCriteria: ai.ideaCriteria,
      experiences: ai.experiences,
    };

    // La IA no devolvió nada útil en esta corrida: si antes había análisis de
    // este tema, se conserva (solo se actualizan los conteos, que no dependen
    // de la IA). Así reprocesar nunca borra lo que ya estaba bien.
    const prevBlock = prevByTheme.get(theme.id);
    if (isEmptyBlock(block) && prevBlock && !isEmptyBlock(prevBlock)) {
      themesOut.push({
        ...prevBlock,
        themeTitle: theme.title,
        peopleCount: inTheme.length,
        roleDistribution,
      });
      console.warn("R2: se conservó el análisis previo del tema", theme.id);
    } else {
      themesOut.push(block);
    }
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
