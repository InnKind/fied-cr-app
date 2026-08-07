import { THEMES, SEATS_PER_TABLE, TABLES_PER_THEME } from "@/config/event";

// Distribución de mesas (batch, la dispara el administrador).
// Reglas (diseño 2 rondas):
//  - Respeta el TEMA elegido (cada tema tiene su bloque de mesas).
//  - BALANCEA la ocupación (coloca en la mesa menos ocupada del tema).
//  - SEPARA a quienes venían de la misma mesa inicial (base_table).
//  - NO optimiza por distancia física.
//  - PRESERVA las mesas ya asignadas: solo coloca a quienes aún no tienen mesa
//    (idempotente: re-correrlo ubica a los rezagados sin reordenar al resto).
// PENDIENTE: la mezcla de roles por tema (regla del equipo) se engancha aquí.

export type AssignInput = {
  id: string;
  base_table: number | null;
  selected_theme: string | null;
  current_table: number | null;
};

export type AssignResult = { id: string; current_table: number };

export function assignTables(participants: AssignInput[]): AssignResult[] {
  const results: AssignResult[] = [];

  THEMES.forEach((theme, idx) => {
    // Bloque de números de mesa de este tema.
    const themeTables: number[] = [];
    for (let t = 0; t < TABLES_PER_THEME; t++) {
      themeTables.push(idx * TABLES_PER_THEME + t + 1);
    }

    const inTheme = participants.filter((p) => p.selected_theme === theme.id);
    if (inTheme.length === 0) return;

    // Usa solo tantas mesas como hagan falta (~8 por mesa), no todo el bloque.
    const tablesNeeded = Math.min(
      TABLES_PER_THEME,
      Math.max(1, Math.ceil(inTheme.length / SEATS_PER_TABLE))
    );
    const activeTables = themeTables.slice(0, tablesNeeded);

    // Ocupación actual y mesas-iniciales ya presentes en cada mesa (por
    // asignaciones previas, para preservarlas y seguir balanceando).
    const occ = new Map<number, number>();
    // Por mesa: cuántas personas de cada mesa inicial hay (para dispersarlas).
    const baseCount = new Map<number, Map<number, number>>();
    activeTables.forEach((t) => {
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

    // Personas sin mesa aún, intercaladas por mesa inicial para dispersarlas.
    const ordered = spreadByBase(inTheme.filter((p) => p.current_table == null));

    for (const p of ordered) {
      // 1) Balancear: entre las mesas MENOS ocupadas...
      const minOcc = Math.min(...activeTables.map((t) => occ.get(t)!));
      const candidates = activeTables.filter((t) => occ.get(t)! === minOcc);
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
  });

  return results;
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
