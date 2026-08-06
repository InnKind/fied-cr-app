import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { synthesizeResponses } from "@/lib/gemini";
import { ROUND_1_QUESTION } from "@/config/event";

// Cliente de Supabase del lado servidor.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  const round = Number(new URL(req.url).searchParams.get("round") || "1");

  // 1) Traer todas las respuestas de esa ronda.
  const { data: rows, error } = await supabase
    .from("responses")
    .select("answer")
    .eq("round", round);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const answers = (rows || []).map((r) => r.answer as string).filter(Boolean);
  if (answers.length === 0) {
    return NextResponse.json({ error: "No hay respuestas todavía." }, { status: 400 });
  }

  // 2) Pregunta de la ronda (por ahora Ronda 1).
  const question = ROUND_1_QUESTION.prompt;

  // 3) Síntesis con IA.
  try {
    const synthesis = await synthesizeResponses(question, answers);

    // 4) Guardar (best-effort: si aún no existe la tabla, igual devolvemos).
    const { error: upErr } = await supabase
      .from("synthesis")
      .upsert({ round, payload: synthesis }, { onConflict: "round" });
    if (upErr) console.error("No se pudo guardar la síntesis:", upErr.message);

    return NextResponse.json(synthesis);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
