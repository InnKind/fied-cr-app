import { THEMES, SEATS_PER_TABLE } from "@/config/event";

// Distribución DINÁMICA de mesas (batch, la dispara el administrador).
// Reglas (diseño 2 rondas):
//  - Reparte las mesas REALES del salón entre los temas según la DEMANDA
//    (~8 por mesa), sin bloques fijos ni tope por tema.
//  - El tema de cada mesa se decide aquí y se devuelve en `mapEntries` para
//    guardarlo (tabla table_themes) — ya no se deduce por número de mesa.
//  - BALANCEA la ocupación y SEPARA a quienes venían de la misma mesa inicial.
//  - PRESERVA lo ya asignado: solo coloca a quienes no tienen mesa y solo agrega
//    mesas nuevas si un tema las necesita (idempotente para rezagados).
// PENDIENTE: la mezcla de roles por tema (regla del equipo) se engancha aquí.

export type AssignInput = {
  id: string;
  base_table: number | null;
  selected_theme: string | null;
  current_table: number | null;
};

export type AssignResult = { id: string; current_table: number };
export type MapEntry = { table_number: number; theme: string };
export type AssignOutput = { results: AssignResult[]; mapEntries: MapEntry[] };

export function assignTables(
  participants: AssignInput[],
  existingMap: Record<number, string>,
  totalTables: number
): AssignOutput {
  const results: AssignResult[] = [];
  const mapEntries: MapEntry[] = [];

  // Pool de mesas libres: 1..totalTables que aún no pertenecen a ningún tema.
  const used = new Set<number>(Object.keys(existingMap).map(Number));
  const freePool: number[] = [];
  for (let t = 1; t <= totalTables; t++) if (!used.has(t)) freePool.push(t);

  for (const theme of THEMES) {
    const inTheme = participants.filter((p) => p.selected_theme === theme.id);
    if (inTheme.length === 0) continue;

    // Mesas que este tema YA tiene (de una distribución previa) + las nuevas que
    // necesite según la demanda total, tomadas del pool libre.
    const themeTables: number[] = Object.entries(existingMap)
      .filter(([, th]) => th === theme.id)
      .map(([t]) => Number(t))
      .sort((a, b) => a - b);

    const needed = Math.max(1, Math.ceil(inTheme.length / SEATS_PER_TABLE));
    while (themeTables.length < needed && freePool.length > 0) {
      const t = freePool.shift()!;
      themeTables.push(t);
      mapEntries.push({ table_number: t, theme: theme.id });
    }
    if (themeTables.length === 0) continue; // salón sin mesas libres

    // Ocupación actual + gente por mesa inicial (para preservar y balancear).
    const occ = new Map<number, number>();
    const baseCount = new Map<number, Map<number, number>>();
    themeTables.forEach((t) => {
      occ.set(t, 0);
      baseCount.set(t, new Map());
    });
    for (const p of inTheme) {
      if (p.current_table != null && occ.has(p.current_table)) {
        occ.set(p.current_table, occ.get(p.current_table)! + 1);
        if (p.base_table != null) {
          const m = baseCount.get(p.current_table)!;
          m.set(p.base_table, (m.get(p.base_table) ?? 0) + 1);
        }
      }
    }

    // Personas sin mesa, intercaladas por mesa inicial para dispersarlas.
    const ordered = spreadByBase(inTheme.filter((p) => p.current_table == null));
    for (const p of ordered) {
      // 1) Balancear: entre las mesas MENOS ocupadas del tema...
      const minOcc = Math.min(...themeTables.map((t) => occ.get(t)!));
      const candidates = themeTables.filter((t) => occ.get(t)! === minOcc);
      // 2) Separar: ...la que tenga MENOS gente de mi misma mesa inicial.
      let chosen = candidates[0];
      if (p.base_table != null && candidates.length > 1) {
        let fewest = Infinity;
        for (const t of candidates) {
          const c = baseCount.get(t)!.get(p.base_table) ?? 0;
          if (c < fewest) {
            fewest = c;
            chosen = t;
          }
        }
      }
      occ.set(chosen, occ.get(chosen)! + 1);
      if (p.base_table != null) {
        const m = baseCount.get(chosen)!;
        m.set(p.base_table, (m.get(p.base_table) ?? 0) + 1);
      }
      results.push({ id: p.id, current_table: chosen });
    }
  }

  return { results, mapEntries };
}

// Intercala por mesa inicial (round-robin de "buckets") para que quienes venían
// juntos queden separados en el orden de colocación.
function spreadByBase(people: AssignInput[]): AssignInput[] {
  const buckets = new Map<string, AssignInput[]>();
  for (const p of people) {
    const key = p.base_table == null ? "none" : String(p.base_table);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(p);
  }
  const lists = [...buckets.values()];
  const out: AssignInput[] = [];
  let added = true;
  while (added) {
    added = false;
    for (const list of lists) {
      const next = list.shift();
      if (next) {
        out.push(next);
        added = true;
      }
    }
  }
  return out;
}
