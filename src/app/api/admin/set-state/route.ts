import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Cambia el estado del evento (ronda/fase). SOLO el admin, validado del lado
// servidor contra ADMIN_SECRET. Los participantes NO pueden llamar esto sin la clave.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { code, current_round, phase, validate } = body as {
    code?: string;
    current_round?: number;
    phase?: string;
    validate?: boolean;
  };

  const secret = process.env.ADMIN_SECRET;
  // Si hay ADMIN_SECRET configurado, exigirlo. (Si aún no, se permite: transición.)
  if (secret && code !== secret) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // Solo verificar la clave (para el login del panel).
  if (validate) {
    return NextResponse.json({ ok: true });
  }

  if (typeof current_round !== "number" || typeof phase !== "string") {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("event_state")
    .update({ current_round, phase, updated_at: new Date().toISOString() })
    .eq("id", 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
