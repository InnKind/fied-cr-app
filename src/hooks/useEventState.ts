"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type EventState = { current_round: number; phase: string };

// Lee el estado del evento (qué ronda/fase controla el administrador) y lo
// refresca cada 4 segundos, para que la pantalla de cada persona avance sola.
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

    load();
    const timer = setInterval(load, 4000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  return state;
}
