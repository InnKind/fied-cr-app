"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { THEMES, isPlaceholder, numberedThemeTitle } from "@/config/event";
import { BRAND_BG } from "@/lib/brand";
import BrandLogo from "@/components/BrandLogo";

// Fase ROUND1_PHYSICAL_ACTIVITY: mientras el facilitador guía la mesa, la
// persona ve por escrito la provocación y la pregunta de su tema (para quien
// prefiere leer o no alcanzó a escuchar). El texto real lo pone el equipo; si
// sigue en "POR DEFINIR", no se muestra (queda solo el aviso de seguir al
// facilitador).
export default function PhysicalActivity({
  participantId,
  accent,
}: {
  participantId: string;
  accent?: string;
}) {
  const [theme, setTheme] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    supabase
      .from("participants")
      .select("selected_theme")
      .eq("id", participantId)
      .single()
      .then(({ data }) => {
        if (!active) return;
        setTheme((data?.selected_theme as string | null) ?? null);
        setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [participantId]);

  const t = THEMES.find((x) => x.id === theme);
  const showProvocation = t && !isPlaceholder(t.provocation);
  const showQuestion = t && !isPlaceholder(t.openingQuestion);

  return (
    <main
      className="flex-1 flex items-center justify-center p-6"
      style={{ background: BRAND_BG }}
    >
      <div className="w-full max-w-md text-center">
        <BrandLogo className="mx-auto mb-6" />
        {accent && (
          <span
            className="mb-4 inline-block h-3 w-3 rounded-full"
            style={{ backgroundColor: accent }}
          />
        )}
        <h1 className="text-2xl font-semibold text-white">Actividad en tu mesa</h1>

        {loaded && (showProvocation || showQuestion) ? (
          <div className="mt-6 rounded-2xl bg-white/10 p-5 text-left ring-1 ring-white/15">
            {t && (
              <p className="text-xs font-semibold uppercase tracking-wider text-teal-200">
                {numberedThemeTitle(t.id)}
              </p>
            )}
            {showProvocation && (
              <p className="mt-2 text-lg font-medium text-white">{t!.provocation}</p>
            )}
            {showQuestion && (
              <p className="mt-3 text-white/85">{t!.openingQuestion}</p>
            )}
          </div>
        ) : null}

        <p className="mt-6 text-white/80">
          Sigue al facilitador. Por ahora no necesitas el celular.
        </p>
        <div className="mt-8 flex justify-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-teal-300 animate-bounce [animation-delay:-0.2s]" />
          <span className="h-2 w-2 rounded-full bg-teal-300 animate-bounce [animation-delay:-0.1s]" />
          <span className="h-2 w-2 rounded-full bg-teal-300 animate-bounce" />
        </div>
      </div>
    </main>
  );
}
