import { NextRequest, NextResponse } from "next/server";
import { hasServiceRole, supabaseAdmin } from "@/lib/supabase-admin";
import { checkStandKey } from "@/lib/stand-server";
import { END_STEP, PRE_STEP, SESSION } from "@/config/stand";

// Cambia el paso de la sesión del stand. Lo llama /stand/pantalla con ?k=CLAVE
// (el clicker de Adriana o el control a distancia de Jerónimo). La clave se
// valida contra ADMIN_SECRET y la escritura usa service role (el público solo lee).
// Body: { session, step, k }  ·  { k, validate: true } solo verifica la clave.
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    session?: unknown;
    step?: unknown;
    k?: unknown;
    validate?: unknown;
  };

  const auth = checkStandKey(body.k);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });
  }

  if (body.validate === true) {
    return NextResponse.json({ ok: true, serviceRole: hasServiceRole });
  }

  if (body.session !== SESSION) {
    return NextResponse.json({ error: "Sesión inválida.", code: "bad-session" }, { status: 400 });
  }
  const step = body.step;
  if (typeof step !== "number" || !Number.isInteger(step) || step < PRE_STEP || step > END_STEP) {
    return NextResponse.json({ error: "Paso inválido.", code: "bad-step" }, { status: 400 });
  }
  if (!hasServiceRole) {
    return NextResponse.json(
      {
        error: "Falta configurar SUPABASE_SERVICE_ROLE en el servidor.",
        code: "no-service-role",
      },
      { status: 503 }
    );
  }

  const updated_at = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from("stand_state")
    .upsert({ session: SESSION, step, updated_at }, { onConflict: "session" });

  if (error) {
    return NextResponse.json({ error: error.message, code: "db" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, step, updated_at });
}
