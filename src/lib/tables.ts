import { THEMES, SEATS_PER_TABLE, TABLES_PER_THEME } from "@/config/event";

// Asigna un número de mesa a alguien que eligió un tema, según cuántas personas
// ya fueron asignadas a ese tema (se llena de a 8 por mesa, en el bloque del tema).
// NOTA: la numeración es un PLACEHOLDER; el mapeo real tema→mesas depende de la
// distribución física del salón (por definir). También hay que endurecer contra
// asignaciones simultáneas (por ahora, cálculo simple por conteo).
export function assignTableForTheme(
  themeId: string,
  alreadyInTheme: number
): number | null {
  const idx = THEMES.findIndex((t) => t.id === themeId);
  if (idx < 0) return null;
  const localTable = Math.floor(alreadyInTheme / SEATS_PER_TABLE); // 0-based dentro del tema
  return idx * TABLES_PER_THEME + localTable + 1; // número global de mesa
}
