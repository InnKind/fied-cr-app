import { NextRequest } from "next/server";
import { hasServiceRole, supabaseAdmin } from "@/lib/supabase-admin";
import { checkStandKey } from "@/lib/stand-server";
import {
  CONTACT,
  QUESTIONS,
  QUESTION_ORDER,
  SESSION,
  optionLabel,
  type Question,
  type QuestionId,
} from "@/config/charla";

// Exporta la charla a CSV (UTF-8 con BOM, para Excel y la base maestra).
//   GET /api/charla/export?type=participantes → respuestas: una fila por participante y
//                                              una columna por pregunta (como la hoja
//                                              de un formulario de Google)
//   GET /api/charla/export?type=respuestas    → respuestas: una fila por respuesta
//                                              (formato largo, para tablas dinámicas)
//   GET /api/charla/export?type=contactos     → los contactos opcionales del final
// Las respuestas son ANÓNIMAS: cada celular sale como un «participante» con un número
// correlativo (1, 2, 3…, en el orden de su primera respuesta), el mismo en los dos
// archivos de respuestas. No sale el pid (el código del celular) ni ninguna fecha u
// hora: el contacto se envía justo después de la última respuesta, así que una hora
// serviría para emparejarlos.
// Los contactos se guardan aparte (charla_contacts no tiene el pid) y su archivo
// tampoco trae nada que permita unirlo con las respuestas: ni número de participante,
// ni id, ni hora (solo el día), y van en orden alfabético, no en el orden de llegada.
// La clave es la misma del stand y va en el encabezado x-stand-key (NUNCA en la
// URL: quedaría en los registros de Vercel y en el historial del navegador). La
// página /charla/exportar la pide y descarga el archivo.
// Opcional: &sep=semicolon (Excel en configuración regional con coma decimal).
// Lee con service role: el público no puede leer charla_responses ni charla_contacts.
// Solo el archivo de contactos trae nombres y correos.

type Row = Record<string, unknown>;
type ExportType = "participantes" | "respuestas" | "contactos";
const EXPORT_TYPES: ExportType[] = ["participantes", "respuestas", "contactos"];

const PAGE = 1000;
const SQL_RESPONSES = "supabase/14-charla.sql";
const SQL_CONTACTS = "supabase/15-charla-anonima.sql";
// Marca de orden de bytes (U+FEFF): con ella Excel abre el archivo como UTF-8.
const BOM = String.fromCharCode(0xfeff);

async function readAll(
  table: string,
  columns: string,
  sqlFile: string
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
      return { rows, error: missing ? `${error.message} (falta correr ${sqlFile})` : error.message };
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

function parseAnswer(q: Question, raw: unknown): Parsed {
  const a = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Row) : {};
  let ids: string[] = [];
  if (Array.isArray(a.choices)) ids = a.choices.map(String);
  else if (typeof a.choice === "string" && a.choice) ids = [a.choice];
  // En el orden de las opciones del formulario (no en el que las tocó la persona).
  const pos = (id: string) => {
    const i = q.options.findIndex((o) => o.id === id);
    return i < 0 ? q.options.length : i;
  };
  ids = [...ids].sort((x, y) => pos(x) - pos(y));
  return {
    ids,
    other: typeof a.other === "string" ? a.other : "",
    text: typeof a.text === "string" ? a.text : "",
  };
}

const labelsOf = (q: Question, ids: string[]): string =>
  ids.map((id) => optionLabel(q, id)).join(" | ");

// Celda de una pregunta en la hoja de participantes: el texto, el número de la
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

// ---------------------------------------------------------------------------
// Respuestas (anónimas)
// ---------------------------------------------------------------------------
type Participant = { n: number; answers: Map<QuestionId, Parsed> };

// Agrupa las respuestas por celular y numera los celulares en el orden de su
// primera respuesta (la fila más vieja; a igual hora, la de id menor). El pid se
// usa solo aquí, para agrupar: no sale en ningún archivo.
// Las filas de preguntas que ya no están en el formulario (SEGUIR, de los ensayos
// anteriores a 15-charla-anonima.sql) no cuentan.
function participants(responses: Row[]): Participant[] {
  const byPid = new Map<string, { at: number; id: number; answers: Map<QuestionId, Parsed> }>();
  for (const r of responses) {
    const pid = str(r.pid);
    const qid = str(r.question_id);
    if (!pid || !isQuestionId(qid)) continue;
    const at = ms(str(r.created_at));
    const id = Number(r.id) || 0;
    let p = byPid.get(pid);
    if (!p) {
      p = { at, id, answers: new Map() };
      byPid.set(pid, p);
    } else if (at < p.at || (at === p.at && id < p.id)) {
      p.at = at;
      p.id = id;
    }
    p.answers.set(qid, parseAnswer(QUESTIONS[qid], r.answer));
  }
  return [...byPid.values()]
    .sort((a, b) => a.at - b.at || a.id - b.id)
    .map((p, i) => ({ n: i + 1, answers: p.answers }));
}

function participantesCsv(list: Participant[], sep: string): string {
  // Una columna por pregunta (el id en minúsculas) y, si la pregunta tiene
  // «Otros», otra con el texto que escribió: <id>_otro.
  const questionColumns = QUESTION_ORDER.flatMap((id) => {
    const col = id.toLowerCase();
    return hasOther(QUESTIONS[id]) ? [col, `${col}_otro`] : [col];
  });
  const header = ["participante", ...questionColumns, "preguntas_respondidas"];

  const body = list.map((p) => {
    const answers = QUESTION_ORDER.flatMap((id) => {
      const q = QUESTIONS[id];
      const a = p.answers.get(id);
      const main = a ? answerCell(q, a) : "";
      return hasOther(q) ? [main, a?.other ?? ""] : [main];
    });
    return [p.n, ...answers, p.answers.size];
  });
  return toCsv(header, body, sep);
}

function respuestasCsv(list: Participant[], sep: string): string {
  const header = [
    "participante",
    "momento",
    "question_id",
    "pregunta",
    "answer_ids",
    "answer_labels",
    "otro",
    "texto",
  ];
  // Por participante y, dentro de cada uno, en el orden del formulario.
  const body = list.flatMap((p) =>
    QUESTION_ORDER.flatMap((qid) => {
      const a = p.answers.get(qid);
      if (!a) return [];
      const q = QUESTIONS[qid];
      return [[p.n, q.moment, qid, q.prompt, a.ids.join(" | "), labelsOf(q, a.ids), a.other, a.text]];
    })
  );
  return toCsv(header, body, sep);
}

// ---------------------------------------------------------------------------
// Contactos (opcionales, aparte de las respuestas)
// ---------------------------------------------------------------------------
// Las opciones marcadas, con sus textos y en el orden del formulario.
function contactOptions(raw: unknown): string {
  const ids = Array.isArray(raw) ? raw.map(String) : [];
  const pos = (id: string) => {
    const i = CONTACT.options.findIndex((o) => o.id === id);
    return i < 0 ? CONTACT.options.length : i;
  };
  return [...ids]
    .sort((x, y) => pos(x) - pos(y))
    .map((id) => CONTACT.options.find((o) => o.id === id)?.label ?? id)
    .join(" · ");
}

function contactosCsv(contacts: Row[], sep: string): string {
  const header = ["fecha", "nombre", "organizacion", "cargo", "correo", "opciones"];
  const body = contacts
    // La base guarda solo el día (hora de Panamá), como 2026-10-12.
    .map((c) => ({ fecha: str(c.fecha), c }))
    // Por día y por nombre: el orden de llegada ayudaría a emparejarlos con las respuestas.
    .sort(
      (x, y) =>
        x.fecha.localeCompare(y.fecha) ||
        str(x.c.nombre).localeCompare(str(y.c.nombre), "es", { sensitivity: "base" })
    )
    .map(({ fecha, c }) => [
      fecha,
      c.nombre,
      c.organizacion,
      c.cargo,
      c.correo,
      contactOptions(c.opciones),
    ]);
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
  if (!EXPORT_TYPES.includes(type as ExportType)) {
    return text(400, "Falta type=participantes, type=respuestas o type=contactos.");
  }
  const kind = type as ExportType;
  if (!hasServiceRole) {
    return text(
      503,
      "Falta SUPABASE_SERVICE_ROLE en el servidor: sin eso no se pueden leer las respuestas ni los contactos."
    );
  }
  const sep = sp.get("sep") === "semicolon" ? ";" : ",";

  let csv: string;
  if (kind === "contactos") {
    const contacts = await readAll(
      "charla_contacts",
      "id, opciones, nombre, organizacion, cargo, correo, fecha",
      SQL_CONTACTS
    );
    if (contacts.error) return text(500, `No se pudo leer charla_contacts: ${contacts.error}`);
    csv = contactosCsv(contacts.rows, sep);
  } else {
    const responses = await readAll(
      "charla_responses",
      "id, pid, question_id, answer, created_at",
      SQL_RESPONSES
    );
    if (responses.error) return text(500, `No se pudo leer charla_responses: ${responses.error}`);
    const list = participants(responses.rows);
    csv = kind === "participantes" ? participantesCsv(list, sep) : respuestasCsv(list, sep);
  }

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
