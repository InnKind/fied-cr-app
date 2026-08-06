"use client";

import { useState } from "react";
import { ROUND_1_QUESTION } from "@/config/event";
import { supabase } from "@/lib/supabase";

// Ronda 1: cada persona escribe UNA respuesta individual a la pregunta.
export default function RoundOne({
  participantId,
  onSubmitted,
}: {
  participantId: string;
  onSubmitted: () => void;
}) {
  const [answer, setAnswer] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (answer.trim().length < 3) {
      setError("Escribí tu respuesta antes de enviar.");
      return;
    }
    setSaving(true);
    setError(null);
    const { error: dbError } = await supabase.from("responses").insert({
      participant_id: participantId,
      round: 1,
      question_id: ROUND_1_QUESTION.id,
      answer: answer.trim(),
    });
    setSaving(false);
    if (dbError) {
      setError("No se pudo enviar. Intentá de nuevo.");
      return;
    }
    onSubmitted();
  }

  return (
    <main className="flex-1 flex items-center justify-center p-6 bg-slate-50">
      <div className="w-full max-w-md">
        <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">
          Ronda 1 · Respuesta individual
        </p>
        <h1 className="mt-2 text-xl font-bold leading-snug text-slate-900">
          {ROUND_1_QUESTION.prompt}
        </h1>
        <p className="mt-3 text-sm text-slate-500">
          Pensalo un momento a solas y escribí tu respuesta. Después la conversás
          con tu mesa.
        </p>

        <textarea
          value={answer}
          onChange={(e) => {
            setAnswer(e.target.value);
            setError(null);
          }}
          rows={6}
          placeholder="Escribí tu respuesta…"
          className="mt-5 w-full resize-none rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
        />

        {error && (
          <p className="mt-3 text-sm font-medium text-red-600">{error}</p>
        )}

        <button
          onClick={submit}
          disabled={saving}
          className="mt-4 w-full rounded-lg bg-blue-700 px-4 py-3 font-semibold text-white shadow-sm transition hover:bg-blue-800 active:bg-blue-900 disabled:opacity-60"
        >
          {saving ? "Enviando…" : "Enviar respuesta"}
        </button>
      </div>
    </main>
  );
}
