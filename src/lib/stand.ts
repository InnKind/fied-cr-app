// Datos del modo stand (navegador). Usa la anon key; las tablas y funciones
// están en supabase/12-stand.sql. Las respuestas NO se leen ni escriben directo
// en la tabla: pasan por las funciones stand_answer, stand_my_answers y
// stand_results, que nunca devuelven los id anónimos ni los textos abiertos.
// Los contactos van aparte (stand_contacts, solo insertar).

import { supabase } from "@/lib/supabase";
import { P3_NONE, SESSION, type Question, type QuestionId } from "@/config/stand";

export type StandAnswer = { choice?: string; choices?: string[]; text?: string };
// Una respuesta sin id anónimo: cada fila es una persona en esa pregunta.
export type ResponseRow = { question_id: string; answer: StandAnswer };
export type StandResults = {
  rows: ResponseRow[];
  people: number; // personas distintas con al menos una respuesta
  abierta: number; // propuestas escritas en la pregunta abierta
};

// ---------------------------------------------------------------------------
// Tiempo máximo de cada consulta. supabase-js no trae uno: si la red se cuelga
// (cambio de wifi a 4G, MiFi saturado), la consulta quedaría esperando minutos.
// AbortController + setTimeout (AbortSignal.timeout no existe en iOS 15).
// ---------------------------------------------------------------------------
export const DB_TIMEOUT_MS = 8000;

export function timeoutSignal(ms = DB_TIMEOUT_MS): { signal: AbortSignal; clear: () => void } {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return { signal: ctrl.signal, clear: () => clearTimeout(t) };
}

// ---------------------------------------------------------------------------
// Id anónimo del celular (localStorage "stand_anon_id")
// ---------------------------------------------------------------------------
const ANON_KEY = "stand_anon_id";
let memoryAnonId: string | null = null;

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

export function getAnonId(): string {
  if (memoryAnonId) return memoryAnonId;
  try {
    const v = localStorage.getItem(ANON_KEY);
    if (v && v.length >= 8 && v.length <= 64) {
      memoryAnonId = v;
      return v;
    }
  } catch {
    // modo privado o almacenamiento bloqueado: id solo en memoria
  }
  const id = newId();
  memoryAnonId = id;
  try {
    localStorage.setItem(ANON_KEY, id);
  } catch {
    // sin almacenamiento: el id dura mientras la pestaña esté abierta
  }
  return id;
}

// Envoltorios de localStorage y sessionStorage que nunca lanzan.
function makeStorage(pick: () => Storage) {
  return {
    get(key: string): string | null {
      try {
        return pick().getItem(key);
      } catch {
        return null;
      }
    },
    set(key: string, value: string) {
      try {
        pick().setItem(key, value);
      } catch {
        // sin almacenamiento
      }
    },
    remove(key: string) {
      try {
        pick().removeItem(key);
      } catch {
        // sin almacenamiento
      }
    },
  };
}
export const safeStorage = makeStorage(() => localStorage);
export const safeSession = makeStorage(() => sessionStorage);

// ---------------------------------------------------------------------------
// Errores: distinguir "falta correr el SQL" de "no hay conexión"
// ---------------------------------------------------------------------------
export type StandError = {
  kind: "missing" | "network" | "other";
  message: string; // para el público
  detail?: string; // técnico (para Jerónimo)
};

export function classifyError(
  err: { code?: string; message?: string; name?: string } | null | undefined
): StandError {
  const code = err?.code ?? "";
  const msg = err?.message ?? "";
  if (
    code === "PGRST205" ||
    code === "PGRST202" ||
    code === "42P01" ||
    code === "42883" ||
    /does not exist|could not find the (table|function)|schema cache/i.test(msg)
  ) {
    return {
      kind: "missing",
      message: "El modo stand todavía no está activado.",
      detail: "Falta correr supabase/12-stand.sql en el SQL Editor de Supabase.",
    };
  }
  if (
    err?.name === "AbortError" ||
    /abort|timed? ?out|failed to fetch|networkerror|network request failed|fetch failed|load failed/i.test(
      msg
    )
  ) {
    return {
      kind: "network",
      message: "Sin conexión. Reintentando…",
      detail: /abort/i.test(msg) || err?.name === "AbortError" ? "Tiempo de espera agotado." : msg,
    };
  }
  return { kind: "other", message: "No se pudo conectar con la sesión.", detail: msg || code };
}

// ---------------------------------------------------------------------------
// Estado de la sesión
// ---------------------------------------------------------------------------
// updated_at se guarda TAL CUAL llega (texto): la pantalla lo devuelve al
// servidor para detectar si otro controlador movió la sesión.
export type StepRow = { step: number; updated_at: string | null };

export async function fetchStep(): Promise<{ row: StepRow | null; error: StandError | null }> {
  const t = timeoutSignal();
  try {
    const { data, error } = await supabase
      .from("stand_state")
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
// Respuestas
// ---------------------------------------------------------------------------
function toNumber(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

// Resultados de la sesión (sin id anónimos ni textos abiertos).
export async function fetchResults(): Promise<{ data: StandResults | null; error: StandError | null }> {
  const t = timeoutSignal();
  try {
    const { data, error } = await supabase
      .rpc("stand_results", { p_session: SESSION })
      .abortSignal(t.signal);
    if (error) return { data: null, error: classifyError(error) };
    const raw = (data ?? {}) as { people?: unknown; abierta?: unknown; rows?: unknown };
    const rows: ResponseRow[] = [];
    if (Array.isArray(raw.rows)) {
      for (const r of raw.rows as { question_id?: unknown; answer?: unknown }[]) {
        if (r && typeof r.question_id === "string" && r.answer && typeof r.answer === "object") {
          rows.push({ question_id: r.question_id, answer: r.answer as StandAnswer });
        }
      }
    }
    return {
      data: { rows, people: toNumber(raw.people), abierta: toNumber(raw.abierta) },
      error: null,
    };
  } catch (e) {
    return { data: null, error: classifyError(e as Error) };
  } finally {
    t.clear();
  }
}

export async function fetchMyAnswers(
  anonId: string
): Promise<{ answers: Record<string, StandAnswer> | null; error: StandError | null }> {
  const t = timeoutSignal();
  try {
    const { data, error } = await supabase
      .rpc("stand_my_answers", { p_session: SESSION, p_anon_id: anonId })
      .abortSignal(t.signal);
    if (error) return { answers: null, error: classifyError(error) };
    const out: Record<string, StandAnswer> = {};
    if (data && typeof data === "object" && !Array.isArray(data)) {
      for (const [q, a] of Object.entries(data as Record<string, unknown>)) {
        if (a && typeof a === "object") out[q] = a as StandAnswer;
      }
    }
    return { answers: out, error: null };
  } catch (e) {
    return { answers: null, error: classifyError(e as Error) };
  } finally {
    t.clear();
  }
}

// UPSERT (la persona puede cambiar su respuesta) a través de stand_answer.
export async function saveAnswer(
  anonId: string,
  questionId: QuestionId,
  answer: StandAnswer
): Promise<StandError | null> {
  const t = timeoutSignal();
  try {
    const { error } = await supabase
      .rpc("stand_answer", {
        p_session: SESSION,
        p_anon_id: anonId,
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

// ---------------------------------------------------------------------------
// Conteos
// ---------------------------------------------------------------------------
export type Tally = {
  counts: Record<string, number>;
  respondents: number; // personas que respondieron esa pregunta
  top: string | null; // opción más votada (empate → la primera en el orden)
};

// Cada fila es una persona (la base guarda una fila por persona y pregunta).
// Se ignora lo que no calce con las opciones: ids desconocidos, más opciones
// que el máximo o "Ninguna" junto con otras.
export function tally(rows: ResponseRow[], q: Question): Tally {
  const counts: Record<string, number> = {};
  const ids = new Set(q.options.map((o) => o.id));
  for (const o of q.options) counts[o.id] = 0;
  let respondents = 0;
  for (const r of rows) {
    if (r.question_id !== q.id || !r.answer) continue;
    if (q.mode === "text") {
      if (typeof r.answer.text === "string" && r.answer.text.trim()) respondents += 1;
      continue;
    }
    const picks: unknown[] =
      q.mode === "multi"
        ? Array.isArray(r.answer.choices)
          ? r.answer.choices
          : []
        : [r.answer.choice];
    const valid = Array.from(
      new Set(picks.filter((p): p is string => typeof p === "string" && ids.has(p)))
    );
    if (valid.length === 0) continue;
    if (q.mode === "multi") {
      if (valid.length > (q.max ?? Infinity)) continue;
      if (valid.length > 1 && valid.includes(P3_NONE)) continue;
    }
    respondents += 1;
    for (const p of valid) counts[p] += 1;
  }
  let top: string | null = null;
  let best = 0;
  for (const o of q.options) {
    if (counts[o.id] > best) {
      best = counts[o.id];
      top = o.id;
    }
  }
  return { counts, respondents, top };
}

export function pct(n: number, total: number): number {
  if (!total) return 0;
  return Math.round((n / total) * 100);
}
