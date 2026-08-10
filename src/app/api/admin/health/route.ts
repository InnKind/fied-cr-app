import { NextResponse } from "next/server";
import { hasServiceRole } from "@/lib/supabase-admin";

// Chequeo de salud de la seguridad (solo booleanos, sin exponer secretos).
// Sirve para verificar que las variables quedaron configuradas en Vercel ANTES
// de cerrar las políticas de la base.
export async function GET() {
  return NextResponse.json({
    serviceRole: hasServiceRole,
    adminSecret: !!process.env.ADMIN_SECRET,
  });
}
