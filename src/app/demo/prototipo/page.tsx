"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import PrototypeCapture from "@/components/PrototypeCapture";

// Ruta de PRUEBA de la captura del prototipo (vista del facilitador).
export default function DemoProto() {
  const [pid, setPid] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    supabase
      .from("participants")
      .insert({ role: "docente", is_facilitator: true })
      .select("id")
      .single()
      .then(({ data }) => {
        if (active && data) setPid(data.id);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="flex-1 flex items-start justify-center p-6 bg-slate-50">
      {pid ? (
        <PrototypeCapture participantId={pid} table={7} theme="aula" />
      ) : (
        <p className="text-slate-500">Creando participante de prueba…</p>
      )}
    </main>
  );
}
