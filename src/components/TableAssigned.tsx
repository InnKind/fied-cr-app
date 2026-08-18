"use client";

import { useEffect, useState } from "react";
import { THEMES, EVENT, numberedThemeTitle } from "@/config/event";
import { supabase } from "@/lib/supabase";
import { BRAND_BG } from "@/lib/brand";
import BrandLogo from "@/components/BrandLogo";
import { recoverOrphanIdentity } from "@/lib/participant";
import { themeForTableNumber } from "@/lib/theme-for-table";

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
      .maybeSingle()
      .then(({ data, error: qErr }) => {
        if (!active) return;
        // Mi fila ya no existe (reset con la pantalla abierta) → re-registrarse.
        if (!qErr && !data) return recoverOrphanIdentity();
        const t = (data?.current_table as number | null) ?? null;
        setTable(t);
        setTheme((data?.selected_theme as string | null) ?? null);
        setLoaded(true);
        // El tema que manda es el de la MESA a la que va (si se cambió de mesa,
        // o si llegó tarde y nunca eligió tema, su elección puede no calzar).
        if (t != null)
          themeForTableNumber(t).then((deMesa) => {
            if (active && deMesa) setTheme(deMesa);
          });
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
    const { data: rows, error: dbErr } = await supabase
      .from("participants")
      .update({ current_table: n })
      .eq("id", participantId)
      .select("id");
    setSaving(false);
    if (dbErr) {
      setError("No se pudo actualizar. Intenta de nuevo.");
      return;
    }
    // 0 filas y sin error = id huérfano (la base se reseteó).
    if (!rows || rows.length === 0) return recoverOrphanIdentity();
    setTable(n);
    setEditing(false);
    setInput("");
  }

  if (!loaded) {
    return (
      <main className="flex-1 flex items-center justify-center p-6" style={{ background: BRAND_BG }}>
        <p className="text-white/80">Cargando…</p>
      </main>
    );
  }

  const t = THEMES.find((x) => x.id === theme);

  // Corrección manual de mesa.
  if (editing) {
    return (
      <main className="flex-1 flex items-center justify-center p-6" style={{ background: BRAND_BG }}>
        <div className="w-full max-w-sm text-center">
          <BrandLogo className="mx-auto mb-6" />
          <h1 className="text-xl font-semibold text-white">
            ¿En qué mesa estás realmente?
          </h1>
          <div className="mt-4 rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-black/5">
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
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-center text-lg text-slate-900 shadow-sm focus:border-[#0c7d75] focus:outline-none focus:ring-2 focus:ring-[#0c7d75]/30"
            />
            {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}
            <button
              onClick={saveTable}
              disabled={saving}
              className="mt-4 w-full rounded-lg bg-[#c8103e] px-4 py-3 font-semibold text-white shadow-sm hover:bg-[#a50d33] active:bg-[#8a0b2b] disabled:opacity-60"
            >
              {saving ? "Guardando…" : "Guardar mi mesa"}
            </button>
          </div>
          <button
            onClick={() => {
              setEditing(false);
              setError(null);
            }}
            className="mt-3 text-sm font-medium text-white/70 hover:text-white"
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
      <main className="flex-1 flex items-center justify-center p-6" style={{ background: BRAND_BG }}>
        <div className="w-full max-w-sm text-center">
          <BrandLogo className="mx-auto mb-6" />
          {accent && (
            <span
              className="mb-4 inline-block h-3 w-3 rounded-full"
              style={{ backgroundColor: accent }}
            />
          )}
          <h1 className="text-xl font-semibold text-white">
            Aún no tienes mesa
          </h1>
          <p className="mt-3 text-white/80">
            No apareces en ninguna mesa. Acércate a un organizador para que te
            ubique en la mesa de tu tema. Cuando sepas tu número de mesa,
            ingrésalo aquí.
          </p>
          <button
            onClick={() => setEditing(true)}
            className="mt-6 rounded-lg bg-[#c8103e] px-4 py-3 font-semibold text-white shadow-sm hover:bg-[#a50d33] active:bg-[#8a0b2b]"
          >
            Ingresar mi mesa
          </button>
        </div>
      </main>
    );
  }

  // Mesa asignada.
  return (
    <main className="flex-1 flex items-center justify-center p-6" style={{ background: BRAND_BG }}>
      <div className="w-full max-w-sm text-center">
        <BrandLogo className="mx-auto mb-6" />
        {accent && (
          <span
            className="mb-4 inline-block h-3 w-3 rounded-full"
            style={{ backgroundColor: accent }}
          />
        )}
        {t && <p className="text-sm text-white/80">{numberedThemeTitle(t.id)}</p>}
        <p className="mt-6 text-white/80">Ve a la</p>
        <p className="text-6xl font-bold text-white">Mesa {table}</p>
        <p className="mt-6 text-sm text-white/60">
          Ahí vas a trabajar con tu grupo.
        </p>
        <p className="mt-2 text-sm text-white/60">
          Si necesitas cambiar de mesa, busca a un facilitador.
        </p>
        <button
          onClick={() => {
            setInput(String(table));
            setEditing(true);
          }}
          className="mt-8 text-sm font-medium text-teal-200 underline underline-offset-2 hover:text-teal-100"
        >
          Cambiar de mesa.
        </button>
      </div>
    </main>
  );
}
