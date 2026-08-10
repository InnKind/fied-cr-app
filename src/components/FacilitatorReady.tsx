"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { onForeground } from "@/lib/realtime";

// El facilitador marca si su mesa terminó el paso actual. El admin lo ve en su
// panel para no avanzar cuando una mesa no está lista. El estado se reinicia
// solo cuando el admin cambia de fase (lo hace el servidor).
export default function FacilitatorReady({
  tableNumber,
}: {
  tableNumber: number;
}) {
  const [ready, setReady] = useState<boolean | null>(null); // null = cargando
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("table_status")
      .select("ready")
      .eq("table_number", tableNumber)
      .maybeSingle();
    setReady((data?.ready as boolean | null) ?? false);
  }, [tableNumber]);

  useEffect(() => {
    load();
    // Se re-sincroniza si el admin reinicia el estado al cambiar de fase.
    const channel = supabase
      .channel(`rt-tablestatus-${tableNumber}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "table_status" },
        () => load()
      )
      .subscribe();
    const stop = onForeground(load);
    return () => {
      supabase.removeChannel(channel);
      stop();
    };
  }, [load]);

  async function toggle() {
    const next = !ready;
    setSaving(true);
    const { error } = await supabase.from("table_status").upsert(
      {
        table_number: tableNumber,
        ready: next,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "table_number" }
    );
    setSaving(false);
    if (!error) setReady(next);
  }

  if (ready === null) {
    return <p className="text-slate-500">Cargando…</p>;
  }

  return (
    <div>
      <h2 className="text-lg font-bold text-slate-900">¿Tu mesa está lista?</h2>
      <p className="mt-1 text-sm text-slate-500">
        Avísale al administrador cuando tu mesa haya terminado este paso. Se
        reinicia solo al pasar al siguiente.
      </p>
      <button
        onClick={toggle}
        disabled={saving}
        className={`mt-4 w-full rounded-lg px-4 py-3 font-semibold shadow-sm disabled:opacity-60 ${
          ready
            ? "bg-green-600 text-white hover:bg-green-700"
            : "border border-slate-300 bg-white text-slate-800 hover:border-green-400 hover:bg-green-50"
        }`}
      >
        {ready ? "✅ Mesa lista — toca para desmarcar" : "Marcar mi mesa como lista"}
      </button>
    </div>
  );
}
