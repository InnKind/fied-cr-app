"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { onForeground } from "@/lib/realtime";

type Theme = { title: string; description: string; count: number };
type Synthesis = { themes: Theme[]; total: number };

// Muestra la síntesis de una ronda (temas + conteo, con barras).
// Aparece AL INSTANTE cuando el admin la genera (Realtime), con poll de respaldo.
// `big` = versión grande para proyectar.
export default function Results({
  round = 1,
  big = false,
}: {
  round?: number;
  big?: boolean;
}) {
  const [data, setData] = useState<Synthesis | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      const { data: row } = await supabase
        .from("synthesis")
        .select("payload")
        .eq("round", round)
        .maybeSingle();
      if (active) {
        setData((row?.payload as Synthesis) ?? null);
        setLoading(false);
      }
    }

    load();

    const channel = supabase
      .channel(`rt-synthesis-${round}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "synthesis",
          filter: `round=eq.${round}`,
        },
        () => {
          if (active) load();
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED" && active) load();
      });

    const poll = setInterval(load, 8000); // respaldo
    const stopForeground = onForeground(load); // refresca al volver a la pantalla

    return () => {
      active = false;
      clearInterval(poll);
      stopForeground();
      supabase.removeChannel(channel);
    };
  }, [round]);

  if (loading) {
    return <p className="text-slate-500">Cargando resultados…</p>;
  }
  if (!data || !data.themes?.length) {
    return (
      <p className="text-slate-500">
        Todavía no hay resultados. Espera un momento…
      </p>
    );
  }

  const max = Math.max(...data.themes.map((t) => t.count), 1);

  return (
    <div className={big ? "w-full max-w-4xl" : "w-full max-w-2xl"}>
      <p
        className={`font-semibold uppercase tracking-wider text-blue-700 ${
          big ? "text-sm" : "text-xs"
        }`}
      >
        Ronda {round} · Resultados
      </p>
      <h2
        className={`mt-1 font-bold text-slate-900 ${big ? "text-4xl" : "text-2xl"}`}
      >
        Los temas que más resonaron
      </h2>
      <p className={`mt-1 text-slate-500 ${big ? "text-lg" : "text-sm"}`}>
        {data.total} respuestas · {data.themes.length} temas
      </p>

      <div className={`mt-6 ${big ? "space-y-6" : "space-y-4"}`}>
        {data.themes.map((t, i) => (
          <div
            key={i}
            className={`rounded-lg border border-slate-200 bg-white shadow-sm ${
              big ? "p-6" : "p-4"
            }`}
          >
            <div className="flex items-baseline justify-between gap-3">
              <h3
                className={`font-semibold text-slate-900 ${big ? "text-2xl" : ""}`}
              >
                {t.title}
              </h3>
              <span
                className={`shrink-0 font-semibold text-blue-700 ${
                  big ? "text-2xl" : "text-sm"
                }`}
              >
                {t.count}
              </span>
            </div>
            <div
              className={`mt-2 w-full overflow-hidden rounded-full bg-slate-100 ${
                big ? "h-3" : "h-2"
              }`}
            >
              <div
                className="h-full rounded-full bg-blue-600"
                style={{ width: `${(t.count / max) * 100}%` }}
              />
            </div>
            <p className={`mt-2 text-slate-600 ${big ? "text-lg" : "text-sm"}`}>
              {t.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
