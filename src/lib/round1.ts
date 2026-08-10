// Tipos del resultado del procesamiento de la Ronda 1 (guardado en synthesis
// round=1 por /api/process-round1) y helpers para la presentación.

export type IdeaTriple = {
  mostRepeated?: string;
  easiest?: string;
  mostDisruptive?: string;
};

export type Round1Slide = {
  moment: string;
  tables: number;
  ai: IdeaTriple;
  agency: IdeaTriple;
  live?: boolean; // marcada por David para mostrar en vivo (curaduría)
};

export type Round1ThemeBlock = {
  themeId: string;
  themeTitle: string;
  slides: Round1Slide[];
};

export type Round1Payload = {
  kind?: string;
  themes: Round1ThemeBlock[];
};

export type FlatSlide = Round1Slide & { themeTitle: string; themeId: string };

// Junta todas las diapositivas. Si David marcó algunas "en vivo", muestra solo
// esas; si todavía no curó nada, muestra todas (para que nunca quede vacío).
export function flattenSlides(payload: Round1Payload | null): FlatSlide[] {
  if (!payload?.themes) return [];
  const all: FlatSlide[] = [];
  for (const t of payload.themes) {
    for (const s of t.slides ?? []) {
      all.push({ ...s, themeTitle: t.themeTitle, themeId: t.themeId });
    }
  }
  const live = all.filter((s) => s.live === true);
  return live.length ? live : all;
}
