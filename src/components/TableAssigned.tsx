"use client";

import { useEffect, useState } from "react";
import { THEMES, EVENT } from "@/config/event";
import { supabase } from "@/lib/supabase";

// Fase TABLE_ASSIGNED: muestra la mesa asignada + permite corregirla a mano
// ("no estoy en esa mesa"). Lee current_table/selected_theme desde la base.
export default function TableAssigned({
  participantId,
  accent,
}: {
  participantId: string;
  accent?: string;
}) {
  const [table, setTable] = useState<number | null>(null);
  const [theme, setTheme] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    supabase
      .from("participants")
      .select("current_table, selected_theme")
      .eq("id", participantId)
      .single()
      .then(({ data }) => {
        if (!active) return;
        setTable((data?.current_table as number | null) ?? null);
        setTheme((data?.selected_theme as string | null) ?? null);
        setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [participantId]);

  async function saveTable() {
    const n = parseInt(input, 10);
    if (!input || Number.isNaN(n) || n < 1 || n > EVENT.numberOfTables) {
      setError(`Ingresa un número de mesa (1 a ${EVENT.numberOfTables}).`);
      return;
    }
    setSaving(true);
    setError(null);
    const { error: dbErr } = await supabase
      .from("participants")
      .update({ current_table: n })
      .eq("id", participantId);
    setSaving(false);
    if (dbErr) {
      setError("No se pudo actualizar. Intenta de nuevo.");
      return;
    }
    setTable(n);
    setEditing(false);
    setInput("");
  }

  if (!loaded) {
    return (
      <main className="flex-1 flex items-center justify-center p-6 bg-slate-50">
        <p className="text-slate-500">Cargando…</p>
      </main>
    );
  }

  const t = THEMES.find((x) => x.id === theme);

  // Corrección manual de mesa.
  if (editing) {
    return (
      <main className="flex-1 flex items-center justify-center p-6 bg-slate-50">
        <div className="w-full max-w-sm text-center">
          <h1 className="text-xl font-semibold text-slate-800">
            ¿En qué mesa estás realmente?
          </h1>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={EVENT.numberOfTables}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setError(null);
            }}
            placeholder="Ej: 7"
            className="mt-4 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-center text-lg text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
          {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}
          <button
            onClick={saveTable}
            disabled={saving}
            className="mt-4 w-full rounded-lg bg-blue-700 px-4 py-3 font-semibold text-white shadow-sm hover:bg-blue-800 disabled:opacity-60"
          >
            {saving ? "Guardando…" : "Guardar mi mesa"}
          </button>
          <button
            onClick={() => {
              setEditing(false);
              setError(null);
            }}
            className="mt-3 text-sm font-medium text-slate-500 hover:text-slate-700"
          >
            Cancelar
          </button>
        </div>
      </main>
    );
  }

  // Sin mesa aún (p. ej. llegó tarde y no entró en la distribución).
  if (table == null) {
    return (
      <main className="flex-1 flex items-center justify-center p-6 bg-slate-50">
        <div className="w-full max-w-sm text-center">
          {accent && (
            <span
              className="mb-4 inline-block h-3 w-3 rounded-full"
              style={{ backgroundColor: accent }}
            />
          )}
          <h1 className="text-xl font-semibold text-slate-800">
            Aún no tienes mesa
          </h1>
          <p className="mt-3 text-slate-600">
            Acércate a un organizador para que te ubique, o ingresa tu mesa aquí.
          </p>
          <button
            onClick={() => setEditing(true)}
            className="mt-6 rounded-lg bg-blue-700 px-4 py-3 font-semibold text-white shadow-sm hover:bg-blue-800"
          >
            Ingresar mi mesa
          </button>
        </div>
      </main>
    );
  }

  // Mesa asignada.
  return (
    <main className="flex-1 flex items-center justify-center p-6 bg-slate-50">
      <div className="w-full max-w-sm text-center">
        {accent && (
          <span
            className="mb-4 inline-block h-3 w-3 rounded-full"
            style={{ backgroundColor: accent }}
          />
        )}
        {t && <p className="text-sm text-slate-500">Tu tema: {t.title}</p>}
        <p className="mt-6 text-slate-600">Ve a la</p>
        <p className="text-6xl font-bold text-blue-700">Mesa {table}</p>
        <p className="mt-6 text-sm text-slate-400">
          Ahí vas a trabajar con tu grupo. Sigue al facilitador.
        </p>
        <button
          onClick={() => {
            setInput(String(table));
            setEditing(true);
          }}
          className="mt-8 text-sm font-medium text-blue-700 underline underline-offset-2 hover:text-blue-800"
        >
          No estoy en esa mesa
        </button>
      </div>
    </main>
  );
}
