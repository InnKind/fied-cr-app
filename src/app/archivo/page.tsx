"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { THEMES, EVENT } from "@/config/event";
import { themeForTable } from "@/lib/tables";

type Moment = { id: string; ord: number; text: string };
type Idea = { moment_id: string; ai_text: string | null; agency_text: string | null };

// Archivo post-evento (§32): el usuario elige su mesa y consulta lo que se
// trabajó: momentos, ideas (IA/Agency) y las fotos de los post-its.
export default function ArchivoPage() {
  const [input, setInput] = useState("");
  const [table, setTable] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [moments, setMoments] = useState<Moment[]>([]);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  async function load() {
    const n = parseInt(input, 10);
    if (!input || Number.isNaN(n) || n < 1 || n > EVENT.numberOfTables) {
      setError(`Ingresa un número de mesa (1 a ${EVENT.numberOfTables}).`);
      return;
    }
    setLoading(true);
    setError(null);
    setTable(n);
    const [{ data: m }, { data: i }, { data: img }] = await Promise.all([
      supabase.from("selected_moments").select("id, ord, text").eq("table_number", n).order("ord"),
      supabase.from("idea_submissions").select("moment_id, ai_text, agency_text").eq("table_number", n),
      supabase.from("table_images").select("image_path").eq("table_number", n),
    ]);
    setMoments((m as Moment[]) ?? []);
    setIdeas((i as Idea[]) ?? []);
    setPhotos(
      ((img as { image_path: string }[]) ?? []).map(
        (r) => supabase.storage.from("postits").getPublicUrl(r.image_path).data.publicUrl
      )
    );
    setLoading(false);
    setSearched(true);
  }

  const themeTitle = table
    ? THEMES.find((t) => t.id === themeForTable(table))?.title
    : null;

  return (
    <main className="flex-1 p-6 bg-slate-50">
      <div className="mx-auto w-full max-w-2xl">
        <h1 className="text-2xl font-bold text-slate-900">Memoria del ejercicio</h1>
        <p className="mt-2 text-slate-600">
          Consulta lo que trabajó tu mesa. Ingresa el número de mesa donde
          estuviste.
        </p>

        <div className="mt-4 flex gap-2">
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={EVENT.numberOfTables}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setError(null);
            }}
            placeholder="Ej: 7"
            className="w-32 rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
          <button
            onClick={load}
            disabled={loading}
            className="rounded-lg bg-blue-700 px-5 py-3 font-semibold text-white shadow-sm hover:bg-blue-800 disabled:opacity-60"
          >
            {loading ? "Buscando…" : "Buscar"}
          </button>
        </div>
        {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}

        {searched && !loading && table && (
          <div className="mt-8">
            <h2 className="text-lg font-bold text-slate-900">
              Mesa {table}
              {themeTitle && (
                <span className="font-normal text-slate-500"> · {themeTitle}</span>
              )}
            </h2>

            {moments.length === 0 ? (
              <p className="mt-3 text-slate-500">
                No encontramos datos para esta mesa.
              </p>
            ) : (
              <div className="mt-4 space-y-4">
                {moments.map((m) => {
                  const mi = ideas.filter((x) => x.moment_id === m.id);
                  const ai = mi.map((x) => x.ai_text).filter(Boolean) as string[];
                  const ag = mi.map((x) => x.agency_text).filter(Boolean) as string[];
                  return (
                    <div
                      key={m.id}
                      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                    >
                      <h3 className="font-semibold text-slate-900">
                        <span className="text-slate-400">{m.ord}.</span> {m.text}
                      </h3>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">
                            Ideas de IA
                          </p>
                          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-700">
                            {ai.length ? (
                              ai.map((t, k) => <li key={k}>{t}</li>)
                            ) : (
                              <li className="list-none text-slate-300">—</li>
                            )}
                          </ul>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">
                            Ideas de Agency
                          </p>
                          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-700">
                            {ag.length ? (
                              ag.map((t, k) => <li key={k}>{t}</li>)
                            ) : (
                              <li className="list-none text-slate-300">—</li>
                            )}
                          </ul>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {photos.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                  Fotos de los post-its
                </h3>
                <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {photos.map((u, k) => (
                    <a key={k} href={u} target="_blank" rel="noopener noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={u}
                        alt={`Post-it ${k + 1}`}
                        className="aspect-square w-full rounded-lg border border-slate-200 object-cover"
                      />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
