"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { onForeground } from "@/lib/realtime";
import { numberedThemeTitle } from "@/config/event";
import { themeForTable } from "@/lib/tables";

type Moment = { id: string; ord: number; text: string };

// Facilitador: registra los 3 momentos ganadores de su mesa y luego ve, en vivo,
// cuántos participantes eligieron cada uno.
export default function FacilitatorMoments({
  tableNumber,
}: {
  tableNumber: number;
}) {
  const [moments, setMoments] = useState<Moment[] | null>(null); // null = cargando
  const [inputs, setInputs] = useState(["", "", ""]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});

  const theme = themeForTable(tableNumber);
  const themeTitle = numberedThemeTitle(theme);

  const loadMoments = useCallback(async () => {
    const { data, error } = await supabase
      .from("selected_moments")
      .select("id, ord, text")
      .eq("table_number", tableNumber)
      .order("ord");
    if (error) {
      // Ante error: no colgar en "Cargando…" en el primer load (muestra el
      // formulario con []), pero no pisar una lista buena con [] en una recarga
      // transitoria (deja la que ya había).
      setMoments((prev) => prev ?? []);
      return;
    }
    setMoments((data as Moment[]) ?? []);
  }, [tableNumber]);

  useEffect(() => {
    loadMoments();
    // En vivo: si otro dispositivo (o esta misma tras un guardado cuya respuesta
    // se perdió) registra los momentos, esta pantalla pasa sola a modo conteo,
    // así el formulario desaparece y no se puede insertar un segundo set.
    const channel = supabase
      .channel(`rt-selmoments-${tableNumber}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "selected_moments",
          filter: `table_number=eq.${tableNumber}`,
        },
        () => loadMoments()
      )
      .subscribe();
    const stop = onForeground(loadMoments);
    return () => {
      supabase.removeChannel(channel);
      stop();
    };
  }, [tableNumber, loadMoments]);

  // Conteo en vivo de selecciones por momento.
  const loadCounts = useCallback(async (ids: string[]) => {
    if (!ids.length) {
      setCounts({});
      return;
    }
    const { data } = await supabase
      .from("moment_selections")
      .select("moment_id")
      .in("moment_id", ids);
    const c: Record<string, number> = {};
    ((data as { moment_id: string }[]) ?? []).forEach((r) => {
      c[r.moment_id] = (c[r.moment_id] ?? 0) + 1;
    });
    setCounts(c);
  }, []);

  useEffect(() => {
    if (!moments || moments.length === 0) return;
    const ids = moments.map((m) => m.id);
    loadCounts(ids);
    const channel = supabase
      .channel(`rt-momsel-${tableNumber}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "moment_selections" },
        () => loadCounts(ids)
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") loadCounts(ids);
      });
    const stopForeground = onForeground(() => loadCounts(ids));
    return () => {
      supabase.removeChannel(channel);
      stopForeground();
    };
  }, [moments, tableNumber, loadCounts]);

  async function submit() {
    const texts = inputs.map((s) => s.trim());
    if (texts.some((t) => !t)) {
      setError("Escribe los 3 momentos antes de guardar.");
      return;
    }
    setSaving(true);
    setError(null);
    const rows = texts.map((text, i) => ({
      table_number: tableNumber,
      theme,
      ord: i + 1,
      text,
    }));
    const { error: dbErr } = await supabase.from("selected_moments").insert(rows);
    setSaving(false);
    if (dbErr) {
      // 23505 = ya existían momentos para esta mesa (restricción única): no
      // dupliques; solo recarga y muestra los que ya están.
      if ((dbErr as { code?: string }).code === "23505") {
        loadMoments();
        return;
      }
      setError("No se pudo guardar. Intenta de nuevo.");
      return;
    }
    loadMoments();
  }

  if (moments === null) {
    return <p className="text-slate-500">Cargando…</p>;
  }

  // Ya registrados: mostrar con conteo en vivo.
  if (moments.length > 0) {
    return (
      <div>
        <h2 className="text-lg font-bold text-slate-900">
          Momentos de la Mesa {tableNumber}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Cuántos de tu mesa eligieron cada momento (en vivo):
        </p>
        <div className="mt-4 space-y-2">
          {moments.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
            >
              <span className="text-slate-800">
                <b className="text-slate-400">{m.ord}.</b> {m.text}
              </span>
              <span className="shrink-0 rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-700">
                {counts[m.id] ?? 0}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Registrar los 3 momentos.
  return (
    <div>
      <h2 className="text-lg font-bold text-slate-900">
        Registra los 3 momentos ganadores
      </h2>
      {themeTitle && (
        <p className="mt-1 text-sm text-slate-500">{themeTitle}</p>
      )}
      <div className="mt-4 space-y-2">
        {[0, 1, 2].map((i) => (
          <input
            key={i}
            value={inputs[i]}
            onChange={(e) => {
              const next = [...inputs];
              next[i] = e.target.value;
              setInputs(next);
              setError(null);
            }}
            placeholder={`Momento ${i + 1}`}
            className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        ))}
      </div>
      {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}
      <button
        onClick={submit}
        disabled={saving}
        className="mt-4 w-full rounded-lg bg-blue-700 px-4 py-3 font-semibold text-white shadow-sm hover:bg-blue-800 disabled:opacity-60"
      >
        {saving ? "Guardando…" : "Guardar los 3 momentos"}
      </button>
    </div>
  );
}
