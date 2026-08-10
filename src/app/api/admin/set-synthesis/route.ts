import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Guarda el payload de synthesis (round 1) — lo usa la curaduría para marcar
// qué diapositivas se muestran en vivo. SOLO admin (ADMIN_SECRET).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { code, payload } = body as { code?: string; payload?: unknown };

  const secret = process.env.ADMIN_SECRET;
  if (secret && code !== secret) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ error: "Falta el payload." }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("synthesis")
    .upsert({ round: 1, payload }, { onConflict: "round" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
