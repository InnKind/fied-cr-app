// Tipos del resultado del procesamiento de la Ronda 2 (guardado en synthesis
// round=2 por /api/process-round2) y helpers para la vista de resultados.

import type { IdeaTriple } from "@/lib/round1";

export type Round2ThemeBlock = {
  themeId: string;
  themeTitle: string;
  peopleCount: number;
  // rol del participante (id del catálogo ROLES) -> cuántos eligieron este tema
  roleDistribution: Record<string, number>;
  // roles a involucrar (texto libre, agrupados por la IA) con su conteo
  topRoles: { role: string; count: number }[];
  // experiencias que inspiran, elegidas por los 3 criterios
  experiences: IdeaTriple;
};

export type Round2Payload = {
  kind?: string;
  themes: Round2ThemeBlock[];
};
