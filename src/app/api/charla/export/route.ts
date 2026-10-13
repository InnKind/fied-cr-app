import { NextRequest } from "next/server";
import { hasServiceRole, supabaseAdmin } from "@/lib/supabase-admin";
import { checkStandKey } from "@/lib/stand-server";
import {
  QUESTIONS,
  QUESTION_ORDER,
  SESSION,
  optionLabel,
  type Question,
  type QuestionId,
} from "@/config/charla";

// Exporta la charla a CSV (UTF-8 con BOM, para Excel y la base maestra).
//   GET /api/charla/export?type=personas    → una fila por persona, con sus datos
//                                             y una columna por pregunta (como la
//                                             hoja de un formulario de Google)
//   GET /api/charla/export?type=respuestas  → una fila por respuesta (formato largo)
// La clave es la misma del stand y va en el encabezado x-stand-key (NUNCA en la
// URL: quedaría en los registros de Vercel y en el historial del navegador). La
// página /charla/exportar la pide y descarga el archivo.
// Opcional: &sep=semicolon (Excel en configuración regional con coma decimal).
// Lee con service role: el público no puede leer charla_people ni charla_responses.
// El archivo trae nombres y correos; el pid (el código del celular) no sale.

type Row = Record<string, unknown>;
type ExportType = "personas" | "respuestas";

const PAGE = 1000;
const SQL_FILE = "supabase/14-charla.sql";
// Marca de orden de bytes (U+FEFF): con ella Excel abre el archivo como UTF-8.
const BOM = String.fromCharCode(0xfeff);

async function readAll(
  table: string,
  columns: string
): Promise<{ rows: Row[]; error: string | null }> {
  const rows: Row[] = [];
  for (let from = 0; from < 200000; from += PAGE) {
    const { data, error } = await supabaseAdmin
      .from(table)
      .select(columns)
      .eq("session", SESSION)
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) {
      // Tabla inexistente: todavía no se corrió el SQL de la charla.
      const missing = error.code === "PGRST205" || error.code === "42P01";
      return { rows, error: missing ? `${error.message} (falta correr ${SQL_FILE})` : error.message };
    }
    const page = (data ?? []) as unknown as Row[];
    rows.push(...page);
    if (page.length < PAGE) break;
  }
  return { rows, error: null };
}

function cell(v: unknown): string {
  if (v === null || v === undefined) return "";
  let s = typeof v === "boolean" ? (v ? "TRUE" : "FALSE") : String(v);
  // Evita que Excel interprete un texto como fórmula (inyección CSV).
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return s;
}

function toCsv(header: string[], rows: unknown[][], sep: string): string {
  const esc = (v: unknown) => {
    const s = cell(v);
    return /["\r\n,;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [header, ...rows].map((r) => r.map(esc).join(sep)).join("\r\n") + "\r\n";
}

function text(status: number, msg: string) {
  return new Response(msg, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v));

const isQuestionId = (id: string): id is QuestionId => QUESTION_ORDER.includes(id as QuestionId);

const hasOther = (q: Question): boolean => q.options.some((o) => o.other === true);

// Una respuesta guardada, ya leída: {choice} / {choices: [...]} / {text}, más
// «other» (el texto libre de «Otros»).
type Parsed = { ids: string[]; other: string; text: string };

function parseAnswer(q: Question | null, raw: unknown): Parsed {
  const a = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Row) : {};
  let ids: string[] = [];
  if (Array.isArray(a.choices)) ids = a.choices.map(String);
  else if (typeof a.choice === "string" && a.choice) ids = [a.choice];
  if (q) {
    // En el orden de las opciones del formulario (no en el que las tocó la persona).
    const pos = (id: string) => {
      const i = q.options.findIndex((o) => o.id === id);
      return i < 0 ? q.options.length : i;
    };
    ids = [...ids].sort((x, y) => pos(x) - pos(y));
  }
  return {
    ids,
    other: typeof a.other === "string" ? a.other : "",
    text: typeof a.text === "string" ? a.text : "",
  };
}

const labelsOf = (q: Question, ids: string[]): string =>
  ids.map((id) => optionLabel(q, id)).join(" | ");

// Celda de una pregunta en la hoja de personas: el texto, el número de la
// escala o los rótulos de las opciones elegidas.
function answerCell(q: Question, a: Parsed): string | number {
  if (q.mode === "text") return a.text;
  if (q.mode === "scale") {
    const n = Number(a.ids[0]);
    return a.ids.length > 0 && Number.isFinite(n) ? n : (a.ids[0] ?? "");
  }
  return labelsOf(q, a.ids);
}

const ms = (s: string): number => {
  const n = s ? Date.parse(s) : NaN;
  return Number.isFinite(n) ? n : 0;
};

// Fecha de una respuesta: la última vez que la persona la guardó.
const savedAt = (r: Row): string => str(r.updated_at) || str(r.created_at);

// Las fechas salen en hora de Panamá (UTC-5, sin horario de verano) y en un
// formato que Excel reconoce como fecha: 2026-10-12 18:30:05.
const PANAMA = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "America/Panama",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});
const localTime = (s: string): string => {
  const t = ms(s);
  return t ? PANAMA.format(new Date(t)) : s;
};

function personasCsv(people: Row[], responses: Row[], sep: string): string {
  // Respuestas de cada persona, por pregunta.
  const byPid = new Map<string, Map<QuestionId, Parsed>>();
  const lastByPid = new Map<string, string>();
  for (const r of responses) {
    const pid = str(r.pid);
    const qid = str(r.question_id);
    if (!pid || !isQuestionId(qid)) continue;
    let mine = byPid.get(pid);
    if (!mine) {
      mine = new Map();
      byPid.set(pid, mine);
    }
    mine.set(qid, parseAnswer(QUESTIONS[qid], r.answer));
    const when = savedAt(r);
    if (ms(when) > ms(lastByPid.get(pid) ?? "")) lastByPid.set(pid, when);
  }

  // Una columna por pregunta (el id en minúsculas) y, si la pregunta tiene
  // «Otros», otra con el texto que escribió: <id>_otro.
  const questionColumns = QUESTION_ORDER.flatMap((id) => {
    const col = id.toLowerCase();
    return hasOther(QUESTIONS[id]) ? [col, `${col}_otro`] : [col];
  });
  const header = [
    "id",
    "registro",
    "nombre",
    "organizacion",
    "cargo",
    "correo",
    ...questionColumns,
    "preguntas_respondidas",
    "ultima_respuesta",
  ];

  // Sale toda persona registrada, aunque no haya respondido nada.
  const body = people.map((p) => {
    const pid = str(p.pid);
    const mine = byPid.get(pid);
    const answers = QUESTION_ORDER.flatMap((id) => {
      const q = QUESTIONS[id];
      const a = mine?.get(id);
      const main = a ? answerCell(q, a) : "";
      return hasOther(q) ? [main, a?.other ?? ""] : [main];
    });
    return [
      p.id,
      localTime(str(p.created_at)),
      p.nombre,
      p.organizacion,
      p.cargo,
      p.correo,
      ...answers,
      mine?.size ?? 0,
      localTime(lastByPid.get(pid) ?? ""),
    ];
  });
  return toCsv(header, body, sep);
}

function respuestasCsv(people: Row[], responses: Row[], sep: string): string {
  const personByPid = new Map<string, Row>();
  for (const p of people) personByPid.set(str(p.pid), p);

  const header = [
    "id",
    "fecha",
    "nombre",
    "organizacion",
    "cargo",
    "correo",
    "momento",
    "question_id",
    "pregunta",
    "answer_ids",
    "answer_labels",
    "otro",
    "texto",
  ];
  const body = responses.map((r) => {
    const qid = str(r.question_id);
    const q = isQuestionId(qid) ? QUESTIONS[qid] : null;
    const a = parseAnswer(q, r.answer);
    const p = personByPid.get(str(r.pid));
    return [
      r.id,
      localTime(savedAt(r)),
      p?.nombre,
      p?.organizacion,
      p?.cargo,
      p?.correo,
      q?.moment ?? "",
      qid,
      q?.prompt ?? "",
      a.ids.join(" | "),
      q ? labelsOf(q, a.ids) : "",
      a.other,
      a.text,
    ];
  });
  return toCsv(header, body, sep);
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  if (sp.has("k")) {
    return text(400, "La clave no va en la URL. La descarga se hace desde la página /charla/exportar.");
  }
  const auth = checkStandKey(req.headers.get("x-stand-key"));
  if (!auth.ok) return text(auth.status, auth.error);

  const type = sp.get("type");
  if (type !== "personas" && type !== "respuestas") {
    return text(400, "Falta type=personas o type=respuestas.");
  }
  if (!hasServiceRole) {
    return text(
      503,
      "Falta SUPABASE_SERVICE_ROLE en el servidor: sin eso no se pueden leer las personas ni sus respuestas."
    );
  }
  const sep = sp.get("sep") === "semicolon" ? ";" : ",";

  const [people, responses] = await Promise.all([
    readAll("charla_people", "id, pid, nombre, organizacion, cargo, correo, created_at"),
    readAll("charla_responses", "id, pid, question_id, answer, created_at, updated_at"),
  ]);
  if (people.error) return text(500, `No se pudo leer charla_people: ${people.error}`);
  if (responses.error) return text(500, `No se pudo leer charla_responses: ${responses.error}`);

  const kind: ExportType = type;
  const csv =
    kind === "personas"
      ? personasCsv(people.rows, responses.rows, sep)
      : respuestasCsv(people.rows, responses.rows, sep);

  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
  const filename = `charla-${SESSION}-${kind}-${stamp}.csv`;
  return new Response(BOM + csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
