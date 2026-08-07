"use client";

import { useEffect, useState } from "react";
import { THEMES } from "@/config/event";
import { supabase } from "@/lib/supabase";

// Fase THEME_SELECTION: la persona elige 1 de los 3 temas según su rol.
// Guarda el tema en participants.selected_theme. NO asigna mesa: eso lo hace
// el administrador en un paso posterior (distribución).
export default function ThemeSelection({
  participantId,
  role,
  accent,
}: {
  participantId: string;
  role?: string;
  accent?: string;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ¿Ya eligió tema esta persona? (resiliente a recargar la página)
  useEffect(() => {
    let active = true;
    supabase
      .from("participants")
      .select("selected_theme")
      .eq("id", participantId)
      .single()
      .then(({ data }) => {
        if (!active) return;
        setSelected((data?.selected_theme as string | null) ?? null);
        setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [participantId]);

  // Pone primero los temas que "calzan" con el rol.
  const themes = [...THEMES].sort((a, b) => {
    const af = role && a.roles.includes(role) ? 0 : 1;
    const bf = role && b.roles.includes(role) ? 0 : 1;
    return af - bf;
  });

  async function pick(themeId: string) {
    setSaving(true);
    setError(null);
    const { error: dbErr } = await supabase
      .from("participants")
      .update({ selected_theme: themeId })
      .eq("id", participantId);
    setSaving(false);
    if (dbErr) {
      setError("No se pudo guardar tu tema. Intenta de nuevo.");
      return;
    }
    setSelected(themeId);
  }

  if (!loaded) {
    return (
      <main className="flex-1 flex items-center justify-center p-6 bg-slate-50">
        <p className="text-slate-500">Cargando…</p>
      </main>
    );
  }

  // Ya eligió: confirmación + espera de asignación de mesa.
  if (selected) {
    const t = THEMES.find((x) => x.id === selected);
    return (
      <main className="flex-1 flex items-center justify-center p-6 bg-slate-50">
        <div className="w-full max-w-md text-center">
          {accent && (
            <span
              className="mb-4 inline-block h-3 w-3 rounded-full"
              style={{ backgroundColor: accent }}
            />
          )}
          <p className="text-sm text-slate-500">Tu tema</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900">{t?.title}</h2>
          <p className="mt-6 text-slate-600">
            ¡Listo! Espera un momento: te vamos a asignar una mesa.
          </p>
          <div className="mt-8 flex justify-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-blue-400 animate-bounce [animation-delay:-0.2s]" />
            <span className="h-2 w-2 rounded-full bg-blue-400 animate-bounce [animation-delay:-0.1s]" />
            <span className="h-2 w-2 rounded-full bg-blue-400 animate-bounce" />
          </div>
          <button
            onClick={() => setSelected(null)}
            className="mt-8 text-sm font-medium text-blue-700 underline underline-offset-2 hover:text-blue-800"
          >
            Cambiar de tema
          </button>
        </div>
      </main>
    );
  }

  // Selector de tema.
  return (
    <main className="flex-1 flex items-center justify-center p-6 bg-slate-50">
      <div className="w-full max-w-md">
        <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">
          Elige tu tema
        </p>
        <h2 className="mt-1 text-2xl font-bold text-slate-900">
          ¿Sobre qué quieres trabajar?
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          Elige el tema que mejor calza con tu rol.
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
        {error && (
          <p className="mt-3 text-sm font-medium text-red-600">{error}</p>
        )}
      </div>
    </main>
  );
}
