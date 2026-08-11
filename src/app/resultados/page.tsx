"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { onForeground } from "@/lib/realtime";
import { BRAND_BG } from "@/lib/brand";
import BrandLogo from "@/components/BrandLogo";
import { HBars, type BarDatum } from "@/components/Charts";
import { ROLES, THEMES, numberedThemeTitle } from "@/config/event";
import type { Round2Payload, Round2ThemeBlock } from "@/lib/round2";
import type { IdeaTriple } from "@/lib/round1";

// Colores por tema (mismo orden que THEMES) para el gráfico general.
const THEME_COLORS = ["#0c7d75", "#c8103e", "#d97706"];

// Rótulo legible de un rol de participante a partir de su id de catálogo.
function roleLabel(id: string): string {
  return ROLES.find((r) => r.id === id)?.label ?? (id === "sin-rol" ? "Sin rol" : id);
}
function roleColor(id: string): string {
  return ROLES.find((r) => r.id === id)?.color ?? "#64748b";
}

const EXPERIENCE_CRITERIA: { key: keyof IdeaTriple; label: string }[] = [
  { key: "mostRepeated", label: "La más mencionada" },
  { key: "easiest", label: "La más fácil de implementar" },
  { key: "mostDisruptive", label: "La más disruptiva" },
];

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wider text-[#0c7d75]">
      {children}
    </p>
  );
}

function ThemeSection({ block }: { block: Round2ThemeBlock }) {
  const rolesData: BarDatum[] = (block.topRoles ?? []).map((r) => ({
    label: r.role,
    value: r.count,
  }));

  const distData: BarDatum[] = Object.entries(block.roleDistribution ?? {})
    .sort((a, b) => b[1] - a[1])
    .map(([id, count]) => ({
      label: roleLabel(id),
      value: count,
      color: roleColor(id),
    }));

  const experiences = EXPERIENCE_CRITERIA.map((c) => ({
    label: c.label,
    text: block.experiences?.[c.key],
  })).filter((e) => e.text && e.text.trim());

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-2xl font-bold text-white sm:text-3xl">
          {numberedThemeTitle(block.themeId)}
        </h2>
        <span className="rounded-full bg-white/15 px-3 py-1 text-sm font-semibold text-teal-100">
          {block.peopleCount}{" "}
          {block.peopleCount === 1 ? "persona" : "personas"}
        </span>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Card>
          <SectionTitle>Roles a involucrar</SectionTitle>
          <p className="mb-3 mt-1 text-sm text-slate-500">
            A quiénes hay que sumar para que el tema avance.
          </p>
          {rolesData.length ? (
            <HBars data={rolesData} color="#c8103e" valueSuffix="×" />
          ) : (
            <p className="text-sm text-slate-400">
              La IA no encontró roles recurrentes.
            </p>
          )}
        </Card>

        <Card>
          <SectionTitle>Quiénes reflexionaron</SectionTitle>
          <p className="mb-3 mt-1 text-sm text-slate-500">
            Roles de los participantes que eligieron este tema.
          </p>
          {distData.length ? (
            <HBars data={distData} />
          ) : (
            <p className="text-sm text-slate-400">Sin datos.</p>
          )}
        </Card>
      </div>

      {experiences.length > 0 && (
        <div className="mt-4">
          <Card>
            <SectionTitle>Experiencias que inspiran</SectionTitle>
            <p className="mb-3 mt-1 text-sm text-slate-500">
              Cómo proponen movilizar a esas personas.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {experiences.map((e, k) => (
                <div
                  key={k}
                  className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-100"
                >
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    {e.label}
                  </p>
                  <p className="mt-1.5 text-slate-800">{e.text}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </section>
  );
}

export default function ResultadosPage() {
  const [payload, setPayload] = useState<Round2Payload | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("synthesis")
      .select("payload")
      .eq("round", 2)
      .maybeSingle();
    setPayload((data?.payload as Round2Payload | null) ?? null);
    setLoaded(true);
  }, []);

  useEffect(() => {
    load();
    const channel = supabase
      .channel("rt-resultados")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "synthesis", filter: "round=eq.2" },
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

  // Ordena los temas según THEMES (para colores/numeración estables).
  const themes = (payload?.themes ?? [])
    .slice()
    .sort(
      (a, b) =>
        THEMES.findIndex((t) => t.id === a.themeId) -
        THEMES.findIndex((t) => t.id === b.themeId)
    );

  const totalPeople = themes.reduce((n, t) => n + t.peopleCount, 0);

  const themePopularity: BarDatum[] = themes.map((t) => ({
    label: numberedThemeTitle(t.themeId),
    value: t.peopleCount,
    color: THEME_COLORS[THEMES.findIndex((x) => x.id === t.themeId)] ?? "#0c7d75",
  }));

  if (!loaded) {
    return (
      <main
        className="flex-1 flex items-center justify-center"
        style={{ background: BRAND_BG }}
      >
        <p className="text-white/60">Cargando…</p>
      </main>
    );
  }

  if (themes.length === 0) {
    return (
      <main
        className="flex-1 flex items-center justify-center p-6 text-center"
        style={{ background: BRAND_BG }}
      >
        <div>
          <p className="text-2xl font-semibold text-white">
            Aún no hay resultados de la Ronda 2.
          </p>
          <p className="mt-2 text-white/70">
            El administrador procesa la Ronda 2 y aquí aparecen los gráficos.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 p-6 sm:p-10" style={{ background: BRAND_BG }}>
      <div className="mx-auto w-full max-w-5xl">
        <BrandLogo className="mb-6" />

        <p className="text-sm font-semibold uppercase tracking-wider text-teal-200">
          Ronda 2 · Reflexión colectiva
        </p>
        <h1 className="mt-1 text-3xl font-bold text-white sm:text-4xl">
          Qué nos llevamos para accionar
        </h1>
        <p className="mt-1 text-white/70">
          {totalPeople} {totalPeople === 1 ? "reflexión" : "reflexiones"} ·{" "}
          {themes.length} {themes.length === 1 ? "tema" : "temas"}
        </p>

        {/* Panorama general: qué tema quiere accionar la gente */}
        <div className="mt-6">
          <Card>
            <SectionTitle>¿Qué tema llevar a la acción?</SectionTitle>
            <p className="mb-3 mt-1 text-sm text-slate-500">
              Cuántas personas eligieron accionar cada tema en la Ronda 2.
            </p>
            <HBars data={themePopularity} big valueSuffix="" />
          </Card>
        </div>

        {themes.map((block) => (
          <ThemeSection key={block.themeId} block={block} />
        ))}

        <p className="mt-10 text-center text-xs text-white/50">
          La IA agrupó los roles equivalentes y eligió las experiencias más
          representativas de todo lo que se escribió.
        </p>
      </div>
    </main>
  );
}
