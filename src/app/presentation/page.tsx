"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { onForeground } from "@/lib/realtime";
import {
  flattenSlides,
  type FlatSlide,
  type IdeaTriple,
  type Round1Payload,
} from "@/lib/round1";
import { BRAND_BG } from "@/lib/brand";

const CRITERIA: { key: keyof IdeaTriple; label: string }[] = [
  { key: "mostRepeated", label: "Más repetida" },
  { key: "easiest", label: "Más fácil de implementar" },
  { key: "mostDisruptive", label: "Más disruptiva" },
];

function IdeaColumn({ title, ideas }: { title: string; ideas: IdeaTriple }) {
  return (
    <div className="flex-1 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-lg font-bold text-[#0c7d75]">{title}</h3>
      <ul className="mt-3 space-y-3">
        {CRITERIA.map((c) => {
          const val = ideas?.[c.key];
          return (
            <li key={c.key}>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                {c.label}
              </p>
              <p className="mt-0.5 text-slate-800">
                {val && val.trim() ? val : <span className="text-slate-300">—</span>}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function PresentationPage() {
  const [slides, setSlides] = useState<FlatSlide[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [i, setI] = useState(0);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("synthesis")
      .select("payload")
      .eq("round", 1)
      .maybeSingle();
    const flat = flattenSlides((data?.payload as Round1Payload | null) ?? null);
    setSlides(flat);
    setLoaded(true);
    setI((cur) => (cur >= flat.length ? Math.max(0, flat.length - 1) : cur));
  }, []);

  useEffect(() => {
    load();
    const channel = supabase
      .channel("rt-presentation")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "synthesis", filter: "round=eq.1" },
        () => load()
      )
      .subscribe((s) => {
        if (s === "SUBSCRIBED") load();
      });
    const stop = onForeground(load);
    return () => {
      supabase.removeChannel(channel);
      stop();
    };
  }, [load]);

  const go = useCallback(
    (d: number) => setI((cur) => Math.min(slides.length - 1, Math.max(0, cur + d))),
    [slides.length]
  );

  // Navegación con flechas del teclado.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  if (!loaded) {
    return (
      <main className="flex-1 flex items-center justify-center" style={{ background: BRAND_BG }}>
        <p className="text-white/60">Cargando…</p>
      </main>
    );
  }

  if (slides.length === 0) {
    return (
      <main className="flex-1 flex items-center justify-center p-6 text-center" style={{ background: BRAND_BG }}>
        <div>
          <p className="text-2xl font-semibold text-white">
            Aún no hay resultados que mostrar.
          </p>
          <p className="mt-2 text-white/70">
            El administrador procesa la Ronda 1 y aquí aparecen las diapositivas.
          </p>
        </div>
      </main>
    );
  }

  const s = slides[i];

  return (
    <main className="flex-1 p-6 sm:p-10" style={{ background: BRAND_BG }}>
      <div className="mx-auto flex h-full max-w-5xl flex-col">
        <div className="flex items-center justify-between text-sm text-white/50">
          <span className="font-semibold uppercase tracking-wider text-teal-200">
            {s.themeTitle}
          </span>
          <span>
            {i + 1} / {slides.length}
          </span>
        </div>

        <div className="mt-3 flex items-baseline gap-3">
          <h1 className="text-3xl font-bold text-white sm:text-5xl">
            {s.moment}
          </h1>
          {s.tables > 1 && (
            <span className="shrink-0 rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-700">
              en {s.tables} mesas
            </span>
          )}
        </div>

        <div className="mt-8 flex flex-col gap-5 sm:flex-row">
          <IdeaColumn title="Integrar mejor la IA" ideas={s.ai} />
          <IdeaColumn title="Más agency (voz y decisión)" ideas={s.agency} />
        </div>

        <p className="mt-6 text-center text-xs text-white/50">
          La IA eligió, de todo lo que escribieron las mesas, la idea más
          repetida, la más fácil de implementar y la más disruptiva de cada
          dimensión.
        </p>

        <div className="mt-auto flex items-center justify-between pt-8">
          <button
            onClick={() => go(-1)}
            disabled={i === 0}
            className="rounded-lg border border-white/30 bg-white/10 px-5 py-3 font-semibold text-white shadow-sm hover:bg-white/20 disabled:opacity-30"
          >
            ← Anterior
          </button>
          <button
            onClick={() => go(1)}
            disabled={i === slides.length - 1}
            className="rounded-lg bg-[#c8103e] px-5 py-3 font-semibold text-white shadow-sm hover:bg-[#a50d33] disabled:opacity-40"
          >
            Siguiente →
          </button>
        </div>
      </div>
    </main>
  );
}
