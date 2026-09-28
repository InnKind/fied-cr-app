import { NextRequest, NextResponse } from "next/server";
import { hasServiceRole, supabaseAdmin } from "@/lib/supabase-admin";
import { checkStandKey } from "@/lib/stand-server";
import { END_STEP, PRE_STEP, SESSION } from "@/config/stand";

// Cambia el paso de la sesión del stand. Lo llama /stand/pantalla con ?k=CLAVE
// (el clicker de Adriana o el control a distancia de Jerónimo). La clave se
// valida contra STAND_SECRET y la escritura usa service role (el público solo lee).
// Body: { session, step, k, base_updated_at }  ·  { k, validate: true } solo verifica la clave.
//
// base_updated_at = el último updated_at de stand_state que vio la pantalla (tal
// cual lo recibió). Si en la base hay uno más nuevo, otro controlador movió la
// sesión después: se responde 409 con el paso guardado y NO se pisa. Así un
// envío viejo (reintento tras un corte, doble clic que llega desordenado, la TV
// que se recargó) no hace saltar a toda la sala hacia atrás.

type StateRow = { step: number; updated_at: string | null };

const ms = (s: string | null | undefined) => {
  const n = s ? Date.parse(s) : NaN;
  return Number.isFinite(n) ? n : 0;
};

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    session?: unknown;
    step?: unknown;
    k?: unknown;
    validate?: unknown;
    base_updated_at?: unknown;
  };

  const auth = checkStandKey(body.k);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });
  }

  if (body.validate === true) {
    return NextResponse.json({ ok: true, serviceRole: hasServiceRole, keySource: auth.source });
  }

  if (body.session !== SESSION) {
    return NextResponse.json({ error: "Sesión inválida.", code: "bad-session" }, { status: 400 });
  }
  const step = body.step;
  if (typeof step !== "number" || !Number.isInteger(step) || step < PRE_STEP || step > END_STEP) {
    return NextResponse.json({ error: "Paso inválido.", code: "bad-step" }, { status: 400 });
  }
  const base = body.base_updated_at;
  if (
    base !== undefined &&
    base !== null &&
    (typeof base !== "string" || base.length > 64 || !ms(base))
  ) {
    return NextResponse.json({ error: "Versión inválida.", code: "bad-base" }, { status: 400 });
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

  // Siempre más nuevo que la versión que vio la pantalla (aunque los relojes de
  // dos servidores difieran unos milisegundos).
  const updated_at = new Date(Math.max(Date.now(), ms(base as string | null) + 1)).toISOString();

  if (typeof base === "string") {
    // Actualización condicional: solo si nadie la cambió después de `base`.
    const { data, error } = await supabaseAdmin
      .from("stand_state")
      .update({ step, updated_at })
      .eq("session", SESSION)
      .lte("updated_at", base)
      .select("step, updated_at");
    if (error) {
      return NextResponse.json({ error: error.message, code: "db" }, { status: 500 });
    }
    const saved = (data ?? []) as StateRow[];
    if (saved.length > 0) {
      return NextResponse.json({ ok: true, step, updated_at: saved[0].updated_at ?? updated_at });
    }
    // No se actualizó: o alguien la movió después, o la fila no existe.
    const cur = await supabaseAdmin
      .from("stand_state")
      .select("step, updated_at")
      .eq("session", SESSION)
      .maybeSingle();
    if (cur.error) {
      return NextResponse.json({ error: cur.error.message, code: "db" }, { status: 500 });
    }
    const row = cur.data as StateRow | null;
    if (row && row.updated_at) {
      return NextResponse.json(
        {
          error: "Otro controlador movió la sesión.",
          code: "conflict",
          step: row.step,
          updated_at: row.updated_at,
        },
        { status: 409 }
      );
    }
    // Sin fila (o sin fecha): se crea abajo.
  }

  const { data, error } = await supabaseAdmin
    .from("stand_state")
    .upsert({ session: SESSION, step, updated_at }, { onConflict: "session" })
    .select("step, updated_at");

  if (error) {
    return NextResponse.json({ error: error.message, code: "db" }, { status: 500 });
  }
  const saved = (data ?? []) as StateRow[];
  return NextResponse.json({ ok: true, step, updated_at: saved[0]?.updated_at ?? updated_at });
}
