// Datos del modo stand (navegador). Lee y escribe con la anon key; las tablas
// están en supabase/12-stand.sql. Nada de esto lleva datos personales: las
// respuestas van con un id anónimo; los contactos van aparte (stand_contacts).

import { supabase } from "@/lib/supabase";
import { SESSION, type Question, type QuestionId } from "@/config/stand";

export type StandAnswer = { choice?: string; choices?: string[]; text?: string };
export type ResponseRow = { anon_id: string; question_id: string; answer: StandAnswer };

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

// Pequeño envoltorio de localStorage que nunca lanza.
export const safeStorage = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      localStorage.setItem(key, value);
    } catch {
      // sin almacenamiento
    }
  },
  remove(key: string) {
    try {
      localStorage.removeItem(key);
    } catch {
      // sin almacenamiento
    }
  },
};

// ---------------------------------------------------------------------------
// Errores: distinguir "falta correr el SQL" de "no hay conexión"
// ---------------------------------------------------------------------------
export type StandError = {
  kind: "missing" | "network" | "other";
  message: string; // para el público
  detail?: string; // técnico (para Jerónimo)
};

export function classifyError(
  err: { code?: string; message?: string } | null | undefined
): StandError {
  const code = err?.code ?? "";
  const msg = err?.message ?? "";
  if (
    code === "PGRST205" ||
    code === "42P01" ||
    /does not exist|could not find the table|schema cache/i.test(msg)
  ) {
    return {
      kind: "missing",
      message: "El modo stand todavía no está activado.",
      detail: "Falta correr supabase/12-stand.sql en el SQL Editor de Supabase.",
    };
  }
  if (/failed to fetch|networkerror|network request failed|fetch failed|load failed/i.test(msg)) {
    return {
      kind: "network",
      message: "Sin conexión. Reintentando…",
      detail: msg,
    };
  }
  return { kind: "other", message: "No se pudo conectar con la sesión.", detail: msg || code };
}

// ---------------------------------------------------------------------------
// Estado de la sesión
// ---------------------------------------------------------------------------
export type StepRow = { step: number; updated_at: string | null };

export async function fetchStep(): Promise<{ row: StepRow | null; error: StandError | null }> {
  try {
    const { data, error } = await supabase
      .from("stand_state")
      .select("step, updated_at")
      .eq("session", SESSION)
      .maybeSingle();
    if (error) return { row: null, error: classifyError(error) };
    if (!data) return { row: { step: 0, updated_at: null }, error: null };
    return { row: data as StepRow, error: null };
  } catch (e) {
    return { row: null, error: classifyError(e as Error) };
  }
}

// ---------------------------------------------------------------------------
// Respuestas
// ---------------------------------------------------------------------------
const PAGE = 1000;

// Todas las respuestas de la sesión (paginado: PostgREST corta en 1000 filas).
export async function fetchResponses(opts?: {
  only?: QuestionId[];
  exclude?: QuestionId[];
}): Promise<{ rows: ResponseRow[]; error: StandError | null }> {
  const rows: ResponseRow[] = [];
  try {
    for (let from = 0; from < 50000; from += PAGE) {
      let q = supabase
        .from("stand_responses")
        .select("anon_id, question_id, answer")
        .eq("session", SESSION)
        .order("id", { ascending: true })
        .range(from, from + PAGE - 1);
      if (opts?.only?.length) q = q.in("question_id", opts.only);
      if (opts?.exclude?.length) {
        for (const x of opts.exclude) q = q.neq("question_id", x);
      }
      const { data, error } = await q;
      if (error) return { rows, error: classifyError(error) };
      rows.push(...((data ?? []) as ResponseRow[]));
      if (!data || data.length < PAGE) break;
    }
    return { rows, error: null };
  } catch (e) {
    return { rows, error: classifyError(e as Error) };
  }
}

export async function fetchMyAnswers(
  anonId: string
): Promise<{ answers: Record<string, StandAnswer> | null; error: StandError | null }> {
  try {
    const { data, error } = await supabase
      .from("stand_responses")
      .select("question_id, answer")
      .eq("session", SESSION)
      .eq("anon_id", anonId);
    if (error) return { answers: null, error: classifyError(error) };
    const out: Record<string, StandAnswer> = {};
    for (const r of data ?? []) out[r.question_id as string] = r.answer as StandAnswer;
    return { answers: out, error: null };
  } catch (e) {
    return { answers: null, error: classifyError(e as Error) };
  }
}

// UPSERT: la persona puede cambiar su respuesta. Sin .select() a propósito.
export async function saveAnswer(
  anonId: string,
  questionId: QuestionId,
  answer: StandAnswer
): Promise<StandError | null> {
  try {
    const { error } = await supabase.from("stand_responses").upsert(
      { session: SESSION, anon_id: anonId, question_id: questionId, answer },
      { onConflict: "session,anon_id,question_id" }
    );
    return error ? classifyError(error) : null;
  } catch (e) {
    return classifyError(e as Error);
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

export function tally(rows: ResponseRow[], q: Question): Tally {
  const counts: Record<string, number> = {};
  for (const o of q.options) counts[o.id] = 0;
  const people = new Set<string>();
  for (const r of rows) {
    if (r.question_id !== q.id || !r.answer) continue;
    if (q.mode === "text") {
      if (typeof r.answer.text === "string" && r.answer.text.trim()) people.add(r.anon_id);
      continue;
    }
    const picks =
      q.mode === "multi"
        ? Array.isArray(r.answer.choices)
          ? r.answer.choices
          : []
        : typeof r.answer.choice === "string"
          ? [r.answer.choice]
          : [];
    const valid = Array.from(new Set(picks)).filter((p) => p in counts);
    if (valid.length === 0) continue;
    people.add(r.anon_id);
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
  return { counts, respondents: people.size, top };
}

// Personas distintas con al menos una respuesta.
export function distinctPeople(rows: ResponseRow[], only?: QuestionId[]): number {
  const s = new Set<string>();
  for (const r of rows) {
    if (only && !only.includes(r.question_id as QuestionId)) continue;
    s.add(r.anon_id);
  }
  return s.size;
}

export function pct(n: number, total: number): number {
  if (!total) return 0;
  return Math.round((n / total) * 100);
}
