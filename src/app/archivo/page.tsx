"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { EVENT, THEMES, numberedThemeTitle } from "@/config/event";
import { BRAND_BG } from "@/lib/brand";
import BrandLogo from "@/components/BrandLogo";
import { HBars, type BarDatum } from "@/components/Charts";
import type { Round1Payload } from "@/lib/round1";

type Moment = { id: string; ord: number; text: string };
type Idea = { moment_id: string; ai_text: string | null; agency_text: string | null };

// Colores por tema (mismo orden que THEMES), consistentes con /presentation y /resultados.
const THEME_COLORS = ["#0c7d75", "#c8103e", "#d97706"];

type Panorama = {
  totals: { participants: number; tables: number; moments: number; ideas: number };
  themeCounts: Record<string, number>;
  topMoments: BarDatum[];
  hasR2: boolean;
};

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white/10 px-3 py-3 text-center ring-1 ring-white/15">
      <p className="text-3xl font-bold text-white">{value}</p>
      <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-white/70">
        {label}
      </p>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      {children}
    </div>
  );
}

// Archivo post-evento (§32): memoria del ejercicio completo. Arriba, un
// panorama visual del evento entero; abajo, la consulta por mesa (momentos,
// ideas IA/Agency y fotos de los post-its) y un enlace a la reflexión (R2).
export default function ArchivoPage() {
  // --- Panorama global (se carga al abrir la página) ---
  const [pano, setPano] = useState<Panorama | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const [parts, r1, r2, ideasCount, momRows, partsCount] = await Promise.all([
        supabase.from("participants").select("selected_theme").not("selected_theme", "is", null),
        supabase.from("synthesis").select("payload").eq("round", 1).maybeSingle(),
        supabase.from("synthesis").select("round").eq("round", 2).maybeSingle(),
        supabase.from("idea_submissions").select("*", { count: "exact", head: true }),
        supabase.from("selected_moments").select("table_number"),
        supabase.from("participants").select("*", { count: "exact", head: true }),
      ]);

      const themeCounts: Record<string, number> = {};
      for (const p of parts.data ?? []) {
        const t = p.selected_theme as string;
        themeCounts[t] = (themeCounts[t] ?? 0) + 1;
      }

      const payload = (r1.data?.payload as Round1Payload | null) ?? null;
      const allSlides = (payload?.themes ?? []).flatMap((t) => t.slides ?? []);
      const topMoments: BarDatum[] = allSlides
        .slice()
        .sort((a, b) => b.tables - a.tables)
        .slice(0, 6)
        .map((s) => ({ label: s.moment, value: s.tables }));

      const tables = new Set(
        (momRows.data ?? []).map((m) => m.table_number as number)
      ).size;

      if (!active) return;
      setPano({
        totals: {
          participants: partsCount.count ?? 0,
          tables,
          moments: allSlides.length,
          ideas: ideasCount.count ?? 0,
        },
        themeCounts,
        topMoments,
        hasR2: !!r2.data,
      });
    })();
    return () => {
      active = false;
    };
  }, []);

  const themeData: BarDatum[] = pano
    ? THEMES.filter((t) => (pano.themeCounts[t.id] ?? 0) > 0).map((t, i) => ({
        label: numberedThemeTitle(t.id),
        value: pano.themeCounts[t.id] ?? 0,
        color:
          THEME_COLORS[THEMES.findIndex((x) => x.id === t.id)] ?? THEME_COLORS[i],
      }))
    : [];

  // --- Consulta por mesa ---
  const [input, setInput] = useState("");
  const [table, setTable] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [moments, setMoments] = useState<Moment[]>([]);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [theme, setTheme] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  async function load() {
    const n = parseInt(input, 10);
    if (!input || Number.isNaN(n) || n < 1 || n > EVENT.numberOfTables) {
      setError(`Ingresa un número de mesa (1 a ${EVENT.numberOfTables}).`);
      return;
    }
    setLoading(true);
    setError(null);
    setTable(n);
    const [{ data: m }, { data: i }, { data: img }, { data: tt }] = await Promise.all([
      supabase.from("selected_moments").select("id, ord, text").eq("table_number", n).order("ord"),
      supabase.from("idea_submissions").select("moment_id, ai_text, agency_text").eq("table_number", n),
      supabase.from("table_images").select("image_path").eq("table_number", n),
      supabase.from("table_themes").select("theme").eq("table_number", n).maybeSingle(),
    ]);
    setMoments((m as Moment[]) ?? []);
    setIdeas((i as Idea[]) ?? []);
    setTheme((tt?.theme as string | null) ?? null);
    setPhotos(
      ((img as { image_path: string }[]) ?? []).map(
        (r) => supabase.storage.from("postits").getPublicUrl(r.image_path).data.publicUrl
      )
    );
    setLoading(false);
    setSearched(true);
  }

  const themeTitle = table && theme ? numberedThemeTitle(theme) : null;

  return (
    <main className="flex-1 p-6" style={{ background: BRAND_BG }}>
      <div className="mx-auto w-full max-w-3xl">
        <BrandLogo className="mb-5" />
        <h1 className="text-2xl font-bold text-white">Memoria del ejercicio</h1>
        <p className="mt-2 text-white/80">
          El panorama de lo que construimos juntos. Más abajo puedes revisar el
          detalle de tu mesa.
        </p>

        {/* ---- Panorama global del evento ---- */}
        {pano && pano.totals.participants > 0 && (
          <div className="mt-6">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Personas" value={pano.totals.participants} />
              <Stat label="Mesas" value={pano.totals.tables} />
              <Stat label="Momentos" value={pano.totals.moments} />
              <Stat label="Ideas" value={pano.totals.ideas} />
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Card>
                <h3 className="text-sm font-bold uppercase tracking-wider text-[#0c7d75]">
                  Qué tema exploró cada quién
                </h3>
                <p className="mb-3 mt-1 text-sm text-slate-500">
                  Personas que eligieron cada tema.
                </p>
                {themeData.length ? (
                  <HBars data={themeData} />
                ) : (
                  <p className="text-sm text-slate-400">Sin datos de temas.</p>
                )}
              </Card>

              <Card>
                <h3 className="text-sm font-bold uppercase tracking-wider text-[#0c7d75]">
                  Los momentos que más resonaron
                </h3>
                <p className="mb-3 mt-1 text-sm text-slate-500">
                  En cuántas mesas apareció cada momento.
                </p>
                {pano.topMoments.length ? (
                  <HBars data={pano.topMoments} color="#c8103e" valueSuffix=" mesas" />
                ) : (
                  <p className="text-sm text-slate-400">Sin momentos registrados.</p>
                )}
              </Card>
            </div>

            {pano.hasR2 && (
              <a
                href="/resultados"
                className="mt-4 flex items-center justify-between rounded-2xl border border-white/20 bg-white/10 px-5 py-4 text-white ring-1 ring-white/10 transition hover:bg-white/15"
              >
                <span>
                  <span className="block font-semibold">
                    La reflexión de la Ronda 2
                  </span>
                  <span className="block text-sm text-white/70">
                    Qué nos llevamos para accionar: roles y experiencias.
                  </span>
                </span>
                <span className="text-2xl">→</span>
              </a>
            )}
          </div>
        )}

        {/* ---- Consulta por mesa ---- */}
        <div className="mt-10 border-t border-white/15 pt-6">
          <h2 className="text-lg font-bold text-white">El detalle de tu mesa</h2>
          <p className="mt-1 text-white/80">
            Ingresa el número de mesa donde estuviste.
          </p>

          <div className="mt-4 flex gap-2">
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={EVENT.numberOfTables}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setError(null);
              }}
              placeholder="Ej: 7"
              className="w-32 rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm focus:border-[#0c7d75] focus:outline-none focus:ring-2 focus:ring-[#0c7d75]/30"
            />
            <button
              onClick={load}
              disabled={loading}
              className="rounded-lg bg-[#c8103e] px-5 py-3 font-semibold text-white shadow-sm hover:bg-[#a50d33] disabled:opacity-60"
            >
              {loading ? "Buscando…" : "Buscar"}
            </button>
          </div>
          {error && <p className="mt-3 text-sm font-medium text-red-200">{error}</p>}
        </div>

        {searched && !loading && table && (
          <div className="mt-8">
            <h2 className="text-lg font-bold text-white">
              Mesa {table}
              {themeTitle && (
                <span className="font-normal text-white/70"> · {themeTitle}</span>
              )}
            </h2>

            {moments.length === 0 ? (
              <p className="mt-3 text-white/70">
                No encontramos datos para esta mesa.
              </p>
            ) : (
              <div className="mt-4 space-y-4">
                {moments.map((m) => {
                  const mi = ideas.filter((x) => x.moment_id === m.id);
                  const ai = mi.map((x) => x.ai_text).filter(Boolean) as string[];
                  const ag = mi.map((x) => x.agency_text).filter(Boolean) as string[];
                  return (
                    <div
                      key={m.id}
                      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                    >
                      <h3 className="font-semibold text-slate-900">
                        <span className="text-slate-400">{m.ord}.</span> {m.text}
                      </h3>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-[#0c7d75]">
                            Ideas de IA
                          </p>
                          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-700">
                            {ai.length ? (
                              ai.map((t, k) => <li key={k}>{t}</li>)
                            ) : (
                              <li className="list-none text-slate-300">—</li>
                            )}
                          </ul>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-[#0c7d75]">
                            Ideas de Agency
                          </p>
                          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-700">
                            {ag.length ? (
                              ag.map((t, k) => <li key={k}>{t}</li>)
                            ) : (
                              <li className="list-none text-slate-300">—</li>
                            )}
                          </ul>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {photos.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-white/70">
                  Fotos de los post-its
                </h3>
                <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {photos.map((u, k) => (
                    <a key={k} href={u} target="_blank" rel="noopener noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={u}
                        alt={`Post-it ${k + 1}`}
                        className="aspect-square w-full rounded-lg border border-slate-200 object-cover"
                      />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
