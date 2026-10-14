// Datos de la charla (navegador). Usa la anon key; las tablas y funciones están
// en supabase/14-charla.sql y 15-charla-anonima.sql. El navegador NO lee ni
// escribe las tablas: pasa por charla_answer, charla_me, charla_results y
// charla_contact. Las respuestas son anónimas (código aleatorio del celular) y
// el contacto opcional se guarda aparte, sin ese código.

import { supabase } from "@/lib/supabase";
import {
  OTHER_ID,
  QUESTIONS,
  SESSION,
  type Contact,
  type ContactOptionId,
  type Question,
  type QuestionId,
} from "@/config/charla";
import {
  classifyError as classifyStandError,
  safeStorage,
  timeoutSignal,
  type StandError,
} from "@/lib/stand";

export { safeStorage, safeSession } from "@/lib/stand";

// rejected: la base recibió el envío y lo rechazó (no es un problema de conexión).
export type CharlaError = StandError & { rejected?: boolean };
export type CharlaAnswer = { choice?: string; choices?: string[]; other?: string; text?: string };
export type Mine = Partial<Record<QuestionId, CharlaAnswer>>;

// Conteos de la sala (sin nombres ni textos).
export type CharlaResults = {
  people: number; // celulares con al menos una respuesta
  answered: Record<string, number>; // personas que respondieron cada pregunta
  counts: Record<string, Record<string, number>>; // pregunta → opción → veces elegida
};
export const EMPTY_RESULTS: CharlaResults = { people: 0, answered: {}, counts: {} };

const SQL_FILE = "supabase/14-charla.sql y 15-charla-anonima.sql";

// Rechazos de las funciones de la base («charla: …»), dichos para la persona.
// El texto original queda en `detail`.
const REJECTIONS: [RegExp, string][] = [
  [/sesión llena/i, "La sesión ya no admite más personas."],
  [/datos inválidos/i, "Revise sus datos: falta el nombre o el correo no está bien escrito."],
  [/falta el consentimiento/i, "Para enviar sus datos, marque la casilla de autorización."],
  [/opciones inválidas/i, "Elija al menos una forma de seguir en contacto."],
  [/sesión inválida/i, "La sesión no está disponible."],
];

function classifyError(
  err: { code?: string; message?: string; name?: string } | null | undefined
): CharlaError {
  const msg = err?.message ?? "";
  if (/charla:/i.test(msg)) {
    const known = REJECTIONS.find(([re]) => re.test(msg));
    return {
      kind: "other",
      rejected: true,
      message: known ? known[1] : "No se pudo guardar. Recargue la página e inténtelo de nuevo.",
      detail: msg,
    };
  }
  const e = classifyStandError(err);
  if (e.kind === "missing") {
    return {
      kind: "missing",
      message: "La sesión todavía no está activada.",
      detail: `Falta correr ${SQL_FILE} en el SQL Editor de Supabase.`,
    };
  }
  return e;
}

// ---------------------------------------------------------------------------
// Código anónimo del celular (localStorage). Es propio de esta charla: no se
// comparte con el id anónimo del stand y nunca se envía junto con el contacto.
// ---------------------------------------------------------------------------
const PID_KEY = `charla_pid_${SESSION}`;
let memoryPid: string | null = null;

function newId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    // randomUUID solo existe en contextos seguros (https o localhost).
  }
  try {
    if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
      const b = new Uint8Array(16);
      crypto.getRandomValues(b);
      return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
    }
  } catch {
    // sigue al respaldo
  }
  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2) +
    Math.random().toString(36).slice(2)
  ).slice(0, 32);
}

export function getPid(): string {
  if (memoryPid) return memoryPid;
  const v = safeStorage.get(PID_KEY);
  if (v && v.length >= 8 && v.length <= 64) {
    memoryPid = v;
    return v;
  }
  const id = newId();
  memoryPid = id;
  safeStorage.set(PID_KEY, id);
  return id;
}

// ---------------------------------------------------------------------------
// Estado de la sesión
// ---------------------------------------------------------------------------
export type StepRow = { step: number; updated_at: string | null };

export async function fetchStep(): Promise<{ row: StepRow | null; error: CharlaError | null }> {
  const t = timeoutSignal();
  try {
    const { data, error } = await supabase
      .from("charla_state")
      .select("step, updated_at")
      .eq("session", SESSION)
      .abortSignal(t.signal)
      .maybeSingle();
    if (error) return { row: null, error: classifyError(error) };
    if (!data) return { row: { step: 0, updated_at: null }, error: null };
    return { row: data as StepRow, error: null };
  } catch (e) {
    return { row: null, error: classifyError(e as Error) };
  } finally {
    t.clear();
  }
}

// ---------------------------------------------------------------------------
// Respuestas (anónimas) y contacto (opcional, aparte)
// ---------------------------------------------------------------------------
// Guarda el contacto opcional del final. A propósito NO recibe el código del
// celular: así el contacto no se puede unir con las respuestas.
export async function sendContact(
  opciones: ContactOptionId[],
  c: Contact,
  consentimiento: boolean
): Promise<CharlaError | null> {
  const t = timeoutSignal();
  try {
    const { error } = await supabase
      .rpc("charla_contact", {
        p_session: SESSION,
        p_opciones: opciones,
        p_nombre: c.nombre,
        p_organizacion: c.organizacion,
        p_cargo: c.cargo,
        p_correo: c.correo,
        p_consentimiento: consentimiento,
      })
      .abortSignal(t.signal);
    return error ? classifyError(error) : null;
  } catch (e) {
    return classifyError(e as Error);
  } finally {
    t.clear();
  }
}

export async function saveAnswer(
  pid: string,
  questionId: QuestionId,
  answer: CharlaAnswer
): Promise<CharlaError | null> {
  const t = timeoutSignal();
  try {
    const { error } = await supabase
      .rpc("charla_answer", {
        p_session: SESSION,
        p_pid: pid,
        p_question_id: questionId,
        p_answer: answer,
      })
      .abortSignal(t.signal);
    return error ? classifyError(error) : null;
  } catch (e) {
    return classifyError(e as Error);
  } finally {
    t.clear();
  }
}

// Lo que este celular ya respondió (según la base).
export async function fetchMe(pid: string): Promise<{ answers: Mine; error: CharlaError | null }> {
  const t = timeoutSignal();
  try {
    const { data, error } = await supabase
      .rpc("charla_me", { p_session: SESSION, p_pid: pid })
      .abortSignal(t.signal);
    if (error) return { answers: {}, error: classifyError(error) };
    const raw = (data ?? {}) as { answers?: unknown };
    const answers: Mine = {};
    if (raw.answers && typeof raw.answers === "object" && !Array.isArray(raw.answers)) {
      for (const [q, a] of Object.entries(raw.answers as Record<string, unknown>)) {
        if (q in QUESTIONS && a && typeof a === "object") answers[q as QuestionId] = a as CharlaAnswer;
      }
    }
    return { answers, error: null };
  } catch (e) {
    return { answers: {}, error: classifyError(e as Error) };
  } finally {
    t.clear();
  }
}

function toNumber(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export async function fetchResults(): Promise<{
  data: CharlaResults | null;
  error: CharlaError | null;
}> {
  const t = timeoutSignal();
  try {
    const { data, error } = await supabase
      .rpc("charla_results", { p_session: SESSION })
      .abortSignal(t.signal);
    if (error) return { data: null, error: classifyError(error) };
    const raw = (data ?? {}) as { people?: unknown; answered?: unknown; counts?: unknown };
    const answered: Record<string, number> = {};
    if (raw.answered && typeof raw.answered === "object") {
      for (const [q, n] of Object.entries(raw.answered as Record<string, unknown>)) {
        answered[q] = toNumber(n);
      }
    }
    const counts: Record<string, Record<string, number>> = {};
    if (raw.counts && typeof raw.counts === "object") {
      for (const [q, c] of Object.entries(raw.counts as Record<string, unknown>)) {
        if (!c || typeof c !== "object") continue;
        counts[q] = {};
        for (const [o, n] of Object.entries(c as Record<string, unknown>)) counts[q][o] = toNumber(n);
      }
    }
    return { data: { people: toNumber(raw.people), answered, counts }, error: null };
  } catch (e) {
    return { data: null, error: classifyError(e as Error) };
  } finally {
    t.clear();
  }
}

// ---------------------------------------------------------------------------
// Conteos por pregunta
// ---------------------------------------------------------------------------
export type Tally = {
  counts: Record<string, number>; // por opción (0 si nadie la eligió)
  respondents: number; // personas que respondieron la pregunta
  top: string | null; // opción más elegida (empate → la primera en el orden)
  mean: number | null; // solo escala: promedio
};

export function tallyOf(res: CharlaResults, q: Question): Tally {
  const raw = res.counts[q.id] ?? {};
  const counts: Record<string, number> = {};
  for (const o of q.options) counts[o.id] = raw[o.id] ?? 0;
  const respondents = res.answered[q.id] ?? 0;
  let top: string | null = null;
  let best = 0;
  for (const o of q.options) {
    if (counts[o.id] > best) {
      best = counts[o.id];
      top = o.id;
    }
  }
  let mean: number | null = null;
  if (q.mode === "scale") {
    let sum = 0;
    let n = 0;
    for (const o of q.options) {
      sum += Number(o.id) * counts[o.id];
      n += counts[o.id];
    }
    mean = n ? sum / n : null;
  }
  return { counts, respondents, top, mean };
}

export function pct(n: number, total: number): number {
  if (!total) return 0;
  return Math.round((n / total) * 100);
}

// Promedio con coma decimal («3,4»).
export function formatMean(mean: number | null): string {
  return mean === null ? "–" : mean.toFixed(1).replace(".", ",");
}

// ---------------------------------------------------------------------------
// Respuestas: forma y texto
// ---------------------------------------------------------------------------
// ¿La respuesta guardada cuenta como respondida?
export function isAnswered(q: Question, a: CharlaAnswer | undefined): boolean {
  if (!a) return false;
  if (q.mode === "text") return typeof a.text === "string" && a.text.trim().length > 0;
  if (q.mode === "multi") return Array.isArray(a.choices) && a.choices.length > 0;
  return typeof a.choice === "string" && a.choice.length > 0;
}

// Renglones para mostrarle a la persona lo que respondió.
export function answerLines(q: Question, a: CharlaAnswer | undefined): string[] {
  if (!a) return [];
  if (q.mode === "text") return a.text ? [a.text] : [];
  const ids = q.mode === "multi" ? (a.choices ?? []) : a.choice ? [a.choice] : [];
  return ids.map((id) => {
    const o = q.options.find((x) => x.id === id);
    if (!o) return id;
    if (o.id === OTHER_ID && a.other) return `${o.label}: ${a.other}`;
    if (q.mode === "scale") return `${o.label} de ${q.options.length}`;
    return o.label;
  });
}

// Alterna una opción en una pregunta de varias: respeta el máximo y que
// «Ninguna por ahora» vaya sola. Devuelve la selección nueva y, si no se pudo
// agregar, un aviso.
export function toggleChoice(
  q: Question,
  sel: string[],
  id: string
): { sel: string[]; hint: string | null } {
  const opt = q.options.find((o) => o.id === id);
  if (!opt) return { sel, hint: null };
  if (sel.includes(id)) return { sel: sel.filter((x) => x !== id), hint: null };
  if (opt.exclusive) return { sel: [id], hint: null };
  const rest = sel.filter((x) => !q.options.find((o) => o.id === x)?.exclusive);
  if (q.max && rest.length >= q.max) {
    return { sel: rest, hint: `Máximo ${q.max}: quite una para elegir otra.` };
  }
  return { sel: [...rest, id], hint: null };
}
