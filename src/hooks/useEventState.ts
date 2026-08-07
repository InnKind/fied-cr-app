"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { onForeground } from "@/lib/realtime";

export type EventState = { current_round: number; phase: string };

// Lee el estado del evento (qué ronda/fase controla el administrador).
// Usa Supabase Realtime para que la pantalla de cada persona cambie AL INSTANTE,
// con un poll de respaldo (cada 8 s) por si un mensaje en vivo se pierde.
export function useEventState(): EventState | null {
  const [state, setState] = useState<EventState | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      const { data } = await supabase
        .from("event_state")
        .select("current_round, phase")
        .eq("id", 1)
        .single();
      if (active && data) setState(data as EventState);
    }

    load(); // estado inicial

    const channel = supabase
      .channel("rt-event-state")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "event_state" },
        (payload) => {
          const row = payload.new as EventState | undefined;
          if (active && row && typeof row.current_round === "number") {
            setState({ current_round: row.current_round, phase: row.phase });
          }
        }
      )
      .subscribe((status) => {
        // Al (re)conectar el canal, recargamos para ponernos al día por si
        // se perdió algún cambio mientras no había suscripción.
        if (status === "SUBSCRIBED") load();
      });

    const poll = setInterval(load, 8000); // respaldo
    const stopForeground = onForeground(load); // refresca al volver a la pantalla

    return () => {
      active = false;
      clearInterval(poll);
      stopForeground();
      supabase.removeChannel(channel);
    };
  }, []);

  return state;
}
