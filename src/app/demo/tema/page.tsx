"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import ChooseTheme from "@/components/ChooseTheme";

// Ruta de PRUEBA de la elección de tema + asignación de mesa.
// Crea un participante de prueba (rol estudiante) para verlo funcionar.
const ROLE = "estudiante";

export default function DemoTema() {
  const [pid, setPid] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    supabase
      .from("participants")
      .insert({ role: ROLE })
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
        <ChooseTheme participantId={pid} role={ROLE} />
      ) : (
        <p className="text-slate-500">Creando participante de prueba…</p>
      )}
    </main>
  );
}
