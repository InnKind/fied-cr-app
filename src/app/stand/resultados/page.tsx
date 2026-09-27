"use client";

import { useEffect, useState } from "react";
import {
  ATENEA_GPT_URL,
  QUESTIONS,
  R1,
  R2,
  SESSION_QUESTIONS,
  displayOption,
  type Question,
  type QuestionId,
} from "@/config/stand";
import { onForeground } from "@/lib/realtime";
import {
  fetchResults,
  pct,
  tally,
  type ResponseRow,
  type StandError,
} from "@/lib/stand";
import { BrandMark, Rich } from "@/components/stand/StandUI";

// Resultados públicos: solo conteos (sin textos abiertos) y nada si hay menos
// de 3 personas, para que nadie pueda deducir la respuesta de otra persona.
const MIN_PEOPLE = 3;

function QuestionCard({ q, rows }: { q: Question; rows: ResponseRow[] }) {
  const t = tally(rows, q);
  return (
    <section className="rounded-2xl bg-white p-5 text-[#223c5d] shadow-sm sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-[17px] font-bold leading-snug sm:text-lg">{q.prompt}</h2>
        <span className="shrink-0 rounded-full bg-[#223c5d]/10 px-3 py-1 text-xs font-semibold">
          n = {t.respondents}
        </span>
      </div>
      {q.mode === "multi" && (
        <p className="mt-1 text-xs text-slate-500">Cada persona podía elegir hasta {q.max ?? 2}.</p>
      )}
      {t.respondents < MIN_PEOPLE ? (
        <p className="mt-4 text-sm text-slate-500">Aún no hay suficientes respuestas.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {q.options.map((o) => {
            const n = t.counts[o.id] ?? 0;
            const p = pct(n, t.respondents);
            const lead = t.top === o.id && n > 0;
            const d = displayOption(q, o);
            return (
              <li key={o.id}>
                <div className="flex items-baseline justify-between gap-3 text-sm sm:text-[15px]">
                  <span className={`min-w-0 leading-snug ${lead ? "font-semibold" : "text-slate-700"}`}>
                    {d.letter && <span className="mr-1.5 font-bold">{d.letter})</span>}
                    <Rich text={d.label} />
                  </span>
                  <span className="shrink-0 font-bold tabular-nums">
                    {p}% <span className="text-xs font-medium text-slate-400">({n})</span>
                  </span>
                </div>
                <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full transition-[width] duration-700"
                    style={{ width: `${p}%`, background: lead ? "#c9283f" : "#223c5d" }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default function StandResultados() {
  const [rows, setRows] = useState<ResponseRow[]>([]);
  const [people, setPeople] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<StandError | null>(null);

  const [tick, setTick] = useState(0); // "Reintentar" fuerza una lectura

  useEffect(() => {
    let alive = true;
    const load = async () => {
      // stand_results nunca trae los textos de la pregunta abierta.
      const { data, error } = await fetchResults();
      if (!alive) return;
      if (error || !data) {
        setError(error);
      } else {
        setRows(data.rows);
        setPeople(data.people);
        setError(null);
      }
      setLoaded(true);
    };
    load();
    const t = setInterval(load, 15000);
    const stop = onForeground(load);
    return () => {
      alive = false;
      clearInterval(t);
      stop();
    };
  }, [tick]);

  const enough = people >= MIN_PEOPLE;
  const sections: { title: string; ids: QuestionId[] }[] = [
    { title: "Quiénes estaban en la sala", ids: [R1.id, R2.id] },
    { title: "Lo que respondieron", ids: SESSION_QUESTIONS },
  ];

  return (
    <main className="min-h-dvh flex-1 bg-[#223c5d] text-white">
      <div className="mx-auto max-w-3xl px-5 pb-16 pt-6 sm:px-8">
        <header className="flex items-center justify-between gap-3">
          <BrandMark className="text-lg sm:text-xl" />
          <span className="text-xs font-medium text-white/60">GET Forum 2026</span>
        </header>

        <h1 className="mt-8 text-3xl font-bold leading-tight sm:text-4xl">
          Lo que dijo la sala · GET Forum 2026
        </h1>
        <p className="mt-2 text-white/75">
          Respuestas anónimas de la sesión de SenecaLab e InnKind.
          {enough && ` ${people} personas participaron.`}
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <a
            href={ATENEA_GPT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-xl bg-[#c9283f] px-4 py-3.5 text-center font-semibold text-white shadow"
          >
            Pregúntale a Atenea (GPT) ↗
          </a>
          <a
            href="/stand?puertas=1"
            className="block rounded-xl bg-white px-4 py-3.5 text-center font-semibold text-[#223c5d] shadow"
          >
            Quiero hablar con ustedes
          </a>
        </div>

        {!loaded ? (
          <p className="mt-12 text-center text-white/70">Cargando…</p>
        ) : error && rows.length === 0 ? (
          <div className="mt-10 rounded-2xl bg-white/10 p-6 ring-1 ring-white/15">
            <p className="text-lg font-semibold">
              {error.kind === "missing"
                ? "Los resultados todavía no están disponibles."
                : "No pudimos cargar los resultados. Revisa tu conexión."}
            </p>
            {error.detail && <p className="mt-2 text-xs text-white/50">{error.detail}</p>}
            <button
              type="button"
              onClick={() => setTick((x) => x + 1)}
              className="mt-4 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-[#223c5d]"
            >
              Reintentar
            </button>
          </div>
        ) : !enough ? (
          <div className="mt-10 rounded-2xl bg-white/10 p-8 text-center ring-1 ring-white/15">
            <p className="text-2xl font-bold">Aún no hay resultados</p>
            <p className="mt-2 text-white/75">
              Aparecerán aquí cuando la sala empiece a responder.
            </p>
          </div>
        ) : (
          sections.map((sec) => (
            <div key={sec.title} className="mt-10">
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-white/60">
                {sec.title}
              </h2>
              <div className="space-y-4">
                {sec.ids.map((id) => (
                  <QuestionCard key={id} q={QUESTIONS[id]} rows={rows} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
