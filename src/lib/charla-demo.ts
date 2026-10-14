// Datos de EJEMPLO para ensayar la pantalla sin tocar la base:
//   /charla/pantalla?paso=5&demo=1
// Solo se usan en vista previa (?paso=N). Son inventados y fijos (no cambian
// al recargar): sirven para ver cómo se llenan las barras, no dicen nada real.

import { QUESTIONS, QUESTION_ORDER } from "@/config/charla";
import type { CharlaResults } from "@/lib/charla";

const PEOPLE = 42;

// Reparto fijo por opción (en el orden de las opciones de cada pregunta).
const SAMPLE: Record<string, number[]> = {
  ROL: [6, 17, 11, 3, 2, 1],
  SECTOR: [7, 9, 6, 3, 5, 4, 2, 2, 1, 1],
  PREP: [3, 12, 16, 7, 2],
  PASANTIAS: [9, 13, 8, 2, 6],
  BARRERAS: [11, 21, 14, 9, 6, 8, 2],
  CAPACIDADES: [19, 24, 15, 8, 12, 10, 9, 2],
  INFO: [22, 15, 17, 9, 3],
  COEXP: [18, 14, 11, 9, 6, 7, 2],
};
const ANSWERED: Record<string, number> = {
  ROL: 40,
  SECTOR: 40,
  PREP: 40,
  PASANTIAS: 38,
  BARRERAS: 33,
  CAPACIDADES: 35,
  POSICIONES: 21,
  INFO: 34,
  COEXP: 33,
  FRASE: 18,
};

export function demoResults(): CharlaResults {
  const counts: CharlaResults["counts"] = {};
  for (const id of QUESTION_ORDER) {
    const q = QUESTIONS[id];
    const sample = SAMPLE[id];
    if (!sample) continue;
    counts[id] = {};
    q.options.forEach((o, i) => {
      counts[id][o.id] = sample[i] ?? 0;
    });
  }
  return { people: PEOPLE, answered: { ...ANSWERED }, counts };
}
