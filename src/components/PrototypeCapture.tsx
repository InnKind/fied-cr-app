"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

// Esqueleto de la captura del prototipo (la llena el facilitador de la mesa).
// Los campos son un PLACEHOLDER de la plantilla "user experience journey" +
// quitar/agregar (la plantilla final está POR DEFINIR).
const FIELDS: { key: string; label: string; hint: string }[] = [
  { key: "usuario", label: "¿Quién es el usuario central?", hint: "La persona en el centro de la experiencia." },
  { key: "momentos", label: "Momentos / touchpoints de la experiencia", hint: "El recorrido del usuario en el tiempo (un día, una semana…)." },
  { key: "problemas", label: "Cuellos de botella / problemas", hint: "Dónde se traba la experiencia hoy." },
  { key: "quitar", label: "¿Qué QUITAR?", hint: "" },
  { key: "agregar", label: "¿Qué AGREGAR?", hint: "" },
  { key: "solucion", label: "El prototipo / solución (resumen)", hint: "La propuesta concreta de la mesa." },
];

export default function PrototypeCapture({
  participantId,
  table,
  theme,
}: {
  participantId: string;
  table?: number;
  theme?: string;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(key: string, v: string) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  async function save() {
    setSaving(true);
    setError(null);
    const payload = { table: table ?? null, ...values };
    const { error: e } = await supabase.from("responses").insert({
      participant_id: participantId,
      round: 2,
      question_id: "prototipo",
      topic_id: theme ?? null,
      answer: JSON.stringify(payload),
    });
    setSaving(false);
    if (e) {
      setError("No se pudo guardar. Intenta de nuevo.");
      return;
    }
    setSaved(true);
  }

  if (saved) {
    return (
      <div className="w-full max-w-md text-center">
        <h2 className="text-2xl font-semibold text-slate-800">¡Prototipo guardado!</h2>
        <p className="mt-2 text-slate-600">Gracias. La IA lo va a incluir en el resumen.</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">
        Facilitador · Resumen del prototipo{table ? ` · Mesa ${table}` : ""}
      </p>
      <h2 className="mt-1 text-2xl font-bold text-slate-900">Resume el prototipo de tu mesa</h2>
      <p className="mt-1 text-xs text-slate-400">
        (Plantilla provisional — los campos finales están por definir.)
      </p>

      <div className="mt-5 space-y-4">
        {FIELDS.map((f) => (
          <div key={f.key}>
            <label className="block text-sm font-medium text-slate-700">{f.label}</label>
            {f.hint && <p className="text-xs text-slate-400">{f.hint}</p>}
            <textarea
              value={values[f.key] ?? ""}
              onChange={(e) => set(f.key, e.target.value)}
              rows={2}
              className="mt-1 w-full resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
        ))}
      </div>

      {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}

      <button
        onClick={save}
        disabled={saving}
        className="mt-5 w-full rounded-lg bg-blue-700 px-4 py-3 font-semibold text-white shadow-sm transition hover:bg-blue-800 active:bg-blue-900 disabled:opacity-60"
      >
        {saving ? "Guardando…" : "Guardar prototipo"}
      </button>
    </div>
  );
}
