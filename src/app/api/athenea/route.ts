import { NextRequest, NextResponse } from "next/server";
import { athenaAnswer } from "@/lib/athenea";

// Prueba/uso del cerebro de Athenea: POST /api/athenea?q=<pregunta>
export async function POST(req: NextRequest) {
  const q = new URL(req.url).searchParams.get("q") || "";
  if (!q.trim()) {
    return NextResponse.json({ error: "Falta la pregunta (?q=...)" }, { status: 400 });
  }
  try {
    const answer = await athenaAnswer(q);
    return NextResponse.json({ question: q, answer });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
