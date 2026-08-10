"use client";

import { useEffect, useState } from "react";
import {
  EVENT,
  getPhase,
  normalizePhaseId,
  numberedThemeTitle,
} from "@/config/event";
import { themeForTable } from "@/lib/tables";
import { useEventState } from "@/hooks/useEventState";
import {
  getFacilitatorTable,
  setFacilitatorTable,
  clearFacilitatorTable,
} from "@/lib/facilitator";
import FacilitatorMoments from "@/components/FacilitatorMoments";
import FacilitatorPhotos from "@/components/FacilitatorPhotos";
import FacilitatorReady from "@/components/FacilitatorReady";

export default function FacilitatorPage() {
  const [table, setTable] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const eventState = useEventState();

  useEffect(() => {
    setTable(getFacilitatorTable());
    setLoaded(true);
  }, []);

  if (!loaded) {
    return (
      <main className="flex-1 flex items-center justify-center p-6 bg-slate-50">
        <p className="text-slate-500">Cargando…</p>
      </main>
    );
  }

  // Identificación de la mesa.
  if (table == null) {
    const enter = () => {
      const n = parseInt(input, 10);
      if (!input || Number.isNaN(n) || n < 1 || n > EVENT.numberOfTables) {
        setError(`Ingresa el número de tu mesa (1 a ${EVENT.numberOfTables}).`);
        return;
      }
      setFacilitatorTable(n);
      setTable(n);
    };
    return (
      <main className="flex-1 flex items-center justify-center p-6 bg-slate-50">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-bold text-slate-900">
            Panel del facilitador
          </h1>
          <p className="mt-2 text-slate-600">
            Ingresa el número de la mesa que vas a facilitar.
          </p>
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
            className="mt-4 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
          {error && (
            <p className="mt-3 text-sm font-medium text-red-600">{error}</p>
          )}
          <button
            onClick={enter}
            className="mt-4 w-full rounded-lg bg-slate-800 px-4 py-3 font-semibold text-white hover:bg-slate-900"
          >
            Entrar
          </button>
        </div>
      </main>
    );
  }

  const theme = themeForTable(table);
  const themeTitle = numberedThemeTitle(theme) || "—";
  const phaseLabel =
    getPhase(normalizePhaseId(eventState?.phase))?.label ?? "…";

  return (
    <main className="flex-1 p-6 bg-slate-50">
      <div className="mx-auto w-full max-w-lg">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              Mesa {table}
            </h1>
            <p className="text-sm text-slate-500">
              {themeTitle} · Fase: {phaseLabel}
            </p>
          </div>
          <button
            onClick={() => {
              clearFacilitatorTable();
              setTable(null);
              setInput("");
            }}
            className="shrink-0 text-sm font-medium text-slate-400 underline underline-offset-2 hover:text-slate-600"
          >
            Cambiar mesa
          </button>
        </div>

        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <FacilitatorMoments tableNumber={table} />
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <FacilitatorPhotos tableNumber={table} />
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <FacilitatorReady tableNumber={table} />
        </div>
      </div>
    </main>
  );
}
