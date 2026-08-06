"use client";

import { useState } from "react";
import { ROLES, EVENT } from "@/config/event";
import { supabase } from "@/lib/supabase";
import { setParticipant } from "@/lib/participant";

// Pantalla de bienvenida + registro anónimo: rol + número de mesa.
export default function Register({ onRegistered }: { onRegistered: () => void }) {
  const [role, setRole] = useState("");
  const [table, setTable] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleEnter() {
    if (!role) {
      setError("Elige tu rol para continuar.");
      return;
    }
    const tableNum = parseInt(table, 10);
    if (!table || Number.isNaN(tableNum) || tableNum < 1 || tableNum > EVENT.numberOfTables) {
      setError(`Ingresa tu número de mesa (1 a ${EVENT.numberOfTables}).`);
      return;
    }

    setSaving(true);
    setError(null);
    const { data, error: dbError } = await supabase
      .from("participants")
      .insert({ role, base_table: tableNum })
      .select("id")
      .single();
    setSaving(false);

    if (dbError || !data) {
      setError("No se pudo guardar. Revisa tu conexión e intenta de nuevo.");
      return;
    }

    setParticipant(data.id, role);
    onRegistered();
  }

  return (
    <main className="flex-1 flex items-center justify-center p-6 bg-slate-50">
      <div className="w-full max-w-md">
        <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">
          {EVENT.name}
        </p>
        <h1 className="mt-1 text-3xl font-bold text-slate-900">
          {EVENT.exerciseTitle}
        </h1>
        <p className="mt-3 text-slate-600">
          Vamos a construir juntos, mesa por mesa, ideas sobre la educación
          superior de calidad en la era de la IA. Empecemos.
        </p>

        <div className="mt-8">
          <label htmlFor="role" className="block text-sm font-medium text-slate-700">
            ¿Cuál es tu rol en el sistema de educación superior?
          </label>
          <select
            id="role"
            value={role}
            onChange={(e) => {
              setRole(e.target.value);
              setError(null);
            }}
            className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          >
            <option value="" disabled>
              Selecciona tu rol…
            </option>
            {ROLES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-5">
          <label htmlFor="table" className="block text-sm font-medium text-slate-700">
            ¿En qué número de mesa estás?
          </label>
          <input
            id="table"
            type="number"
            inputMode="numeric"
            min={1}
            max={EVENT.numberOfTables}
            value={table}
            onChange={(e) => {
              setTable(e.target.value);
              setError(null);
            }}
            placeholder="Ej: 7"
            className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
          <p className="mt-2 text-xs text-slate-400">
            Es anónimo: no pedimos tu nombre ni tu correo.
          </p>
        </div>

        {error && (
          <p className="mt-4 text-sm font-medium text-red-600">{error}</p>
        )}

        <button
          onClick={handleEnter}
          disabled={saving}
          className="mt-6 w-full rounded-lg bg-blue-700 px-4 py-3 font-semibold text-white shadow-sm transition hover:bg-blue-800 active:bg-blue-900 disabled:opacity-60"
        >
          {saving ? "Entrando…" : "Entrar"}
        </button>
      </div>
    </main>
  );
}
