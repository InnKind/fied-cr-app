"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { onForeground } from "@/lib/realtime";
import { SESSION } from "@/config/charla";
import {
  EMPTY_RESULTS,
  fetchResults,
  fetchStep,
  type CharlaError,
  type CharlaResults,
  type StepRow,
} from "@/lib/charla";

export type CharlaStepState = {
  step: number | null;
  updatedAt: string | null;
  loaded: boolean; // se leyó al menos una vez
  error: CharlaError | null; // último error (se limpia al leer bien)
};

// Milisegundos de un updated_at (0 si no hay o no se entiende).
export function ts(s: string | null | undefined): number {
  const n = s ? Date.parse(s) : NaN;
  return Number.isFinite(n) ? n : 0;
}

// Sigue charla_state.step: tiempo real + sondeo de respaldo + recarga al volver
// a primer plano (los celulares pausan timers y sockets en el bolsillo).
export function useCharlaStep(pollMs = 5000): CharlaStepState {
  const [state, setState] = useState<CharlaStepState>({
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
      .channel(`rt-charla-state-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "charla_state", filter: `session=eq.${SESSION}` },
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

export type CharlaResultsState = CharlaResults & {
  loaded: boolean;
  error: CharlaError | null;
};

// Conteos en vivo. Solo sondea mientras `active`. Ante un error conserva lo
// último leído; cada lectura tiene tiempo máximo (fetchResults).
export function useCharlaResults(active: boolean, intervalMs = 2000): CharlaResultsState {
  const [state, setState] = useState<CharlaResultsState>({
    ...EMPTY_RESULTS,
    loaded: false,
    error: null,
  });

  useEffect(() => {
    if (!active) return;
    let alive = true;
    let inflight = false;

    const load = async () => {
      if (inflight) return;
      inflight = true;
      const { data, error } = await fetchResults();
      inflight = false;
      if (!alive) return;
      setState((prev) =>
        error || !data ? { ...prev, error } : { ...data, loaded: true, error: null }
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
