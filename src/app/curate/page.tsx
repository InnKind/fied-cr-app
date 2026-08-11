"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Round1Payload } from "@/lib/round1";

export default function CuratePage() {
  const [authed, setAuthed] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [adminCode, setAdminCode] = useState("");
  const [payload, setPayload] = useState<Round1Payload | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const saved =
      typeof window !== "undefined" ? localStorage.getItem("fied_admin") : null;
    if (saved) {
      setAdminCode(saved);
      setAuthed(true);
    }
  }, []);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("synthesis")
      .select("payload")
      .eq("round", 1)
      .maybeSingle();
    setPayload((data?.payload as Round1Payload | null) ?? null);
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!authed) return;
    load();
    // En vivo: si el admin reprocesa la Ronda 1, recargamos para no guardar
    // encima con una versión vieja (perdiendo diapositivas nuevas).
    const channel = supabase
      .channel("rt-curate")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "synthesis", filter: "round=eq.1" },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [authed, load]);

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

  async function toggle(ti: number, si: number) {
    if (!payload) return;
    const next: Round1Payload = {
      ...payload,
      themes: payload.themes.map((t, i) =>
        i !== ti
          ? t
          : {
              ...t,
              slides: t.slides.map((s, j) =>
                j !== si ? s : { ...s, live: !s.live }
              ),
            }
      ),
    };
    setPayload(next);
    const res = await fetch("/api/admin/set-synthesis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: adminCode, payload: next }),
    });
    if (!res.ok) {
      setMsg("No se pudo guardar. Reintenta.");
    } else {
      setMsg("Guardado ✓");
      setTimeout(() => setMsg(""), 1500);
    }
  }

  if (!authed) {
    return (
      <main className="flex-1 flex items-center justify-center p-6 bg-slate-50">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-bold text-slate-900">Curaduría</h1>
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

  const themes = payload?.themes ?? [];
  const liveCount = themes.reduce(
    (n, t) => n + t.slides.filter((s) => s.live).length,
    0
  );

  return (
    <main className="flex-1 p-6 bg-slate-50">
      <div className="mx-auto w-full max-w-2xl">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900">Curaduría</h1>
          <a
            href="/presentation"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-blue-700 underline underline-offset-2"
          >
            Abrir presentación ↗
          </a>
        </div>
        <p className="mt-2 text-sm text-slate-600">
          Marca las diapositivas que quieres mostrar en vivo. Si no marcas
          ninguna, la presentación muestra todas. En vivo ahora:{" "}
          <b>{liveCount}</b>.
        </p>
        {msg && <p className="mt-2 text-sm font-medium text-slate-600">{msg}</p>}

        {!loaded && <p className="mt-6 text-slate-400">Cargando…</p>}
        {loaded && themes.length === 0 && (
          <p className="mt-6 text-slate-500">
            Todavía no hay diapositivas. Procesa la Ronda 1 desde el panel de
            administrador.
          </p>
        )}

        {themes.map((t, ti) => (
          <div key={t.themeId ?? ti} className="mt-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-blue-700">
              {t.themeTitle}
            </h2>
            <div className="mt-2 space-y-2">
              {t.slides.map((s, si) => (
                <button
                  key={si}
                  onClick={() => toggle(ti, si)}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left shadow-sm transition ${
                    s.live
                      ? "border-blue-500 bg-blue-50 ring-1 ring-blue-300"
                      : "border-slate-200 bg-white hover:border-blue-300"
                  }`}
                >
                  <span className="text-slate-800">
                    {s.moment}
                    {s.tables > 1 && (
                      <span className="ml-2 text-xs text-amber-600">
                        (en {s.tables} mesas)
                      </span>
                    )}
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                      s.live
                        ? "bg-blue-700 text-white"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {s.live ? "● En vivo" : "Oculto"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
