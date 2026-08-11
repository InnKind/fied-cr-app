import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { assignTables, type AssignInput } from "@/lib/assign";
import { TOTAL_TABLES } from "@/config/event";

// Dispara la distribución de mesas (SOLO admin). Lee a quienes eligieron tema,
// corre el algoritmo (src/lib/assign.ts) y guarda current_table de cada uno.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { code } = body as { code?: string };

  const secret = process.env.ADMIN_SECRET;
  if (secret && code !== secret) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { data: participants, error } = await supabaseAdmin
    .from("participants")
    .select("id, base_table, selected_theme, current_table")
    .not("selected_theme", "is", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Mapa mesa→tema de una distribución previa (para preservar y solo extender).
  const { data: tt } = await supabaseAdmin
    .from("table_themes")
    .select("table_number, theme");
  const existingMap: Record<number, string> = {};
  (tt ?? []).forEach((r) => {
    existingMap[r.table_number as number] = r.theme as string;
  });

  const { results, mapEntries } = assignTables(
    (participants ?? []) as AssignInput[],
    existingMap,
    TOTAL_TABLES
  );

  // Guardar el tema de las mesas nuevas (para que el facilitador/archivo lo lean).
  if (mapEntries.length > 0) {
    await supabaseAdmin
      .from("table_themes")
      .upsert(mapEntries, { onConflict: "table_number" });
  }

  // Escribir current_table en lotes para no abrir demasiadas conexiones a la vez.
  let assigned = 0;
  const CHUNK = 25;
  for (let i = 0; i < results.length; i += CHUNK) {
    const slice = results.slice(i, i + CHUNK);
    const res = await Promise.all(
      slice.map((u) =>
        supabaseAdmin
          .from("participants")
          .update({ current_table: u.current_table })
          .eq("id", u.id)
      )
    );
    assigned += res.filter((r) => !r.error).length;
  }

  const tablesUsed = Object.keys(existingMap).length + mapEntries.length;
  return NextResponse.json({
    ok: true,
    assigned,
    total: (participants ?? []).length,
    newlyPlaced: results.length,
    tablesUsed,
  });
}
