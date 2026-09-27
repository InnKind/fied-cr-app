"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { onForeground } from "@/lib/realtime";
import { SESSION } from "@/config/stand";
import {
  fetchResponses,
  fetchStep,
  type ResponseRow,
  type StandError,
  type StepRow,
} from "@/lib/stand";

export type StandStepState = {
  step: number | null;
  updatedAt: string | null;
  loaded: boolean; // se leyó al menos una vez
  error: StandError | null; // último error (se limpia al leer bien)
};

function ts(s: string | null | undefined): number {
  const n = s ? Date.parse(s) : NaN;
  return Number.isFinite(n) ? n : 0;
}

// Sigue stand_state.step: tiempo real + sondeo de respaldo + recarga al volver
// a primer plano (los celulares pausan timers y sockets en el bolsillo).
export function useStandStep(pollMs = 5000): StandStepState {
  const [state, setState] = useState<StandStepState>({
    step: null,
    updatedAt: null,
    loaded: false,
    error: null,
  });

  useEffect(() => {
    let active = true;

    // Evita que una lectura vieja (que salió antes de un cambio) pise uno nuevo.
    const apply = (row: StepRow) =>
      setState((prev) => {
        if (prev.loaded && prev.updatedAt && row.updated_at && ts(row.updated_at) < ts(prev.updatedAt)) {
          return prev.error ? { ...prev, error: null } : prev;
        }
        return { step: row.step, updatedAt: row.updated_at, loaded: true, error: null };
      });

    const load = async () => {
      const { row, error } = await fetchStep();
      if (!active) return;
      if (row) apply(row);
      else if (error) setState((prev) => ({ ...prev, error }));
    };

    load();

    const channel = supabase
      .channel(`rt-stand-state-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "stand_state", filter: `session=eq.${SESSION}` },
        (payload) => {
          const row = payload.new as Partial<StepRow> | undefined;
          if (active && row && typeof row.step === "number") {
            apply({ step: row.step, updated_at: row.updated_at ?? null });
          }
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") load();
      });

    const poll = setInterval(load, pollMs);
    const stop = onForeground(load);

    return () => {
      active = false;
      clearInterval(poll);
      stop();
      supabase.removeChannel(channel);
    };
  }, [pollMs]);

  return state;
}

export type StandResultsState = {
  rows: ResponseRow[];
  loaded: boolean;
  error: StandError | null;
  fetchedAt: number; // última vez que terminó una lectura (bien o mal)
};

// Resultados en vivo. Solo sondea mientras `active` (en la pantalla: pasos de
// pregunta, registro, Atenea y resumen). Ante un error conserva lo último leído.
export function useStandResults(active: boolean, intervalMs = 2000): StandResultsState {
  const [state, setState] = useState<StandResultsState>({
    rows: [],
    loaded: false,
    error: null,
    fetchedAt: 0,
  });
  const inflight = useRef(false);

  useEffect(() => {
    if (!active) return;
    let alive = true;

    const load = async () => {
      if (inflight.current) return;
      inflight.current = true;
      const { rows, error } = await fetchResponses();
      inflight.current = false;
      if (!alive) return;
      setState((prev) =>
        error
          ? { ...prev, error, fetchedAt: Date.now() }
          : { rows, loaded: true, error: null, fetchedAt: Date.now() }
      );
    };

    load();
    const t = setInterval(load, intervalMs);
    const stop = onForeground(load);
    return () => {
      alive = false;
      clearInterval(t);
      stop();
    };
  }, [active, intervalMs]);

  return state;
}
