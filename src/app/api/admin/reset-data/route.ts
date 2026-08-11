import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Borra los DATOS del ejercicio (no el esquema) y reinicia el evento a WELCOME.
// SOLO admin (ADMIN_SECRET) y exige confirm:true. Útil para limpiar entre el
// ensayo y el evento real, o entre pruebas. NO borra facilitators.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { code, confirm } = body as { code?: string; confirm?: boolean };

  const secret = process.env.ADMIN_SECRET;
  if (secret && code !== secret) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (confirm !== true) {
    return NextResponse.json(
      { error: "Falta confirm:true (evita borrados accidentales)." },
      { status: 400 }
    );
  }

  const done: string[] = [];
  const failed: Record<string, string> = {};

  // Tablas con created_at: se borra todo con un filtro que matchea todas las filas.
  const byCreatedAt = [
    "idea_submissions",
    "moment_selections",
    "round2_responses",
    "table_images",
    "selected_moments",
    "participants",
    "presentation_items",
    "responses",
  ];
  for (const t of byCreatedAt) {
    const { error } = await supabaseAdmin
      .from(t)
      .delete()
      .gte("created_at", "1970-01-01T00:00:00Z");
    if (error) failed[t] = error.message;
    else done.push(t);
  }

  // Tablas con otras claves.
  {
    const { error } = await supabaseAdmin.from("synthesis").delete().gte("round", 0);
    if (error) failed["synthesis"] = error.message;
    else done.push("synthesis");
  }
  {
    const { error } = await supabaseAdmin
      .from("table_status")
      .delete()
      .gte("table_number", 0);
    if (error) failed["table_status"] = error.message;
    else done.push("table_status");
  }
  {
    const { error } = await supabaseAdmin
      .from("table_themes")
      .delete()
      .gte("table_number", 0);
    if (error) failed["table_themes"] = error.message;
    else done.push("table_themes");
  }

  // Reiniciar el estado del evento.
  const { error: esErr } = await supabaseAdmin
    .from("event_state")
    .update({ current_round: 0, phase: "WELCOME", updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (esErr) failed["event_state"] = esErr.message;

  return NextResponse.json({ ok: true, cleared: done, failed });
}
