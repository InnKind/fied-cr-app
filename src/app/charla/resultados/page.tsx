"use client";

import {
  C,
  CONTACT_EMAIL,
  MOMENTS,
  MOMENT_IDS,
  PRIVACY_URL,
  QUESTIONS,
  TALK_TITLE,
  type Question,
} from "@/config/charla";
import { formatMean, pct, tallyOf, type CharlaResults, type Tally } from "@/lib/charla";
import { useCharlaResults } from "@/hooks/useCharla";
import { BrandLogos, Kicker, SERIF } from "@/components/charla/CharlaUI";

// Resultados públicos de la charla: SOLO conteos (charla_results nunca trae
// nombres, correos ni textos escritos) y nada de una pregunta con menos de 3
// respuestas, para que nadie pueda deducir lo que respondió otra persona.
const MIN_PEOPLE = 3;

const NOT_ENOUGH = "Aún no hay suficientes respuestas.";

function peopleLine(n: number): string {
  if (n === 0) return "Todavía no hay participantes.";
  return n === 1 ? "1 persona participó" : `${n} personas participaron`;
}

function CountChip({ n }: { n: number }) {
  return (
    <span className="shrink-0 rounded-full bg-[#223c5d]/10 px-3 py-1 text-xs font-bold tabular-nums">
      n = {n}
    </span>
  );
}

// Una o varias opciones: una barra por opción, con el % de quienes respondieron.
function Bars({ q, t }: { q: Question; t: Tally }) {
  // Si hay empate en el primer lugar, se resaltan todas las que empatan.
  const best = t.top ? t.counts[t.top] : 0;
  return (
    <ul className="mt-4 space-y-3">
      {q.options.map((o) => {
        const n = t.counts[o.id] ?? 0;
        const p = pct(n, t.respondents);
        const lead = n > 0 && n === best;
        return (
          <li key={o.id}>
            <div className="flex items-baseline justify-between gap-3 text-sm sm:text-[15px]">
              <span className={`min-w-0 leading-snug ${lead ? "font-bold" : "text-[#55657a]"}`}>
                {o.label}
              </span>
              <span className="shrink-0 font-bold tabular-nums">
                {p}% <span className="text-xs font-semibold text-[#55657a]">({n})</span>
              </span>
            </div>
            <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-[#ece8e1]">
              <div
                className="h-full rounded-full transition-[width] duration-700"
                style={{ width: `${p}%`, background: lead ? C.orange : C.navy }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// Escala 1–5: el promedio en grande y una columna por valor.
function Scale({ q, t }: { q: Question; t: Tally }) {
  const best = t.top ? t.counts[t.top] : 0;
  return (
    <div className="mt-4">
      <p className="flex items-baseline gap-2">
        <span className="text-6xl leading-none tabular-nums sm:text-7xl" style={SERIF}>
          {formatMean(t.mean)}
        </span>
        <span className="text-lg font-bold">de {q.options.length}</span>
        <span className="text-sm text-[#55657a]">en promedio</span>
      </p>
      <div className="mt-5 grid grid-cols-5 gap-2 sm:gap-3">
        {q.options.map((o) => {
          const n = t.counts[o.id] ?? 0;
          const lead = n > 0 && n === best;
          // La columna más alta llena el alto; las demás, en proporción a ella.
          const h = best ? Math.round((n / best) * 100) : 0;
          return (
            <div key={o.id} className="flex flex-col items-center">
              <span className="text-xs font-bold tabular-nums sm:text-sm">
                {pct(n, t.respondents)}%
              </span>
              <div className="mt-1 flex h-24 w-full items-end overflow-hidden rounded-lg bg-[#ece8e1] sm:h-28">
                <div
                  className="w-full transition-[height] duration-700"
                  style={{ height: `${h}%`, background: lead ? C.orange : C.navy }}
                />
              </div>
              <span className="mt-1.5 text-lg font-bold leading-none">{o.label}</span>
              <span className="mt-1 text-xs font-semibold tabular-nums text-[#55657a]">({n})</span>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between gap-3 text-xs text-[#55657a]">
        <span>
          {q.options[0]?.label} = {q.minLabel}
        </span>
        <span className="text-right">
          {q.options[q.options.length - 1]?.label} = {q.maxLabel}
        </span>
      </div>
    </div>
  );
}

function QuestionCard({ q, res }: { q: Question; res: CharlaResults }) {
  const t = tallyOf(res, q);
  const enough = t.respondents >= MIN_PEOPLE;

  // Texto libre: solo cuántas personas escribieron. Los textos nunca son públicos.
  if (q.mode === "text") {
    return (
      <section className="rounded-2xl bg-white p-5 text-[#223c5d] shadow-sm sm:p-6">
        <h3 className="text-[17px] font-bold leading-snug sm:text-lg">{q.prompt}</h3>
        {enough ? (
          <p className="mt-3 flex items-baseline gap-2">
            <span className="text-4xl leading-none tabular-nums" style={SERIF}>
              {t.respondents}
            </span>
            <span className="text-sm font-bold">respuestas escritas</span>
          </p>
        ) : (
          <p className="mt-3 text-sm text-[#55657a]">{NOT_ENOUGH}</p>
        )}
        <p className="mt-2 text-xs text-[#55657a]">Los textos no se publican.</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl bg-white p-5 text-[#223c5d] shadow-sm sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <h3 className="text-[17px] font-bold leading-snug sm:text-lg">{q.prompt}</h3>
        <CountChip n={t.respondents} />
      </div>
      {q.mode === "multi" && (
        <p className="mt-1 text-xs text-[#55657a]">
          {q.max ? `Cada persona podía elegir hasta ${q.max}.` : "Cada persona podía elegir varias."}
        </p>
      )}
      {!enough ? (
        <p className="mt-4 text-sm text-[#55657a]">{NOT_ENOUGH}</p>
      ) : q.mode === "scale" ? (
        <Scale q={q} t={t} />
      ) : (
        <Bars q={q} t={t} />
      )}
    </section>
  );
}

export default function CharlaResultados() {
  // El hook sondea solo cada 5 s y al volver a primer plano; ante un error
  // conserva lo último leído.
  const res = useCharlaResults(true, 5000);
  const { loaded, error, people } = res;

  return (
    <main className="min-h-dvh flex-1 bg-[#223c5d] text-white">
      <div className="mx-auto max-w-3xl px-5 pb-16 pt-6 sm:px-8">
        <header>
          <BrandLogos height={30} tone="blanco" />
        </header>

        <Kicker className="mt-8 text-xs text-[#dce4ff]">Lo que dijo la sala</Kicker>
        <h1 className="mt-2 text-[32px] leading-[1.1] sm:text-5xl" style={SERIF}>
          {TALK_TITLE}
        </h1>
        <div className="mt-4 space-y-1">
          {loaded && <p className="text-lg font-bold">{peopleLine(people)}</p>}
          <p className="text-sm leading-relaxed text-[#dce4ff]">
            Resultados en vivo. Aquí solo hay conteos: nunca nombres, correos ni textos escritos.
          </p>
        </div>
        {loaded && error && (
          <p
            role="status"
            className="mt-4 inline-block rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-[#dce4ff] ring-1 ring-white/20"
          >
            Sin conexión. Reintentando…
          </p>
        )}

        {!loaded && !error ? (
          <p className="mt-12 text-center text-[#dce4ff]">Cargando…</p>
        ) : !loaded && error ? (
          <div role="status" className="mt-10 rounded-2xl bg-white/10 p-6 ring-1 ring-white/15">
            <p className="text-lg font-bold">
              {error.kind === "missing"
                ? "Los resultados todavía no están disponibles."
                : "No pudimos cargar los resultados."}
            </p>
            {error.kind !== "missing" && (
              <p className="mt-2 text-sm text-[#dce4ff]">
                Revise su conexión. Esta página vuelve a intentarlo sola cada pocos segundos.
              </p>
            )}
          </div>
        ) : (
          MOMENT_IDS.map((id) => {
            const m = MOMENTS[id];
            const ids = m.questions;
            return (
              <section key={m.id} className="mt-10">
                <Kicker className="text-xs text-[#dce4ff]">{m.kicker}</Kicker>
                <h2 className="mt-1 text-2xl leading-tight sm:text-[28px]" style={SERIF}>
                  {m.title}
                </h2>
                <div className="mt-4 space-y-4">
                  {ids.map((qid) => (
                    <QuestionCard key={qid} q={QUESTIONS[qid]} res={res} />
                  ))}
                </div>
              </section>
            );
          })
        )}

        <footer className="mt-12 border-t border-white/15 pt-6 text-sm leading-relaxed text-[#dce4ff]">
          <p className="font-bold text-white">Sus respuestas alimentan InnKind Intelligence.</p>
          <p className="mt-1">
            Contacto:{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="underline">
              {CONTACT_EMAIL}
            </a>
            {" · "}
            <a href={PRIVACY_URL} className="underline">
              Aviso de privacidad
            </a>
          </p>
        </footer>
      </div>
    </main>
  );
}
