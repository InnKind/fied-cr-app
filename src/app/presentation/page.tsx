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
import { HBars, type BarDatum } from "@/components/Charts";
import { THEMES, numberedThemeTitle } from "@/config/event";

const CRITERIA: { key: keyof IdeaTriple; label: string }[] = [
  { key: "mostRepeated", label: "Más repetida" },
  { key: "easiest", label: "Más fácil de implementar" },
  { key: "mostDisruptive", label: "Más disruptiva" },
];

// Colores por tema (mismo orden que THEMES), consistentes con /resultados.
const THEME_COLORS = ["#0c7d75", "#c8103e", "#d97706"];

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

// Diapositiva-resumen (panorama) que abre la presentación: qué tema exploró
// cada quién y los momentos que aparecieron en más mesas.
function SummarySlide({
  themeCounts,
  slides,
}: {
  themeCounts: Record<string, number>;
  slides: FlatSlide[];
}) {
  const themeData: BarDatum[] = THEMES.filter(
    (t) => (themeCounts[t.id] ?? 0) > 0
  ).map((t, i) => ({
    label: numberedThemeTitle(t.id),
    value: themeCounts[t.id] ?? 0,
    color: THEME_COLORS[THEMES.findIndex((x) => x.id === t.id)] ?? THEME_COLORS[i],
  }));

  const topMoments: BarDatum[] = slides
    .slice()
    .sort((a, b) => b.tables - a.tables)
    .slice(0, 6)
    .map((s) => ({ label: s.moment, value: s.tables }));

  const totalPeople = Object.values(themeCounts).reduce((a, b) => a + b, 0);

  return (
    <>
      <h1 className="text-3xl font-bold text-white sm:text-5xl">
        El panorama de la Ronda 1
      </h1>
      <p className="mt-2 text-white/70">
        {totalPeople > 0
          ? `${totalPeople} personas · ${slides.length} momentos trabajados`
          : `${slides.length} momentos trabajados`}
      </p>

      <div className="mt-8 flex flex-col gap-5 sm:flex-row">
        <div className="flex-1 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-bold text-[#0c7d75]">
            ¿Qué tema exploró cada quién?
          </h3>
          <p className="mb-4 mt-1 text-sm text-slate-500">
            Personas que eligieron cada tema.
          </p>
          {themeData.length ? (
            <HBars data={themeData} big />
          ) : (
            <p className="text-sm text-slate-400">Sin datos de temas todavía.</p>
          )}
        </div>

        <div className="flex-1 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-bold text-[#0c7d75]">
            Los momentos que más se repitieron
          </h3>
          <p className="mb-4 mt-1 text-sm text-slate-500">
            En cuántas mesas apareció cada momento.
          </p>
          {topMoments.length ? (
            <HBars data={topMoments} big color="#c8103e" valueSuffix=" mesas" />
          ) : (
            <p className="text-sm text-slate-400">Sin momentos todavía.</p>
          )}
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-white/50">
        Cuando un mismo momento surge en varias mesas, es señal de que resuena en
        el grupo. A continuación, las ideas de cada uno.
      </p>
    </>
  );
}

function MomentSlide({ s }: { s: FlatSlide }) {
  return (
    <>
      <div className="mt-3 flex items-baseline gap-3">
        <h1 className="text-3xl font-bold text-white sm:text-5xl">{s.moment}</h1>
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
        La IA eligió, de todo lo que escribieron las mesas, la idea más repetida,
        la más fácil de implementar y la más disruptiva de cada dimensión.
      </p>
    </>
  );
}

export default function PresentationPage() {
  const [slides, setSlides] = useState<FlatSlide[]>([]);
  const [themeCounts, setThemeCounts] = useState<Record<string, number>>({});
  const [loaded, setLoaded] = useState(false);
  const [i, setI] = useState(0);

  const load = useCallback(async () => {
    const [{ data: synth }, { data: parts }] = await Promise.all([
      supabase.from("synthesis").select("payload").eq("round", 1).maybeSingle(),
      supabase
        .from("participants")
        .select("selected_theme")
        .not("selected_theme", "is", null),
    ]);
    const flat = flattenSlides((synth?.payload as Round1Payload | null) ?? null);
    const counts: Record<string, number> = {};
    for (const p of parts ?? []) {
      const t = p.selected_theme as string;
      counts[t] = (counts[t] ?? 0) + 1;
    }
    setThemeCounts(counts);
    setSlides(flat);
    setLoaded(true);
    // total de vistas = resumen (1) + momentos. Acota el índice por ambos lados.
    setI((cur) => Math.max(0, Math.min(cur, flat.length)));
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

  // Vistas: índice 0 = resumen; 1..N = momentos.
  const total = slides.length > 0 ? slides.length + 1 : 0;

  const go = useCallback(
    // Math.max(0, ...) va PRIMERO para que la cota inferior gane cuando total=0
    // (evita índices negativos que luego romperían slides[i-1]).
    (d: number) => setI((cur) => Math.max(0, Math.min(total - 1, cur + d))),
    [total]
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

  const isSummary = i === 0;
  const s = slides[i - 1];

  return (
    <main className="flex-1 p-6 sm:p-10" style={{ background: BRAND_BG }}>
      <div className="mx-auto flex h-full max-w-5xl flex-col">
        <div className="flex items-center justify-between text-sm text-white/50">
          <span className="font-semibold uppercase tracking-wider text-teal-200">
            {isSummary ? "Ronda 1 · Panorama" : s.themeTitle}
          </span>
          <span>
            {i + 1} / {total}
          </span>
        </div>

        {isSummary ? (
          <SummarySlide themeCounts={themeCounts} slides={slides} />
        ) : (
          <MomentSlide s={s} />
        )}

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
            disabled={i === total - 1}
            className="rounded-lg bg-[#c8103e] px-5 py-3 font-semibold text-white shadow-sm hover:bg-[#a50d33] disabled:opacity-40"
          >
            Siguiente →
          </button>
        </div>
      </div>
    </main>
  );
}
