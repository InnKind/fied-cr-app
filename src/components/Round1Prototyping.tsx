"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { onForeground } from "@/lib/realtime";
import { BRAND_BG } from "@/lib/brand";
import MomentSelection from "@/components/MomentSelection";
import IdeaEntry from "@/components/IdeaEntry";

// Orquesta el prototipado de la Ronda 1 con ritmo POR MESA y POR PERSONA, sin
// depender de la fase global (cambio pedido por Chandni):
//   - Aún no elegiste momento → MomentSelection, que por sí mismo maneja el
//     ritmo por mesa: espera (con la provocación) mientras el facilitador de tu
//     mesa no ha guardado los momentos, muestra el selector cuando los guarda, y
//     ofrece el rescate "no es mi mesa" para rezagados. Al elegir, avisa (onSelected).
//   - Ya elegiste tu momento → IdeaEntry (captura de ideas).
// Todo en tiempo real: cuando el facilitador guarda los 3 momentos, quienes
// están en esa mesa ven el selector; al elegir, pasan a ideas. Cada mesa y cada
// persona avanza cuando le toca. El admin conserva el control en las
// transiciones grandes (al pasar a coffee break, page.tsx saca a todos de aquí).
export default function Round1Prototyping({
  participantId,
  accent,
}: {
  participantId: string;
  accent?: string;
}) {
  // null = aún cargando; true/false = ya elegió su momento o no.
  const [hasSelection, setHasSelection] = useState<boolean | null>(null);

  const load = useCallback(async () => {
    const { data: sel } = await supabase
      .from("moment_selections")
      .select("participant_id")
      .eq("participant_id", participantId)
      .maybeSingle();
    setHasSelection(!!sel);
  }, [participantId]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`rt-r1p-${participantId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "moment_selections",
          filter: `participant_id=eq.${participantId}`,
        },
        () => load()
      )
      .subscribe();
    const stop = onForeground(load);
    return () => {
      supabase.removeChannel(channel);
      stop();
    };
  }, [participantId, load]);

  if (hasSelection === null) {
    return (
      <main
        className="flex-1 flex items-center justify-center p-6"
        style={{ background: BRAND_BG }}
      >
        <p className="text-white/80">Cargando…</p>
      </main>
    );
  }

  if (hasSelection) {
    return <IdeaEntry participantId={participantId} accent={accent} />;
  }

  return (
    <MomentSelection
      participantId={participantId}
      accent={accent}
      onSelected={load}
      guided
    />
  );
}
