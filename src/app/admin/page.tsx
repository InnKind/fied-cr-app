"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  PHASES,
  THEMES,
  getPhase,
  normalizePhaseId,
  numberedThemeTitle,
} from "@/config/event";
import BrandBar from "@/components/BrandBar";

type EventState = { current_round: number; phase: string };

// Colores por tema (mismo orden que THEMES), consistentes con el resto de la app.
const THEME_COLORS = ["#0c7d75", "#c8103e", "#d97706"];

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [adminCode, setAdminCode] = useState("");
  const [state, setState] = useState<EventState | null>(null);
  const [counts, setCounts] = useState({
    participants: 0,
    r1: 0,
    themed: 0,
    assigned: 0,
  });
  const [tables, setTables] = useState<
    { table: number; people: number; ready: boolean }[]
  >([]);
  // Mapa mesa -> tema (se llena al distribuir; para ubicar rezagados por tema).
  const [tableThemes, setTableThemes] = useState<
    { table_number: number; theme: string }[]
  >([]);
  const [msg, setMsg] = useState("");
  const [generating, setGenerating] = useState(false);
  const [distributing, setDistributing] = useState(false);

  useEffect(() => {
    const saved =
      typeof window !== "undefined" ? localStorage.getItem("fied_admin") : null;
    if (saved) {
      setAdminCode(saved);
      setAuthed(true);
    }
  }, []);

  // Estado del evento + contadores en vivo (lectura, no requiere clave).
  useEffect(() => {
    if (!authed) return;
    let active = true;
    async function load() {
      const { data: es } = await supabase
        .from("event_state")
        .select("current_round, phase")
        .eq("id", 1)
        .single();
      const { count: pc } = await supabase
        .from("participants")
        .select("*", { count: "exact", head: true });
      const { count: r1c } = await supabase
        .from("idea_submissions")
        .select("*", { count: "exact", head: true });
      const { count: themedC } = await supabase
        .from("participants")
        .select("*", { count: "exact", head: true })
        .not("selected_theme", "is", null);
      const { count: assignedC } = await supabase
        .from("participants")
        .select("*", { count: "exact", head: true })
        .not("current_table", "is", null);
      const { data: parts } = await supabase
        .from("participants")
        .select("current_table")
        .not("current_table", "is", null);
      const { data: statuses } = await supabase
        .from("table_status")
        .select("table_number, ready");
      const { data: tThemes } = await supabase
        .from("table_themes")
        .select("table_number, theme");
      const perTable: Record<number, number> = {};
      (parts ?? []).forEach((p) => {
        const t = p.current_table as number;
        perTable[t] = (perTable[t] ?? 0) + 1;
      });
      const readySet = new Set(
        (statuses ?? [])
          .filter((s) => s.ready)
          .map((s) => s.table_number as number)
      );
      const tbls = Object.keys(perTable)
        .map(Number)
        .sort((a, b) => a - b)
        .map((t) => ({ table: t, people: perTable[t], ready: readySet.has(t) }));
      if (active) {
        if (es) setState(es as EventState);
        setCounts({
          participants: pc ?? 0,
          r1: r1c ?? 0,
          themed: themedC ?? 0,
          assigned: assignedC ?? 0,
        });
        setTables(tbls);
        setTableThemes(
          (tThemes ?? []) as { table_number: number; theme: string }[]
        );
      }
    }
    load();
    const timer = setInterval(load, 3000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [authed]);

  async function login() {
    const res = await fetch("/api/admin/set-state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: codeInput, validate: true }),
    });
    if (res.ok) {
      localStorage.setItem("fied_admin", codeInput);
      setAdminCode(codeInput);
      setAuthed(true);
      setMsg("");
    } else {
      setMsg("Código incorrecto.");
    }
  }

  async function setPhase(current_round: number, phase: string) {
    const res = await fetch("/api/admin/set-state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: adminCode, current_round, phase }),
    });
    if (res.status === 401) {
      setMsg("Sesión no autorizada. Vuelve a entrar con la clave.");
      setAuthed(false);
      localStorage.removeItem("fied_admin");
      return false;
    }
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setMsg("Error: " + (b.error || res.status));
      return false;
    }
    setMsg("Actualizado ✓");
    setTimeout(() => setMsg(""), 2000);
    return true;
  }

  async function distributeTables() {
    setDistributing(true);
    setMsg("Distribuyendo mesas…");
    try {
      const res = await fetch("/api/admin/assign-tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: adminCode }),
      });
      const body = await res.json();
      if (!res.ok) {
        setMsg("Error: " + (body.error || res.status));
        return;
      }
      const ok = await setPhase(1, "TABLE_ASSIGNED");
      if (ok) setMsg(`Mesas asignadas: ${body.assigned}/${body.total} ✓`);
    } catch {
      setMsg("Error de red al distribuir mesas.");
    } finally {
      setDistributing(false);
    }
  }

  async function processR2() {
    setGenerating(true);
    setMsg("Procesando la Ronda 2 con IA…");
    try {
      const res = await fetch("/api/process-round2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: adminCode }),
      });
      const body = await res.json();
      if (!res.ok) {
        setMsg("Error: " + (body.error || res.status));
        return;
      }
      const n = (body.themes ?? []).length;
      setMsg(`Ronda 2 procesada ✓ · ${n} tema(s) agregado(s).`);
    } catch {
      setMsg("Error de red al procesar la Ronda 2.");
    } finally {
      setGenerating(false);
    }
  }

  async function processR1() {
    setGenerating(true);
    setMsg("Procesando la Ronda 1 con IA… (puede tardar un poco)");
    try {
      const res = await fetch("/api/process-round1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: adminCode }),
      });
      const body = await res.json();
      if (!res.ok) {
        setMsg("Error: " + (body.error || res.status));
        return;
      }
      const themes = (body.themes ?? []) as { slides?: unknown[] }[];
      const slides = themes.reduce((n, t) => n + (t.slides?.length ?? 0), 0);
      setMsg(
        `Procesado ✓ · ${slides} diapositivas en ${themes.length} tema(s). ` +
          "(Mostrarlas en pantalla es el siguiente paso.)"
      );
    } catch {
      setMsg("Error de red al procesar la Ronda 1.");
    } finally {
      setGenerating(false);
    }
  }

  if (!authed) {
    return (
      <main className="flex-1 flex items-center justify-center p-6 bg-slate-50">
        <div className="w-full max-w-sm">
          <BrandBar />
          <h1 className="text-2xl font-bold text-slate-900">Panel de administrador</h1>
          <input
            type="password"
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            placeholder="Clave de acceso"
            className="mt-4 w-full rounded-lg border border-slate-300 px-4 py-3 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
          <button
            onClick={login}
            className="mt-3 w-full rounded-lg bg-slate-800 px-4 py-3 font-semibold text-white hover:bg-slate-900"
          >
            Entrar
          </button>
          {msg && <p className="mt-3 text-sm text-red-600">{msg}</p>}
        </div>
      </main>
    );
  }

  const currentPhaseId = normalizePhaseId(state?.phase);
  const currentLabel = getPhase(currentPhaseId)?.label ?? state?.phase ?? "—";

  const btn =
    "rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-left font-medium text-slate-800 shadow-sm hover:border-blue-400 hover:bg-blue-50";

  return (
    <main className="flex-1 p-6 bg-slate-50">
      <div className="mx-auto w-full max-w-lg">
        <BrandBar />
        <h1 className="text-2xl font-bold text-slate-900">Panel de administrador</h1>

        <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Fase actual</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">{currentLabel}</p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-slate-600">
            <span>Participantes: <b>{counts.participants}</b></span>
            <span>Eligieron tema: <b>{counts.themed}</b></span>
            <span>Con mesa: <b>{counts.assigned}</b></span>
            <span>Ideas R1: <b>{counts.r1}</b></span>
          </div>
        </div>

        {/* Mesas por tema: para ubicar a un rezagado según el tema que quiere. */}
        {tableThemes.length > 0 && (
          <div className="mt-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-slate-700">Mesas por tema</p>
            <p className="mt-0.5 text-xs text-slate-400">
              Para ubicar a alguien: su tema está en estas mesas.
            </p>
            <div className="mt-3 space-y-2.5">
              {THEMES.map((t, i) => {
                const mesas = tableThemes
                  .filter((x) => x.theme === t.id)
                  .map((x) => x.table_number)
                  .sort((a, b) => a - b);
                if (mesas.length === 0) return null;
                return (
                  <div key={t.id} className="flex items-start gap-2">
                    <span
                      className="mt-1.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: THEME_COLORS[i] ?? "#0c7d75" }}
                    />
                    <div>
                      <p className="text-sm font-medium text-slate-800">
                        {numberedThemeTitle(t.id)}
                      </p>
                      <p className="text-sm text-slate-600">
                        {mesas.length === 1 ? "Mesa " : "Mesas "}
                        {mesas.join(", ")}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Estado de las mesas: cuáles marcó "listas" su facilitador */}
        {tables.length > 0 && (
          <div className="mt-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-700">
                Estado de las mesas
              </p>
              <span className="text-sm text-slate-500">
                Listas:{" "}
                <b
                  className={
                    tables.every((t) => t.ready)
                      ? "text-green-700"
                      : "text-slate-700"
                  }
                >
                  {tables.filter((t) => t.ready).length}
                </b>{" "}
                / {tables.length}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {tables.map((t) => (
                <span
                  key={t.table}
                  title={`${t.people} persona(s)`}
                  className={`rounded-full px-3 py-1 text-sm font-medium ${
                    t.ready
                      ? "bg-green-100 text-green-800"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {t.ready ? "✅" : "⏳"} Mesa {t.table}
                </span>
              ))}
            </div>
            {!tables.every((t) => t.ready) && (
              <p className="mt-2 text-xs text-amber-700">
                Faltan por marcarse listas: mesas{" "}
                {tables
                  .filter((t) => !t.ready)
                  .map((t) => t.table)
                  .join(", ")}
                .
              </p>
            )}
          </div>
        )}

        {/* Alerta: en fase "Mesa asignada" pero nadie tiene mesa (falta distribuir) */}
        {currentPhaseId === "TABLE_ASSIGNED" &&
          counts.participants > 0 &&
          counts.assigned === 0 && (
            <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
              ⚠️ Nadie tiene mesa asignada. Toca <b>“🎲 Distribuir mesas”</b> aquí
              abajo para repartir las mesas.
            </div>
          )}

        {/* ACCIONES: los botones que SÍ hacen el trabajo (arriba, bien visibles) */}
        <p className="mt-6 text-sm font-semibold text-slate-700">
          Acciones principales <span className="font-normal text-slate-400">— estas reparten mesas o corren la IA</span>
        </p>
        <div className="mt-2 grid gap-2">
          <div>
            <button
              className="w-full rounded-lg bg-blue-700 px-4 py-3 text-center font-semibold text-white shadow-sm hover:bg-blue-800 disabled:opacity-50"
              disabled={distributing}
              onClick={distributeTables}
            >
              {distributing ? "🎲 Distribuyendo mesas…" : "🎲 Distribuir mesas"}
            </button>
            <p className="mt-1 text-xs text-slate-400">
              Reparte las mesas a quienes eligieron tema y pasa a “Mesa asignada”.
            </p>
          </div>
          <div className="mt-1">
            <button
              className="w-full rounded-lg bg-violet-700 px-4 py-3 text-center font-semibold text-white shadow-sm hover:bg-violet-800 disabled:opacity-50"
              disabled={generating}
              onClick={processR1}
            >
              {generating ? "🧠 Procesando Ronda 1…" : "🧠 Procesar Ronda 1 con IA"}
            </button>
            <p className="mt-1 text-xs text-slate-400">
              Agrupa los momentos y arma las diapositivas (para la presentación).
            </p>
          </div>
          <div className="mt-1">
            <button
              className="w-full rounded-lg bg-violet-700 px-4 py-3 text-center font-semibold text-white shadow-sm hover:bg-violet-800 disabled:opacity-50"
              disabled={generating}
              onClick={processR2}
            >
              {generating ? "🧠 Procesando…" : "🧠 Procesar Ronda 2 con IA"}
            </button>
            <p className="mt-1 text-xs text-slate-400">
              Agrega las reflexiones (roles recurrentes + experiencias). No se proyecta.
            </p>
          </div>
        </div>

        {msg && <p className="mt-4 text-sm font-medium text-slate-700">{msg}</p>}

        {/* FASES: solo cambian lo que ven los participantes */}
        <p className="mt-6 text-sm font-semibold text-slate-700">
          Fases del ejercicio{" "}
          <span className="font-normal text-slate-400">— solo cambian lo que ven los participantes</span>
        </p>
        <div className="mt-2 grid gap-2">
          {PHASES.map((p) => {
            const isCurrent = currentPhaseId === p.id;
            const needsAction =
              p.id === "TABLE_ASSIGNED"
                ? "🎲 Distribuir mesas"
                : p.id === "RESULTS"
                ? "🧠 Procesar Ronda 1 con IA"
                : null;
            return (
              <button
                key={p.id}
                className={`${btn} ${
                  isCurrent ? "border-blue-500 bg-blue-50 ring-1 ring-blue-300" : ""
                }`}
                onClick={() => setPhase(p.round, p.id)}
              >
                {isCurrent ? "● " : ""}
                {p.label}
                {needsAction && (
                  <span className="block text-xs font-normal text-slate-400">
                    Mejor usa “{needsAction}” (arriba) para llegar aquí.
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <p className="mt-6 text-sm font-semibold text-slate-700">
          Pantallas para proyectar
        </p>
        <div className="mt-2 flex gap-2">
          <a
            href="/presentation"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-center font-medium text-slate-800 shadow-sm hover:border-blue-400 hover:bg-blue-50"
          >
            📺 Presentación ↗
          </a>
          <a
            href="/curate"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-center font-medium text-slate-800 shadow-sm hover:border-blue-400 hover:bg-blue-50"
          >
            🎬 Curaduría ↗
          </a>
          <a
            href="/resultados"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-center font-medium text-slate-800 shadow-sm hover:border-blue-400 hover:bg-blue-50"
          >
            📊 Resultados R2 ↗
          </a>
        </div>
      </div>
    </main>
  );
}
