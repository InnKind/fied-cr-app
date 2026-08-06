"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

// Código simple para separar el panel del admin de los participantes.
// TODO (antes del evento): esto NO es seguridad real. Endurecer moviendo los
// cambios de estado a una ruta de servidor con la clave secreta (service_role).
const ADMIN_CODE = "fied2026";

type EventState = { current_round: number; phase: string };

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [state, setState] = useState<EventState | null>(null);
  const [counts, setCounts] = useState({ participants: 0, r1: 0 });
  const [msg, setMsg] = useState("");
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem("fied_admin") === ADMIN_CODE) {
      setAuthed(true);
    }
  }, []);

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
        .from("responses")
        .select("*", { count: "exact", head: true })
        .eq("round", 1);
      if (active) {
        if (es) setState(es as EventState);
        setCounts({ participants: pc ?? 0, r1: r1c ?? 0 });
      }
    }
    load();
    const timer = setInterval(load, 3000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [authed]);

  async function setRound(current_round: number, phase: string) {
    const { error } = await supabase
      .from("event_state")
      .update({ current_round, phase, updated_at: new Date().toISOString() })
      .eq("id", 1);
    setMsg(error ? "Error: " + error.message : "Actualizado ✓");
    setTimeout(() => setMsg(""), 2500);
  }

  async function generateAndShow(round: number) {
    setGenerating(true);
    setMsg("Generando síntesis con IA… (puede tardar unos segundos)");
    try {
      const res = await fetch(`/api/synthesize?round=${round}`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) {
        setMsg("Error: " + (body.error || res.status));
        return;
      }
      await setRound(round, "results");
      setMsg(`Síntesis lista: ${body.themes?.length ?? 0} temas ✓`);
    } catch {
      setMsg("Error de red al generar la síntesis.");
    } finally {
      setGenerating(false);
    }
  }

  if (!authed) {
    return (
      <main className="flex-1 flex items-center justify-center p-6 bg-slate-50">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-bold text-slate-900">Panel de administrador</h1>
          <input
            type="password"
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            placeholder="Código de acceso"
            className="mt-4 w-full rounded-lg border border-slate-300 px-4 py-3 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
          <button
            onClick={() => {
              if (codeInput === ADMIN_CODE) {
                localStorage.setItem("fied_admin", ADMIN_CODE);
                setAuthed(true);
              } else {
                setMsg("Código incorrecto.");
              }
            }}
            className="mt-3 w-full rounded-lg bg-slate-800 px-4 py-3 font-semibold text-white hover:bg-slate-900"
          >
            Entrar
          </button>
          {msg && <p className="mt-3 text-sm text-red-600">{msg}</p>}
        </div>
      </main>
    );
  }

  const btn =
    "rounded-lg border border-slate-300 bg-white px-4 py-3 text-left font-medium text-slate-800 shadow-sm hover:border-blue-400 hover:bg-blue-50";

  return (
    <main className="flex-1 p-6 bg-slate-50">
      <div className="mx-auto w-full max-w-lg">
        <h1 className="text-2xl font-bold text-slate-900">Panel de administrador</h1>

        <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Estado actual</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">
            Ronda {state?.current_round ?? "—"} · fase: {state?.phase ?? "—"}
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Participantes: <b>{counts.participants}</b> · Respuestas Ronda 1:{" "}
            <b>{counts.r1}</b>
          </p>
        </div>

        <p className="mt-6 text-sm font-medium text-slate-500">Controlar el ejercicio</p>
        <div className="mt-2 grid gap-2">
          <button className={btn} onClick={() => setRound(0, "welcome")}>
            ⟳ Bienvenida (Ronda 0)
          </button>
          <button className={btn} onClick={() => setRound(1, "answering")}>
            ▶ Iniciar Ronda 1 (responder)
          </button>
          <button
            className={`${btn} disabled:opacity-50`}
            disabled={generating}
            onClick={() => generateAndShow(1)}
          >
            {generating
              ? "✨ Generando síntesis…"
              : "✨ Generar síntesis + mostrar resultados (R1)"}
          </button>
        </div>

        {msg && <p className="mt-4 text-sm font-medium text-slate-700">{msg}</p>}
      </div>
    </main>
  );
}
