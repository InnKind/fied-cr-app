import { NextRequest } from "next/server";
import { hasServiceRole, supabaseAdmin } from "@/lib/supabase-admin";
import { checkStandKey } from "@/lib/stand-server";
import {
  DOORS,
  DOOR_TIMING,
  QUESTIONS,
  R1,
  R2,
  SESSION,
  optionLabel,
  type QuestionId,
} from "@/config/stand";

// Exporta el modo stand a CSV (UTF-8 con BOM, para Excel y la base maestra).
//   GET /api/stand/export?k=CLAVE&type=contacts   → contactos de las Tres puertas
//   GET /api/stand/export?k=CLAVE&type=responses  → respuestas anónimas
// Opcional: &sep=semicolon (Excel en configuración regional con coma decimal).
// Lee con service role: el público no puede leer stand_contacts.

type Row = Record<string, unknown>;

const PAGE = 1000;

async function readAll(table: string): Promise<{ rows: Row[]; error: string | null }> {
  const rows: Row[] = [];
  for (let from = 0; from < 200000; from += PAGE) {
    const { data, error } = await supabaseAdmin
      .from(table)
      .select("*")
      .eq("session", SESSION)
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) return { rows, error: error.message };
    rows.push(...((data ?? []) as Row[]));
    if (!data || data.length < PAGE) break;
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

const doorOptionLabel = (door: string, id: string) =>
  DOORS.find((d) => d.id === door)?.options?.find((o) => o.id === id)?.label ?? id;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const auth = checkStandKey(sp.get("k") ?? req.headers.get("x-stand-key"));
  if (!auth.ok) return text(auth.status, auth.error);

  const type = sp.get("type");
  if (type !== "contacts" && type !== "responses") {
    return text(400, "Falta type=contacts o type=responses.");
  }
  if (!hasServiceRole) {
    return text(
      503,
      "Falta SUPABASE_SERVICE_ROLE en el servidor: sin eso no se pueden leer los contactos."
    );
  }
  const sep = sp.get("sep") === "semicolon" ? ";" : ",";

  let csv: string;

  if (type === "contacts") {
    const { rows, error } = await readAll("stand_contacts");
    if (error) return text(500, `No se pudo leer stand_contacts: ${error}`);
    const header = [
      "id",
      "created_at",
      "event_code",
      "session",
      "door",
      "door_label",
      "options",
      "options_labels",
      "name",
      "role",
      "org",
      "country",
      "email",
      "timing",
      "timing_label",
      "evidence",
      "referral_org",
      "referral_role",
      "consent_contact",
      "consent_results",
      "consent_news",
    ];
    const body = rows.map((r) => {
      const door = String(r.door ?? "");
      const opts = Array.isArray(r.options) ? (r.options as unknown[]).map(String) : [];
      const timing = r.timing ? String(r.timing) : "";
      return [
        r.id,
        r.created_at,
        r.event_code,
        r.session,
        door,
        DOORS.find((d) => d.id === door)?.title ?? "",
        opts.join(" | "),
        opts.map((o) => doorOptionLabel(door, o)).join(" | "),
        r.name,
        r.role,
        r.org,
        r.country,
        r.email,
        timing,
        timing ? (DOOR_TIMING.find((t) => t.id === timing)?.label ?? timing) : "",
        r.evidence,
        r.referral_org,
        r.referral_role,
        r.consent_contact,
        r.consent_results,
        r.consent_news,
      ];
    });
    csv = toCsv(header, body, sep);
  } else {
    const { rows, error } = await readAll("stand_responses");
    if (error) return text(500, `No se pudo leer stand_responses: ${error}`);
    // Rol y relación de cada id anónimo (para segmentar sin datos personales).
    const r1 = new Map<string, string>();
    const r2 = new Map<string, string>();
    for (const r of rows) {
      const a = (r.answer ?? {}) as { choice?: string };
      if (r.question_id === "R1" && a.choice) r1.set(String(r.anon_id), a.choice);
      if (r.question_id === "R2" && a.choice) r2.set(String(r.anon_id), a.choice);
    }
    const header = [
      "id",
      "created_at",
      "session",
      "anon_id",
      "r1_desde_donde",
      "r2_relacion",
      "question_id",
      "question_type",
      "question",
      "answer_ids",
      "answer_labels",
      "text",
    ];
    const body = rows.map((r) => {
      const qid = String(r.question_id ?? "") as QuestionId;
      const q = QUESTIONS[qid];
      const a = (r.answer ?? {}) as { choice?: string; choices?: string[]; text?: string };
      const ids = Array.isArray(a.choices) ? a.choices.map(String) : a.choice ? [a.choice] : [];
      const anon = String(r.anon_id ?? "");
      const r1c = r1.get(anon);
      const r2c = r2.get(anon);
      return [
        r.id,
        r.created_at,
        r.session,
        anon,
        r1c ? optionLabel(R1, r1c) : "",
        r2c ? optionLabel(R2, r2c) : "",
        qid,
        q?.type ?? "",
        q?.prompt ?? "",
        ids.join(" | "),
        q ? ids.map((id) => optionLabel(q, id)).join(" | ") : "",
        typeof a.text === "string" ? a.text : "",
      ];
    });
    csv = toCsv(header, body, sep);
  }

  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
  const filename = `stand-${SESSION}-${type}-${stamp}.csv`;
  return new Response("﻿" + csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
