"use client";

import { useState } from "react";
import { ROLES, EVENT } from "@/config/event";
import { supabase } from "@/lib/supabase";
import { setParticipant } from "@/lib/participant";
import { BRAND_BG } from "@/lib/brand";

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
    <main
      className="flex-1 flex items-center justify-center p-6"
      style={{ background: BRAND_BG }}
    >
      <div className="w-full max-w-md">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/fied-logo.png"
          alt="FIEd Costa Rica"
          className="h-16 w-auto drop-shadow"
        />
        <h1 className="mt-7 text-3xl font-bold leading-tight text-white sm:text-4xl">
          {EVENT.exerciseTitle}
        </h1>
        <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-white/80">
          Vamos a construir juntos, mesa por mesa, ideas sobre la educación
          superior de calidad en la era de la IA. Empecemos.
        </p>

        <div className="mt-7 rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-black/5">
          <div>
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
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm focus:border-[#0c7d75] focus:outline-none focus:ring-2 focus:ring-[#0c7d75]/30"
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
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm focus:border-[#0c7d75] focus:outline-none focus:ring-2 focus:ring-[#0c7d75]/30"
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
            className="mt-6 w-full rounded-lg bg-[#c8103e] px-4 py-3 font-semibold text-white shadow-sm transition hover:bg-[#a50d33] active:bg-[#8a0b2b] disabled:opacity-60"
          >
            {saving ? "Entrando…" : "Entrar"}
          </button>
        </div>

        <p className="mt-5 text-center text-xs text-white/50">
          Inn.Kind · FIEd Costa Rica
        </p>
      </div>
    </main>
  );
}
