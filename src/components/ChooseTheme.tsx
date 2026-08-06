"use client";

import { useState } from "react";
import { THEMES } from "@/config/event";
import { supabase } from "@/lib/supabase";
import { assignTableForTheme } from "@/lib/tables";

// Acto 1: la persona elige el tema que calza con su rol; la app le asigna una mesa.
export default function ChooseTheme({
  participantId,
  role,
  onAssigned,
}: {
  participantId: string;
  role?: string;
  onAssigned?: (table: number, theme: string) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [assigned, setAssigned] = useState<{ table: number; theme: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Pone primero los temas que "calzan" con el rol.
  const themes = [...THEMES].sort((a, b) => {
    const af = role && a.roles.includes(role) ? 0 : 1;
    const bf = role && b.roles.includes(role) ? 0 : 1;
    return af - bf;
  });

  async function pick(themeId: string) {
    setSaving(true);
    setError(null);
    const { count } = await supabase
      .from("participants")
      .select("*", { count: "exact", head: true })
      .eq("r2_topic", themeId)
      .not("r2_table", "is", null);
    const table = assignTableForTheme(themeId, count ?? 0);
    if (table == null) {
      setError("Tema inválido.");
      setSaving(false);
      return;
    }
    const { error: dbErr } = await supabase
      .from("participants")
      .update({ r2_topic: themeId, r2_table: table })
      .eq("id", participantId);
    setSaving(false);
    if (dbErr) {
      setError("No se pudo asignar la mesa. Intentá de nuevo.");
      return;
    }
    setAssigned({ table, theme: themeId });
    onAssigned?.(table, themeId);
  }

  if (assigned) {
    const t = THEMES.find((x) => x.id === assigned.theme);
    return (
      <div className="w-full max-w-md text-center">
        <p className="text-sm text-slate-500">Tu tema</p>
        <h2 className="mt-1 text-xl font-bold text-slate-900">{t?.title}</h2>
        <p className="mt-6 text-slate-600">Andá a la</p>
        <p className="text-5xl font-bold text-blue-700">Mesa {assigned.table}</p>
        <p className="mt-6 text-sm text-slate-400">
          Ahí vas a trabajar el prototipo con tu grupo.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">
        Elegí tu tema
      </p>
      <h2 className="mt-1 text-2xl font-bold text-slate-900">
        ¿Sobre qué querés trabajar?
      </h2>
      <p className="mt-2 text-sm text-slate-500">
        Elegí el tema que mejor calza con tu rol.
      </p>
      <div className="mt-5 space-y-3">
        {themes.map((t) => {
          const fits = role && t.roles.includes(role);
          return (
            <button
              key={t.id}
              disabled={saving}
              onClick={() => pick(t.id)}
              className="w-full rounded-lg border border-slate-300 bg-white p-4 text-left shadow-sm transition hover:border-blue-400 hover:bg-blue-50 disabled:opacity-60"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold text-slate-900">{t.title}</h3>
                {fits && (
                  <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                    sugerido para tu rol
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-slate-500">{t.provocation}</p>
            </button>
          );
        })}
      </div>
      {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}
    </div>
  );
}
