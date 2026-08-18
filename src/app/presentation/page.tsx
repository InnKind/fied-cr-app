"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

function themeColor(themeId: string): string {
  const i = THEMES.findIndex((t) => t.id === themeId);
  return THEME_COLORS[i] ?? THEME_COLORS[0];
}

// Fila de puntos: uno por mesa donde apareció el momento (convergencia visible).
function MesasDots({ n, color }: { n: number; color: string }) {
  const shown = Math.min(n, 16);
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 align-middle">
      {Array.from({ length: shown }).map((_, k) => (
        <span
          key={k}
          className="inline-block h-3.5 w-3.5 rounded-full ring-2 ring-white/40"
          style={{ background: color }}
        />
      ))}
      {n > shown && <span className="text-sm font-semibold text-white/70">+{n - shown}</span>}
    </span>
  );
}

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
              {/* 1-2 oraciones por idea (pedido de David): texto un poco más
                  grande y con interlineado corto para leerse proyectado. */}
              <p className="mt-0.5 text-[17px] leading-snug text-slate-800">
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
  ).map((t) => ({
    label: numberedThemeTitle(t.id),
    value: themeCounts[t.id] ?? 0,
    color: themeColor(t.id),
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
        Resultados de la ideación
      </h1>
      <p className="mt-2 text-white/70">
        {totalPeople > 0
          ? `${totalPeople} personas · ${slides.length} momentos trabajados`
          : `${slides.length} momentos trabajados`}
      </p>

      <div className="mt-8 flex flex-col gap-5 sm:flex-row">
        <div className="flex-1 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-bold text-[#0c7d75]">
            ¿Cuántas personas exploraron cada tema?
          </h3>
          <p className="mb-4 mt-1 text-sm text-slate-500">
            Número de personas que eligieron cada tema
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
            Número de mesas en las que surgió este momento
          </p>
          {topMoments.length ? (
            <HBars
              data={topMoments}
              big
              color="#c8103e"
              valueSuffix=" mesas"
              singularSuffix=" mesa"
            />
          ) : (
            <p className="text-sm text-slate-400">Sin momentos todavía.</p>
          )}
        </div>
      </div>
    </>
  );
}

// Divisor de tema: abre la sección de cada tema con sus cifras y un gráfico de
// los momentos de ESE tema, ordenados por en cuántas mesas aparecieron.
function ThemeDividerSlide({
  themeId,
  moments,
  people,
}: {
  themeId: string;
  moments: FlatSlide[];
  people: number;
}) {
  const color = themeColor(themeId);
  const data: BarDatum[] = moments
    .slice()
    .sort((a, b) => b.tables - a.tables)
    .map((m) => ({ label: m.moment, value: m.tables }));

  return (
    <>
      <div className="flex items-center gap-3">
        <span
          className="inline-block h-8 w-1.5 rounded-full"
          style={{ background: color }}
        />
        <span
          className="text-sm font-bold uppercase tracking-widest"
          style={{ color }}
        >
          Tema
        </span>
      </div>
      <h1 className="mt-2 text-3xl font-bold text-white sm:text-5xl">
        {numberedThemeTitle(themeId)}
      </h1>
      <p className="mt-2 text-white/70">
        {people > 0 && (
          <>
            {people} {people === 1 ? "persona" : "personas"} ·{" "}
          </>
        )}
        {moments.length} {moments.length === 1 ? "momento" : "momentos"}
      </p>

      <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-bold" style={{ color }}>
          Los momentos de este tema
        </h3>
        <p className="mb-4 mt-1 text-sm text-slate-500">
          Número de mesas en las que surgió cada momento
        </p>
        <HBars
          data={data}
          big
          color={color}
          valueSuffix=" mesas"
          singularSuffix=" mesa"
        />
      </div>
    </>
  );
}

function MomentSlide({ s }: { s: FlatSlide }) {
  const color = themeColor(s.themeId);
  return (
    <>
      <h1 className="text-3xl font-bold text-white sm:text-5xl">{s.moment}</h1>

      {s.tables > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <MesasDots n={s.tables} color={color} />
          <span className="text-sm font-semibold text-white/80">
            {s.tables > 1 ? `en ${s.tables} mesas` : "en 1 mesa"}
          </span>
        </div>
      )}

      {/* Primero empoderamiento, después IA (orden pedido por el equipo). */}
      <div className="mt-8 flex flex-col gap-5 sm:flex-row">
        <IdeaColumn title="Ideas de Empoderamiento" ideas={s.agency} />
        <IdeaColumn title="Ideas de IA" ideas={s.ai} />
      </div>
    </>
  );
}

// Una "vista" del deck: resumen, divisor de tema, o un momento.
type View =
  | { kind: "summary" }
  | { kind: "divider"; themeId: string; moments: FlatSlide[]; people: number }
  | { kind: "moment"; slide: FlatSlide };

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

  // Construye la secuencia de vistas: resumen → (divisor de tema → momentos)…
  const views = useMemo<View[]>(() => {
    if (slides.length === 0) return [];
    const out: View[] = [{ kind: "summary" }];
    for (const t of THEMES) {
      const moments = slides.filter((s) => s.themeId === t.id);
      if (moments.length === 0) continue;
      out.push({
        kind: "divider",
        themeId: t.id,
        moments,
        people: themeCounts[t.id] ?? 0,
      });
      for (const m of moments) out.push({ kind: "moment", slide: m });
    }
    return out;
  }, [slides, themeCounts]);

  const total = views.length;

  // Si el deck se acorta (reproceso), reencuadra el índice dentro de rango.
  useEffect(() => {
    setI((cur) => Math.max(0, Math.min(cur, Math.max(0, total - 1))));
  }, [total]);

  const go = useCallback(
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

  if (total === 0) {
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

  // Acota el índice DURANTE el render (no dependas del useEffect asíncrono):
  // si el deck se encoge en caliente (p. ej. curaduría), i podría exceder total.
  const clampedI = Math.max(0, Math.min(i, total - 1));
  const view = views[clampedI];
  // El slide-resumen no lleva etiqueta arriba (el <span> vacío mantiene el
  // contador "n / total" alineado a la derecha).
  const topLabel =
    view.kind === "summary"
      ? ""
      : view.kind === "divider"
        ? numberedThemeTitle(view.themeId)
        : numberedThemeTitle(view.slide.themeId);

  return (
    <main className="flex-1 p-6 sm:p-10" style={{ background: BRAND_BG }}>
      <div className="mx-auto flex h-full max-w-5xl flex-col">
        <div className="flex items-center justify-between text-sm text-white/50">
          <span className="font-semibold uppercase tracking-wider text-teal-200">
            {topLabel}
          </span>
          <span>
            {clampedI + 1} / {total}
          </span>
        </div>

        {view.kind === "summary" && (
          <SummarySlide themeCounts={themeCounts} slides={slides} />
        )}
        {view.kind === "divider" && (
          <ThemeDividerSlide
            themeId={view.themeId}
            moments={view.moments}
            people={view.people}
          />
        )}
        {view.kind === "moment" && <MomentSlide s={view.slide} />}

        {/* Barra de progreso del deck */}
        <div className="mt-auto pt-8">
          <div className="h-1 w-full overflow-hidden rounded-full bg-white/15">
            <div
              className="h-full rounded-full bg-teal-300 transition-all"
              style={{ width: `${((clampedI + 1) / total) * 100}%` }}
            />
          </div>

          <div className="mt-4 flex items-center justify-between">
            <button
              onClick={() => go(-1)}
              disabled={clampedI === 0}
              className="rounded-lg border border-white/30 bg-white/10 px-5 py-3 font-semibold text-white shadow-sm hover:bg-white/20 disabled:opacity-30"
            >
              ← Anterior
            </button>
            <button
              onClick={() => go(1)}
              disabled={clampedI === total - 1}
              className="rounded-lg bg-[#c8103e] px-5 py-3 font-semibold text-white shadow-sm hover:bg-[#a50d33] disabled:opacity-40"
            >
              Siguiente →
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
