"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  ABIERTA,
  ACTS,
  ACT_LABEL,
  ATENEA,
  ATENEA_LABEL,
  BRAND_TEXT,
  DOORS,
  END_STEP,
  NUMBERED_QUESTIONS,
  P0,
  P3B,
  P5,
  P5_ANSWERS,
  PRE_STEP,
  QR,
  QUESTIONS,
  R1,
  R2,
  RED,
  RESULTS_SHORT_URL,
  SESSION,
  SESSION_QUESTIONS,
  STAND_SHORT_URL,
  STEPS,
  TWO_BRANDS,
  displayOption,
  optionLabel,
  stepAt,
  type QrKey,
  type Question,
  type Step,
} from "@/config/stand";
import { ts, useStandResults, useStandStep, type StandResultsState } from "@/hooks/useStand";
import { pct, safeStorage, tally, type Tally } from "@/lib/stand";
import { BrandMark, Rich } from "@/components/stand/StandUI";

// Pantalla del stand (TV 16:9). Se diseña sobre un lienzo fijo de 1920x1080 y
// se escala para que quepa SIN scroll en cualquier pantalla (1280x720 incluida).
//
// Modos:
//   ?k=CLAVE   → controla la sesión (se guarda en localStorage "stand_key").
//                Cada cambio de paso hace POST /api/stand/step (uno a la vez, con
//                la versión que vio: no pisa un paso más nuevo). ?k=off la borra.
//   sin clave  → solo sigue el paso de la sesión (la TV puede seguir a Jerónimo).
//   ?paso=N    → vista previa local del paso N (no toca la sesión).
// Teclado (clicker): → PageDown Espacio Enter = siguiente · ← PageUp Retroceso =
// anterior · 1-5 en Atenea = forzar la opción a-e · f = pantalla completa.

const W = 1920;
const H = 1080;
const KEY_STORAGE = "stand_key";
const LIVE_KINDS = new Set(["question", "registro", "resumen", "atenea"]);
type Letter = "a" | "b" | "c" | "d" | "e";
const LETTERS: Letter[] = ["a", "b", "c", "d", "e"];

const PUSH_TIMEOUT_MS = 7000; // tiempo máximo de cada envío del paso
const RETRY_MS = 2000;
const clampStep = (n: number) => Math.max(PRE_STEP, Math.min(END_STEP, n));
type PushReply = {
  code?: "bad-key" | "no-secret" | "no-service-role" | "conflict" | "bad-base" | string;
  step?: number;
  updated_at?: string | null;
};

type Mode = { kind: "preview" | "control" | "follow"; key: string | null };
type Sync =
  | "idle"
  | "checking"
  | "ok"
  | "sending"
  | "retrying"
  | "bad-key"
  | "no-secret"
  | "no-service-role";

// ---------------------------------------------------------------------------
// Lienzo escalado
// ---------------------------------------------------------------------------
function Stage({ children }: { children: React.ReactNode }) {
  const [scale, setScale] = useState(0); // 0 = aún sin medir
  useLayoutEffect(() => {
    const fit = () =>
      setScale(Math.max(0.05, Math.min(window.innerWidth / W, window.innerHeight / H)));
    fit();
    window.addEventListener("resize", fit);
    document.addEventListener("visibilitychange", fit);
    document.addEventListener("fullscreenchange", fit);
    return () => {
      window.removeEventListener("resize", fit);
      document.removeEventListener("visibilitychange", fit);
      document.removeEventListener("fullscreenchange", fit);
    };
  }, []);
  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-hidden bg-[#152a45]">
      <div
        style={{
          width: W,
          height: H,
          flex: "none",
          transform: `scale(${scale || 1})`,
          visibility: scale ? "visible" : "hidden",
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Piezas
// ---------------------------------------------------------------------------
function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-5 flex items-center gap-4 text-[24px] font-semibold uppercase tracking-[0.14em] text-white/70">
      <span className="inline-block h-[6px] w-[44px] rounded-full bg-[#c9283f]" />
      {children}
    </p>
  );
}

function QrCard({
  which,
  size,
  title,
  sub,
}: {
  which: QrKey;
  size: number;
  title?: string;
  sub?: string;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="rounded-[28px] bg-white p-[18px] shadow-2xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={QR[which]} alt="" width={size} height={size} style={{ width: size, height: size }} />
      </div>
      {title && <p className="mt-5 text-[28px] font-bold leading-tight">{title}</p>}
      {sub && <p className="mt-1 text-[22px] font-medium text-white/75">{sub}</p>}
    </div>
  );
}

function TvBars({ q, t, fs = 28 }: { q: Question; t: Tally; fs?: number }) {
  const badge = Math.round(fs * 1.45);
  const gap = Math.round(fs * 0.55);
  return (
    <ul style={{ display: "flex", flexDirection: "column", gap }}>
      {q.options.map((o) => {
        const n = t.counts[o.id] ?? 0;
        const p = pct(n, t.respondents);
        const lead = t.top === o.id && n > 0;
        const d = displayOption(q, o);
        return (
          <li key={o.id}>
            <div className="flex items-start gap-4">
              {d.letter && (
                <span
                  className="flex shrink-0 items-center justify-center rounded-full font-bold"
                  style={{
                    width: badge,
                    height: badge,
                    fontSize: fs * 0.72,
                    background: lead ? RED : "rgba(255,255,255,0.16)",
                  }}
                >
                  {d.letter}
                </span>
              )}
              <span
                className={`min-w-0 flex-1 leading-snug ${lead ? "font-semibold text-white" : "text-white/90"}`}
                style={{ fontSize: fs }}
              >
                <Rich text={d.label} />
              </span>
              <span className="shrink-0 font-bold tabular-nums" style={{ fontSize: fs }}>
                {p}%
                <span className="ml-2 font-medium text-white/55" style={{ fontSize: fs * 0.7 }}>
                  ({n})
                </span>
              </span>
            </div>
            <div
              className="mt-2 overflow-hidden rounded-full bg-white/[0.12]"
              style={{ height: Math.max(8, Math.round(fs * 0.42)), marginLeft: d.letter ? badge + 16 : 0 }}
            >
              <div
                className="h-full rounded-full transition-[width] duration-700 ease-out"
                style={{ width: `${p}%`, background: lead ? RED : "rgba(255,255,255,0.55)" }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Stat({ value, label, big }: { value: string; label: string; big?: boolean }) {
  return (
    <div className="min-w-0 flex-1">
      <p
        className="font-bold leading-none tracking-tight"
        style={{ fontSize: big ? 150 : 104 }}
      >
        {value}
      </p>
      <span className="mt-4 block h-[6px] w-[64px] rounded-full bg-[#c9283f]" />
      <p className="mt-4 leading-snug text-white/85" style={{ fontSize: big ? 30 : 26 }}>
        {label}
      </p>
    </div>
  );
}

function Markers({ items }: { items: string[] }) {
  return (
    <div className="flex shrink-0 flex-wrap gap-3 pt-6 text-[21px]">
      {items.map((m, i) => (
        <span key={i}>
          <Rich text={m} />
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pantallas
// ---------------------------------------------------------------------------
// Texto que es solo un marcador ([PEDIR: …]): va sin comillas.
const MARKER_ONLY = /^\[(?:PEDIR|APROBAR):[^\]]*\]$/;

function SlideScreen({ s }: { s: Step }) {
  const hasQr = !!s.qr?.length;
  const quotes = s.quotes ?? (s.quote ? [s.quote] : []);
  const blocks = [s.lead, s.stats, s.cards, s.lines, quotes.length ? quotes : null, s.callout].filter(
    Boolean
  ).length;
  const hero = blocks === 0;
  const dense = blocks >= 3 || (s.cards?.length ?? 0) >= 6;
  const titleSize = hero ? 88 : dense ? 54 : 64;
  const cardCount = s.cards?.length ?? 0;
  const cols = cardCount <= 3 ? cardCount : cardCount === 4 ? 2 : 3;
  const cardFs = dense ? 23 : 28;
  // Tarjetas por partes («Nos dijeron» / «Lo cambiamos»): pocas y con aire, letra más grande.
  const rowFs = dense ? 23 : 32;
  const quoteOnly = quotes.length === 1 && blocks === 1;
  const quotePair = quotes.length > 1;

  return (
    <div className="flex h-full gap-[72px]">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className={`flex min-h-0 flex-1 flex-col ${hero ? "justify-center" : ""}`}>
        {s.kicker && <Kicker>{s.kicker}</Kicker>}
        <h1 className="font-bold leading-[1.08] tracking-tight" style={{ fontSize: titleSize }}>
          {s.title}
        </h1>

        {s.lead && (
          <p className="mt-7 max-w-[1500px] text-[34px] leading-snug text-white/90">
            <Rich text={s.lead} />
          </p>
        )}

        {s.stats && (
          <div className="mt-10">
            {s.statsTitle && (
              <p className="mb-5 text-[24px] font-semibold uppercase tracking-[0.12em] text-white/60">
                {s.statsTitle}
              </p>
            )}
            <div className="flex gap-[56px]">
              {s.stats.map((st, i) => (
                <Stat key={i} value={st.value} label={st.label} big={s.stats!.length <= 2} />
              ))}
            </div>
            {s.sources && (
              <p className="mt-6 text-[21px] text-white/60">Fuente: {s.sources.join(" · ")}</p>
            )}
          </div>
        )}

        {s.lines && (
          <ul className="mt-9 space-y-3">
            {s.lines.map((l, i) => (
              <li key={i} className="flex gap-4 text-[27px] leading-snug text-white/90">
                <span className="mt-[14px] inline-block h-[8px] w-[8px] shrink-0 rounded-full bg-[#c9283f]" />
                <span>
                  <Rich text={l} />
                </span>
              </li>
            ))}
          </ul>
        )}

        {s.cards && (
          <div
            className="mt-9 grid gap-[24px]"
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
          >
            {s.cards.map((c, i) => (
              <div
                key={i}
                className="flex flex-col rounded-[26px] bg-white/[0.07] p-[28px] ring-1 ring-white/15"
              >
                <div className="flex items-start gap-4">
                  {c.tag && (
                    <span className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-full bg-[#c9283f] text-[26px] font-bold">
                      {c.tag}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    {c.title && (
                      <p className="font-bold leading-tight" style={{ fontSize: cardFs + 6 }}>
                        {c.title}
                      </p>
                    )}
                    {c.text && (
                      <p
                        className={`leading-snug text-white/90 ${c.title ? "mt-2" : ""}`}
                        style={{ fontSize: cardFs }}
                      >
                        <Rich text={c.text} />
                      </p>
                    )}
                    {c.rows && (
                      <div className={`space-y-6 ${c.title || c.text ? "mt-4" : ""}`}>
                        {c.rows.map((r, j) => (
                          <div key={j}>
                            <p
                              className="font-semibold uppercase tracking-[0.12em] text-white/60"
                              style={{ fontSize: Math.round(rowFs * 0.7) }}
                            >
                              {r.label}
                            </p>
                            <p className="mt-1 leading-snug text-white/90" style={{ fontSize: rowFs }}>
                              <Rich text={r.text} />
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {c.source && (
                  <p className="mt-auto pt-4 text-[19px] text-white/60">Fuente: {c.source}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {s.callout &&
          (s.callout.title ? (
            // Tarjeta con nombre (el caso): el nombre hace de título, sin cifra.
            <div className="mt-8 flex items-center gap-[40px] rounded-[26px] bg-white px-[40px] py-[30px] text-[#1b2d44] shadow-2xl">
              <div className="shrink-0">
                <p className="text-[20px] font-bold uppercase tracking-[0.14em] text-[#c9283f]">
                  {s.callout.label}
                </p>
                <p className="mt-1 text-[64px] font-bold leading-none tracking-tight text-[#223c5d]">
                  {s.callout.title}
                </p>
              </div>
              <span className="h-[92px] w-[3px] shrink-0 rounded-full bg-slate-200" />
              <p className="min-w-0 text-[30px] leading-snug">
                <Rich text={s.callout.text} />
              </p>
            </div>
          ) : (
            <div className="mt-7 flex items-start gap-5 rounded-[22px] border-l-[8px] border-[#c9283f] bg-white/[0.07] px-7 py-5">
              <p className="shrink-0 pt-[2px] text-[22px] font-semibold uppercase tracking-[0.12em] text-white/65">
                {s.callout.label}
              </p>
              <p className="text-[25px] leading-snug text-white/90">
                <Rich text={s.callout.text} />
              </p>
            </div>
          ))}

        {quotes.length > 0 && (
          <div className={quotePair ? "mt-8 grid grid-cols-2 gap-[48px]" : ""}>
            {quotes.map((q, i) => (
              <blockquote
                key={i}
                className={
                  quotePair
                    ? "border-l-[6px] border-[#c9283f] pl-7"
                    : quoteOnly
                      ? "mt-12 max-w-[1560px]"
                      : "mt-8 max-w-[1560px]"
                }
              >
                <p
                  className="font-semibold leading-snug text-white"
                  style={{ fontSize: quoteOnly ? 46 : dense ? 26 : 36 }}
                >
                  {MARKER_ONLY.test(q.text) ? <Rich text={q.text} /> : <>«<Rich text={q.text} />»</>}
                </p>
                {q.author && (
                  <p className="mt-3 text-white/65" style={{ fontSize: dense ? 20 : 24 }}>
                    <Rich text={q.author} />
                  </p>
                )}
              </blockquote>
            ))}
          </div>
        )}

        {s.footer &&
          (s.footer === BRAND_TEXT ? (
            <BrandMark className="mt-14 block text-[52px]" />
          ) : (
            <p className="mt-8 text-[32px] font-semibold leading-snug text-white">
              <span className="mr-4 inline-block h-[6px] w-[36px] -translate-y-[8px] rounded-full bg-[#c9283f]" />
              <Rich text={s.footer} />
            </p>
          ))}

        </div>
        {s.markers && <Markers items={s.markers} />}
      </div>

      {hasQr && (
        <aside className="flex w-[430px] shrink-0 flex-col items-center justify-center">
          <QrCard which={s.qr![0]} size={360} title="Entren desde su celular" sub={STAND_SHORT_URL} />
        </aside>
      )}
    </div>
  );
}

function QuestionScreen({ s, res }: { s: Step; res: StandResultsState }) {
  const rows = res.rows;
  const ids = s.questionIds ?? [];
  const q = QUESTIONS[ids[0]];
  const t = tally(rows, q);
  const n = NUMBERED_QUESTIONS.indexOf(q.id);
  const long = q.prompt.length > 95;
  const hasDetail = q.options.some((o) => o.detail);
  const fs = hasDetail ? 22 : q.options.length >= 6 ? 27 : 30;
  const withBudget = ids.includes("P3b");
  const withOpen = ids.includes("ABIERTA");
  const tb = withBudget ? tally(rows, P3B) : null;
  // De la abierta solo llega cuántas propuestas hay (nunca los textos).
  const open = withOpen ? { respondents: res.abierta } : null;
  const registered = tally(rows, R1).respondents;

  return (
    <div className="flex h-full gap-[64px]">
      <div className="flex min-w-0 flex-1 flex-col">
        <Kicker>
          {n >= 0 ? `Pregunta ${n + 1} de ${NUMBERED_QUESTIONS.length}` : "Pregunta"}
          {q.mode === "multi" ? ` · elijan hasta ${q.max ?? 2}` : ""}
        </Kicker>
        <h1
          className="font-bold leading-[1.14] tracking-tight"
          style={{ fontSize: long ? 44 : 54 }}
        >
          {q.prompt}
        </h1>
        <div className="mt-9 min-h-0 flex-1">
          <TvBars q={q} t={t} fs={fs} />
        </div>
      </div>

      <aside className="flex w-[420px] shrink-0 flex-col items-center">
        <QrCard which="entrar" size={withBudget || withOpen ? 230 : 320} sub={STAND_SHORT_URL} />
        <div className="mt-7 text-center">
          <p className="text-[92px] font-bold leading-none tabular-nums">{t.respondents}</p>
          <p className="mt-2 text-[24px] text-white/75">
            {t.respondents === 1 ? "persona respondió" : "personas respondieron"}
            {registered > 0 ? ` de ${registered}` : ""}
          </p>
        </div>
        {tb && (
          <div className="mt-auto w-full rounded-[22px] bg-white/[0.07] p-6 ring-1 ring-white/15">
            <p className="mb-4 text-[24px] font-bold leading-tight">{P3B.prompt}</p>
            <TvBars q={P3B} t={tb} fs={21} />
          </div>
        )}
        {open && (
          <div className="mt-auto w-full rounded-[22px] bg-white/[0.07] p-6 ring-1 ring-white/15">
            <p className="text-[18px] font-semibold uppercase tracking-[0.12em] text-white/60">
              En su celular, opcional
            </p>
            <p className="mt-2 text-[23px] font-semibold leading-snug">«{ABIERTA.prompt}»</p>
            <p className="mt-3 text-[21px] text-white/75">
              {open.respondents} {open.respondents === 1 ? "propuesta" : "propuestas"}
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}

function RegistroScreen({ s, rows }: { s: Step; rows: StandResultsState["rows"] }) {
  const t1 = tally(rows, R1);
  const t2 = tally(rows, R2);
  return (
    <div className="flex h-full gap-[64px]">
      <div className="flex min-w-0 flex-1 flex-col">
        {s.kicker && <Kicker>{s.kicker}</Kicker>}
        <h1 className="text-[58px] font-bold leading-[1.08] tracking-tight">{s.title}</h1>
        {s.lead && <p className="mt-3 text-[28px] text-white/85">{s.lead}</p>}
        <p className="mt-6 text-[25px] font-semibold text-white">{R1.prompt}</p>
        <div className="mt-4">
          <TvBars q={R1} t={t1} fs={22} />
        </div>
      </div>
      <aside className="flex w-[430px] shrink-0 flex-col items-center">
        <QrCard which="entrar" size={240} sub={STAND_SHORT_URL} />
        <div className="mt-4 text-center">
          <p className="text-[80px] font-bold leading-none tabular-nums">{t1.respondents}</p>
          <p className="mt-1 text-[23px] text-white/75">
            {t1.respondents === 1 ? "persona en la sala" : "personas en la sala"}
          </p>
        </div>
        <div className="mt-auto w-full rounded-[22px] bg-white/[0.07] px-6 py-5 ring-1 ring-white/15">
          <p className="mb-3 text-[21px] font-bold leading-tight">{R2.prompt}</p>
          <TvBars q={R2} t={t2} fs={18} />
        </div>
      </aside>
    </div>
  );
}

const CPS = 55; // caracteres por segundo del efecto de escritura

// La respuesta validada de Atenea con efecto de escritura. Se monta de nuevo
// (key) cada vez que cambia el reto, así el texto vuelve a empezar.
function TypedAnswer({
  answer,
  skip,
  onDoneChange,
}: {
  answer: (typeof ATENEA)[Letter];
  skip: number;
  onDoneChange: (done: boolean) => void;
}) {
  const full = answer.respuesta;
  const [typed, setTyped] = useState(0);
  const [skipAtMount] = useState(skip);
  const skipped = skip !== skipAtMount; // la tecla "siguiente" completa el texto
  const shown = skipped ? full.length : typed;
  const done = shown >= full.length;

  useEffect(() => {
    if (skipped) return;
    const startAt = Date.now() + 900;
    const timer = setInterval(() => {
      const n = Math.floor(((Date.now() - startAt) / 1000) * CPS);
      if (n <= 0) return;
      setTyped(Math.min(n, full.length));
      if (n >= full.length) clearInterval(timer);
    }, 33);
    return () => clearInterval(timer);
  }, [full, skipped]);

  useEffect(() => {
    onDoneChange(done);
  }, [done, onDoneChange]);

  // Párrafos con el texto aún no escrito en transparente: el diseño no salta.
  const paragraphs: { shown: string; rest: string; typing: boolean }[] = [];
  let left = shown;
  for (const p of full.split(/\n\n+/)) {
    const k = Math.max(0, Math.min(p.length, left));
    paragraphs.push({ shown: p.slice(0, k), rest: p.slice(k), typing: k > 0 && k < p.length });
    left -= p.length + 2;
  }
  const caretAt = paragraphs.findIndex((p) => p.typing);

  return (
    <div className="flex min-w-0 flex-1 flex-col rounded-[32px] bg-white p-[44px] text-[#1b2d44] shadow-2xl">
      <div className="flex items-center gap-4">
        <span className="flex h-[50px] w-[50px] items-center justify-center rounded-full bg-[#223c5d] text-[26px] font-bold text-white">
          A
        </span>
        <p className="text-[24px] font-semibold text-[#223c5d]">{ATENEA_LABEL}</p>
        {shown === 0 && <p className="ml-auto text-[21px] text-slate-500">escribiendo…</p>}
      </div>
      <div className="mt-7 space-y-[16px] text-[27px] leading-[1.42]">
        {paragraphs.map((p, i) => (
          <p key={i}>
            {p.shown}
            {caretAt === i && (
              <span className="ml-[2px] inline-block h-[28px] w-[3px] translate-y-[4px] animate-pulse bg-[#c9283f]" />
            )}
            <span className="text-transparent">{p.rest}</span>
          </p>
        ))}
      </div>
      <div
        className={`mt-auto border-t border-slate-200 pt-5 text-[20px] leading-snug text-slate-600 transition-opacity duration-700 ${
          done ? "opacity-100" : "opacity-0"
        }`}
      >
        <span className="font-semibold text-[#223c5d]">Fuentes:</span> {answer.fuentes.join(" · ")}
      </div>
    </div>
  );
}

function AteneaScreen({
  results,
  force,
  skip,
  onDoneChange,
}: {
  results: StandResultsState;
  force: Letter | null;
  skip: number;
  onDoneChange: (done: boolean) => void;
}) {
  // El reto ganador se congela al entrar al paso, con la primera lectura fresca
  // de los votos (o a los 2,5 s si no llega), para que no cambie a media
  // respuesta si alguien vota tarde. Empate → la primera en el orden; sin votos → a.
  const [initialFetchedAt] = useState(results.fetchedAt);
  const [frozen, setFrozen] = useState<Letter | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 2500);
    return () => clearTimeout(t);
  }, []);
  if (!frozen && (results.fetchedAt > initialFetchedAt || timedOut)) {
    setFrozen((tally(results.rows, P0).top as Letter | null) ?? "a");
  }

  const key: Letter | null = force ?? frozen;
  const answer = key ? ATENEA[key] : null;
  const t = tally(results.rows, P0);
  const votes = key ? (t.counts[key] ?? 0) : 0;

  return (
    <div className="flex h-full gap-[52px]">
      <div className="flex w-[560px] shrink-0 flex-col">
        <Kicker>Ustedes eligieron</Kicker>
        {answer && key ? (
          <>
            <div className="flex items-start gap-5">
              <span className="flex h-[64px] w-[64px] shrink-0 items-center justify-center rounded-full bg-[#c9283f] text-[34px] font-bold">
                {key}
              </span>
              <p className="text-[40px] font-bold leading-[1.15]">{answer.reto}</p>
            </div>
            <p className="mt-5 text-[24px] text-white/70">
              {t.respondents > 0
                ? `${votes} de ${t.respondents} ${t.respondents === 1 ? "voto" : "votos"}`
                : "Todavía no hay votos"}
            </p>
            <div className="mt-auto rounded-[24px] bg-white/[0.07] p-7 ring-1 ring-white/15">
              <p className="text-[19px] font-semibold uppercase tracking-[0.12em] text-white/60">
                Le preguntamos a Atenea
              </p>
              <p className="mt-3 text-[25px] italic leading-snug text-white/90">
                «{answer.pregunta}»
              </p>
            </div>
          </>
        ) : (
          <p className="text-[40px] font-bold text-white/80">Contando los votos…</p>
        )}
      </div>

      {answer && key ? (
        <TypedAnswer key={key} answer={answer} skip={skip} onDoneChange={onDoneChange} />
      ) : (
        <div className="flex min-w-0 flex-1 items-center justify-center rounded-[32px] bg-white/[0.07] ring-1 ring-white/15">
          <p className="text-[28px] text-white/70">{ATENEA_LABEL}</p>
        </div>
      )}
    </div>
  );
}

function ResumenScreen({ s, res }: { s: Step; res: StandResultsState }) {
  const rows = res.rows;
  const people = res.people;
  const t5 = tally(rows, P5);
  const freno = t5.top;
  return (
    <div className="flex h-full flex-col">
      <Kicker>{s.kicker}</Kicker>
      <div className="flex items-end justify-between gap-8">
        <h1 className="text-[64px] font-bold leading-none tracking-tight">{s.title}</h1>
        <p className="pb-1 text-[26px] text-white/70">
          {people} {people === 1 ? "persona" : "personas"}
        </p>
      </div>
      {s.lead && <p className="mt-3 text-[28px] leading-snug text-white/75">{s.lead}</p>}
      <div className="mt-7 flex min-h-0 flex-1 gap-[52px]">
        <ul className="flex min-w-0 flex-1 flex-col justify-between">
          {SESSION_QUESTIONS.map((qid) => {
            const q = QUESTIONS[qid];
            const t = tally(rows, q);
            const top = t.top;
            const p = top ? pct(t.counts[top], t.respondents) : 0;
            return (
              <li key={qid} className="border-b border-white/10 pb-2 last:border-0 last:pb-0">
                <p className="text-[17px] font-semibold uppercase tracking-[0.1em] text-white/55">
                  {q.short}
                </p>
                <div className="flex items-baseline gap-6">
                  <p className="min-w-0 flex-1 truncate text-[26px] font-semibold">
                    {top ? optionLabel(q, top) : "Sin respuestas todavía"}
                  </p>
                  {top && (
                    <p className="shrink-0 text-[28px] font-bold tabular-nums">
                      {p}%
                      <span className="ml-2 text-[19px] font-medium text-white/55">
                        de {t.respondents}
                      </span>
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        <div className="flex w-[760px] shrink-0 flex-col rounded-[32px] bg-white p-[44px] text-[#1b2d44] shadow-2xl">
          <p className="text-[22px] font-bold uppercase tracking-[0.14em] text-[#c9283f]">
            El freno n.° 1
          </p>
          {freno ? (
            <>
              <p className="mt-6 text-[22px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                Ustedes dijeron
              </p>
              <p className="mt-2 text-[44px] font-bold leading-[1.1] text-[#223c5d]">
                «{optionLabel(P5, freno)}»
              </p>
              <p className="mt-2 text-[22px] text-slate-500">
                {pct(t5.counts[freno], t5.respondents)}% de {t5.respondents}{" "}
                {t5.respondents === 1 ? "persona" : "personas"}
              </p>
              <p className="mt-8 text-[22px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                Nosotros creemos
              </p>
              <p className="mt-2 text-[27px] leading-snug">
                «<Rich text={P5_ANSWERS[freno] ?? ""} />»
              </p>
            </>
          ) : (
            <p className="mt-6 text-[30px] text-slate-500">Todavía no hay respuestas a esta pregunta.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function PuertasScreen({ s }: { s: Step }) {
  return (
    <div className="flex h-full gap-[64px]">
      <div className="flex min-w-0 flex-1 flex-col">
        {s.kicker && <Kicker>{s.kicker}</Kicker>}
        <h1 className="text-[70px] font-bold leading-none tracking-tight">{s.title}</h1>
        {s.lead && <p className="mt-5 text-[32px] leading-snug text-white/90">{s.lead}</p>}
        <div className="mt-9 grid flex-1 grid-cols-2 gap-[24px]">
          {DOORS.map((d) => (
            <div
              key={d.id}
              className={`rounded-[26px] p-[28px] ring-1 ${
                d.id === "0" ? "bg-white/[0.04] ring-white/10" : "bg-white/[0.08] ring-white/15"
              }`}
            >
              <p className="text-[29px] font-bold leading-tight">{d.title}</p>
              {d.options ? (
                <ul className="mt-4 space-y-2">
                  {d.options.map((o) => (
                    <li key={o.id} className="flex gap-3 text-[21px] leading-snug text-white/85">
                      <span className="mt-[11px] inline-block h-[7px] w-[7px] shrink-0 rounded-full bg-[#c9283f]" />
                      {o.label}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-[22px] leading-snug text-white/85">{d.tvText ?? d.text}</p>
              )}
            </div>
          ))}
        </div>
      </div>
      <aside className="flex w-[440px] shrink-0 flex-col items-center justify-center">
        <QrCard which="entrar" size={370} title="Escaneen el código" sub="o usen el talón del tríptico" />
        <p className="mt-3 text-[22px] font-semibold text-white">{STAND_SHORT_URL}</p>
      </aside>
    </div>
  );
}

function GraciasScreen({ s }: { s: Step }) {
  return (
    <div className="flex h-full items-center gap-[80px]">
      <div className="min-w-0 flex-1">
        <h1 className="text-[150px] font-bold leading-none tracking-tight">{s.title}</h1>
        <BrandMark className="mt-8 block text-[54px]" />
        <p className="mt-10 max-w-[900px] text-[30px] leading-snug text-white/85">{TWO_BRANDS}</p>
      </div>
      <div className="flex shrink-0 gap-[48px]">
        <QrCard which="atenea" size={300} title="Atenea (GPT)" sub="Atenea está abierta: escanéenla" />
        <QrCard which="resultados" size={300} title="Lo que dijo la sala" sub={RESULTS_SHORT_URL} />
      </div>
    </div>
  );
}

function PreScreen() {
  return (
    <div className="flex h-full items-center gap-[80px]">
      <div className="min-w-0 flex-1">
        <Kicker>GET Forum 2026 · Quito</Kicker>
        <BrandMark className="block text-[96px] leading-none" />
        <p className="mt-10 max-w-[1100px] text-[34px] leading-snug text-white/90">{TWO_BRANDS}</p>
        <p className="mt-10 text-[40px] font-bold">
          La sesión empieza hoy a las 4:30 p. m.
        </p>
        <p className="mt-3 text-[28px] text-white/80">
          Escaneen el código y regístrense: son 2 toques y no les pedimos su nombre.
        </p>
      </div>
      <aside className="flex w-[440px] shrink-0 flex-col items-center">
        <QrCard which="entrar" size={380} title="Entren desde su celular" sub={STAND_SHORT_URL} />
      </aside>
    </div>
  );
}

function EndScreen() {
  return (
    <div className="flex h-full flex-col justify-center">
      <Kicker>Stand de SenecaLab e InnKind · GET Forum 2026</Kicker>
      <h1 className="text-[76px] font-bold leading-[1.05] tracking-tight">¿Quieren seguir con nosotros?</h1>
      <p className="mt-5 max-w-[1500px] text-[30px] leading-snug text-white/85">{TWO_BRANDS}</p>
      <div className="mt-14 flex justify-between gap-[48px]">
        <QrCard which="entrar" size={290} title="Quiero hablar con ustedes" sub="Tres puertas" />
        <QrCard which="atenea" size={290} title="Atenea (GPT)" sub="Atenea está abierta: escanéenla" />
        <QrCard which="resultados" size={290} title="Lo que dijo la sala" sub={RESULTS_SHORT_URL} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Barras superior e inferior
// ---------------------------------------------------------------------------
function TopBar({ step }: { step: number }) {
  const s = stepAt(step);
  return (
    <div className="flex h-[96px] shrink-0 items-center justify-between border-b border-white/10 px-[72px]">
      <BrandMark className="w-[420px] text-[32px]" />
      <div className="flex items-center gap-3">
        {ACTS.map((a, i) => {
          const on = s?.act === a.id;
          return (
            <span
              key={a.id}
              className={`rounded-full px-6 py-2 text-[23px] font-semibold ${
                on ? "bg-[#c9283f] text-white" : "text-white/55 ring-1 ring-white/15"
              }`}
            >
              {i + 1} · {a.label}
            </span>
          );
        })}
      </div>
      <p className="w-[420px] text-right text-[22px] font-medium text-white/60">
        {s && (s.act === "apertura" || s.act === "cierre") ? `${ACT_LABEL[s.act]} · ` : ""}
        GET Forum 2026
      </p>
    </div>
  );
}

function statusOf(
  mode: Mode | null,
  sync: Sync,
  remoteError: string | null,
  remoteLoaded: boolean
) {
  if (!mode) return null;
  if (mode.kind === "preview")
    return { color: "#fde047", text: "Vista previa: no mueve la sesión" };
  if (mode.kind === "control") {
    // Sin haber leído la sesión nunca, la pantalla no empuja el paso.
    if (!remoteLoaded && remoteError)
      return { color: "#fde047", text: "Sin leer la sesión: solo se mueve esta pantalla" };
    switch (sync) {
      case "bad-key":
        return { color: "#f87171", text: "Clave incorrecta: los celulares no siguen esta pantalla" };
      case "no-secret":
        return { color: "#f87171", text: "El servidor no tiene STAND_SECRET: los celulares no siguen" };
      case "no-service-role":
        return { color: "#f87171", text: "Falta SUPABASE_SERVICE_ROLE en el servidor" };
      case "retrying":
        return { color: "#fde047", text: "Sin conexión: reintentando" };
      case "sending":
      case "checking":
        return { color: "#fde047", text: "Sincronizando…" };
      default:
        return remoteError
          ? { color: "#fde047", text: "Control · sin lectura de la sesión" }
          : { color: "#4ade80", text: "Control" };
    }
  }
  return remoteError
    ? { color: "#f87171", text: "Sin conexión con la sesión" }
    : { color: "#4ade80", text: "En vivo" };
}

// ---------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------

// Modo según la URL (?k=, ?paso=) y la clave guardada. Solo en el navegador.
function readInitialMode(): { mode: Mode; step: number } {
  const sp = new URLSearchParams(window.location.search);
  let key = safeStorage.get(KEY_STORAGE);
  if (sp.has("k")) {
    const k = (sp.get("k") ?? "").trim();
    key = !k || k === "off" ? null : k;
  }
  const paso = sp.get("paso");
  if (paso !== null && /^\d+$/.test(paso)) {
    return {
      mode: { kind: "preview", key: null },
      step: Math.max(PRE_STEP, Math.min(END_STEP, parseInt(paso, 10))),
    };
  }
  return {
    mode: key ? { kind: "control", key } : { kind: "follow", key: null },
    step: PRE_STEP,
  };
}

const noopSubscribe = () => () => {};

// El modo depende de la URL y del localStorage: el mazo se monta después de hidratar.
export default function Pantalla() {
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  if (!mounted) {
    return (
      <Stage>
        <div className="h-full w-full bg-[#223c5d]" />
      </Stage>
    );
  }
  return <Deck />;
}

function Deck() {
  const remote = useStandStep(3000);
  const [init] = useState(readInitialMode);
  const mode = init.mode;
  const [step, setStep] = useState(init.step);
  const [sync, setSync] = useState<Sync>(mode.kind === "control" ? "checking" : "idle");
  // Opción de Atenea forzada con las teclas 1-5; vale solo para el paso en que se pidió.
  const [forceFor, setForceFor] = useState<{ step: number; letter: Letter } | null>(null);
  const [skip, setSkip] = useState(0);

  const stepRef = useRef(step);
  const modeRef = useRef<Mode>(mode);
  const typingDoneRef = useRef(true);
  const remoteRef = useRef<{ step: number | null; updatedAt: string | null; loaded: boolean }>({
    step: null,
    updatedAt: null,
    loaded: false,
  });
  // Envío del paso (modo control): UN solo POST a la vez y siempre el último
  // paso pedido. Cada envío lleva la versión (updated_at) que vio la pantalla;
  // si otro controlador movió la sesión después, el servidor responde 409.
  const pendingRef = useRef<number | null>(null); // paso que falta confirmar
  const requestRef = useRef(false); // hay un POST en vuelo
  const drainingRef = useRef(false); // el ciclo de envío está activo
  const wakeRef = useRef<(() => void) | null>(null); // corta la espera del reintento
  const baseRef = useRef<string | null>(null); // último updated_at conocido (tal cual)
  const brokenRef = useRef(false);
  const lastPushAtRef = useRef(0);
  const aliveRef = useRef(true);

  useEffect(() => {
    stepRef.current = step;
    modeRef.current = mode;
    remoteRef.current = { step: remote.step, updatedAt: remote.updatedAt, loaded: remote.loaded };
  });

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      wakeRef.current?.();
    };
  }, []);

  // Guarda (o borra) la clave de ?k= y la quita de la barra de direcciones;
  // en modo control, verifica la clave con el servidor.
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    if (sp.has("k")) {
      const k = (sp.get("k") ?? "").trim();
      if (!k || k === "off") safeStorage.remove(KEY_STORAGE);
      else safeStorage.set(KEY_STORAGE, k);
      sp.delete("k");
      const qs = sp.toString();
      window.history.replaceState(null, "", window.location.pathname + (qs ? `?${qs}` : ""));
    }
    const key = mode.kind === "control" ? mode.key : null;
    if (key) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), PUSH_TIMEOUT_MS);
      fetch("/api/stand/step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ k: key, validate: true }),
        signal: ctrl.signal,
      })
        .then(async (r) => {
          const j = (await r.json().catch(() => ({}))) as { code?: string; serviceRole?: boolean };
          if (r.ok) setSync(j.serviceRole === false ? "no-service-role" : "ok");
          else if (j.code === "bad-key") setSync("bad-key");
          else if (j.code === "no-secret") setSync("no-secret");
          else setSync("ok");
        })
        .catch(() => setSync("ok"))
        .finally(() => clearTimeout(timer));
    }
  }, [mode]);

  // Seguir el paso de la sesión (salvo vista previa).
  useEffect(() => {
    if (mode.kind === "preview") return;
    if (remote.step === null) return;
    const target = clampStep(remote.step);
    if (mode.kind === "control") {
      if (brokenRef.current) return;
      const at = ts(remote.updatedAt);
      if (pendingRef.current !== null) {
        // Otro controlador movió la sesión después del último estado que vio
        // esta pantalla: gana lo guardado y se descarta lo pendiente. (Si hay
        // un envío en vuelo, lo resuelve su respuesta: 409.)
        if (!requestRef.current && at > ts(baseRef.current)) {
          pendingRef.current = null;
          wakeRef.current?.();
          baseRef.current = remote.updatedAt;
          lastPushAtRef.current = at;
          setSync("ok");
          setStep(target);
        }
        return;
      }
      if (lastPushAtRef.current && at && at < lastPushAtRef.current) return;
      if (at >= ts(baseRef.current)) baseRef.current = remote.updatedAt;
    }
    setStep(target);
  }, [remote.step, remote.updatedAt, mode]);

  // Manda el paso pendiente: uno a la vez, con tiempo máximo, y al terminar
  // manda el último si hubo más clics. Reintenta cada 2 s si no hay red.
  const drain = useCallback(async (key: string) => {
    if (drainingRef.current) return;
    drainingRef.current = true;
    try {
      while (aliveRef.current && pendingRef.current !== null) {
        const target = pendingRef.current;
        setSync("sending");
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), PUSH_TIMEOUT_MS);
        let status = 0;
        let j: PushReply = {};
        requestRef.current = true;
        try {
          const r = await fetch("/api/stand/step", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              session: SESSION,
              step: target,
              k: key,
              base_updated_at: baseRef.current,
            }),
            signal: ctrl.signal,
          });
          status = r.status;
          j = (await r.json().catch(() => ({}))) as PushReply;
        } catch {
          status = 0; // sin red o tiempo agotado
        } finally {
          clearTimeout(timer);
          requestRef.current = false;
        }
        if (!aliveRef.current) return;

        if (status >= 200 && status < 300) {
          if (typeof j.updated_at === "string") baseRef.current = j.updated_at;
          lastPushAtRef.current = ts(j.updated_at) || Date.now();
          brokenRef.current = false;
          if (pendingRef.current === target) pendingRef.current = null;
          continue; // si hubo otro clic mientras tanto, se manda el último
        }
        if (status === 409 && typeof j.step === "number") {
          if (typeof j.updated_at === "string") baseRef.current = j.updated_at;
          lastPushAtRef.current = ts(j.updated_at);
          if (j.step === target) {
            // Este paso ya estaba guardado (se había perdido la respuesta).
            if (pendingRef.current === target) pendingRef.current = null;
            continue;
          }
          // Otro controlador movió la sesión: gana lo guardado.
          pendingRef.current = null;
          setStep(clampStep(j.step));
          break;
        }
        if (j.code === "bad-key" || j.code === "no-secret" || j.code === "no-service-role") {
          // No se arregla reintentando: la pantalla sigue funcionando sola.
          pendingRef.current = null;
          brokenRef.current = true;
          setSync(j.code as Sync);
          return;
        }
        if (status === 400) {
          if (j.code === "bad-base") {
            baseRef.current = null; // versión ilegible: se manda sin ella
            continue;
          }
          pendingRef.current = null; // no se arregla reintentando
          break;
        }
        // Sin red, tiempo agotado o error del servidor: espera 2 s (o menos si
        // llega otro clic) y reintenta con el último paso pedido.
        if (pendingRef.current === null) break;
        setSync("retrying");
        await new Promise<void>((resolve) => {
          const t = setTimeout(done, RETRY_MS);
          function done() {
            clearTimeout(t);
            wakeRef.current = null;
            resolve();
          }
          wakeRef.current = done;
        });
      }
      if (aliveRef.current && !brokenRef.current) {
        setSync("ok");
        // Si mientras se enviaba llegó un paso más nuevo de otro controlador, se sigue.
        const r = remoteRef.current;
        if (r.step !== null && ts(r.updatedAt) > ts(baseRef.current)) {
          baseRef.current = r.updatedAt;
          lastPushAtRef.current = ts(r.updatedAt);
          setStep(clampStep(r.step));
        }
      }
    } finally {
      drainingRef.current = false;
    }
  }, []);

  const push = useCallback(
    (target: number, key: string) => {
      pendingRef.current = target;
      if (drainingRef.current) wakeRef.current?.(); // si esperaba para reintentar, manda ya
      else void drain(key);
    },
    [drain]
  );

  const go = useCallback(
    (delta: number) => {
      const m = modeRef.current;
      if (m.kind === "follow") return;
      const next = clampStep(stepRef.current + delta);
      if (next === stepRef.current) return;
      stepRef.current = next; // dos clics seguidos antes de volver a pintar
      setStep(next);
      if (m.kind !== "control" || !m.key) return;
      // Si la pantalla todavía no ha leído la sesión (se recargó sin red, o falta
      // el SQL), solo se mueve ella: empujar desde el paso 0 haría saltar a toda
      // la sala. Cuando lea la sesión, vuelve al paso guardado.
      if (!remoteRef.current.loaded) return;
      push(next, m.key);
    },
    [push]
  );

  // Teclado y clicker.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      // Tecla mantenida (autorrepetición): no avanza varios pasos de golpe.
      if (e.repeat) {
        e.preventDefault();
        return;
      }
      const k = e.key;
      const s = stepAt(stepRef.current);

      if (k === "f" || k === "F") {
        e.preventDefault();
        if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
        else void document.documentElement.requestFullscreen().catch(() => {});
        return;
      }
      if (s?.kind === "atenea" && /^[1-5]$/.test(k)) {
        e.preventDefault();
        setForceFor({ step: stepRef.current, letter: LETTERS[parseInt(k, 10) - 1] });
        return;
      }
      const isNext = k === "ArrowRight" || k === "PageDown" || k === " " || k === "Enter" || e.code === "Space";
      const isPrev = k === "ArrowLeft" || k === "PageUp" || k === "Backspace";
      if (!isNext && !isPrev) return;
      e.preventDefault();
      if (isNext && s?.kind === "atenea" && !typingDoneRef.current) {
        setSkip((x) => x + 1);
        return;
      }
      go(isNext ? 1 : -1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  const onTypingDone = useCallback((done: boolean) => {
    typingDoneRef.current = done;
  }, []);

  const current = stepAt(step);
  const live = !!current && LIVE_KINDS.has(current.kind);
  const results = useStandResults(live, 2000);

  const remoteError = remote.error ? remote.error : null;
  const status = statusOf(mode, sync, remoteError?.message ?? null, remote.loaded);
  const canNav = mode?.kind === "control" || mode?.kind === "preview";

  // Aviso visible si falta la base o no hay conexión (la pantalla no se cae).
  const dbError =
    mode?.kind !== "preview" && remoteError
      ? remoteError
      : live && results.error
        ? results.error
        : null;

  let screen: React.ReactNode;
  if (step <= PRE_STEP || !current) {
    screen = step >= END_STEP ? <EndScreen /> : <PreScreen />;
  } else {
    switch (current.kind) {
      case "question":
        screen = <QuestionScreen s={current} res={results} />;
        break;
      case "registro":
        screen = <RegistroScreen s={current} rows={results.rows} />;
        break;
      case "atenea":
        screen = (
          <AteneaScreen
            key={current.id}
            results={results}
            force={forceFor && forceFor.step === step ? forceFor.letter : null}
            skip={skip}
            onDoneChange={onTypingDone}
          />
        );
        break;
      case "resumen":
        screen = <ResumenScreen s={current} res={results} />;
        break;
      case "puertas":
        screen = <PuertasScreen s={current} />;
        break;
      case "gracias":
        screen = <GraciasScreen s={current} />;
        break;
      default:
        screen = <SlideScreen s={current} />;
    }
  }

  const progress = Math.max(0, Math.min(1, step / STEPS.length));

  return (
    <Stage>
      <div className="flex h-full w-full flex-col bg-[#223c5d] font-sans text-white">
        <TopBar step={step} />
        <div className="relative min-h-0 flex-1 px-[72px] pb-[36px] pt-[44px]">
          {screen}
        </div>
        <div className="relative h-[72px] shrink-0">
          <div className="absolute inset-x-0 top-0 h-[6px] bg-white/10">
            <div
              className="h-full bg-[#c9283f] transition-[width] duration-500"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <div className="flex h-full items-center justify-between px-[72px] pt-[6px]">
            {dbError ? (
              <p className="rounded-lg border-2 border-[#a16207] bg-[#fde047] px-4 py-1.5 text-[18px] font-semibold text-[#3a2c00]">
                {dbError.kind === "missing"
                  ? "Sin datos en vivo: falta correr supabase/12-stand.sql en Supabase"
                  : "Sin conexión con la base de datos: reintentando"}
              </p>
            ) : (
              <p className="text-[21px] text-white/70">
                Entren desde su celular:{" "}
                <span className="font-semibold text-white">{STAND_SHORT_URL}</span>
              </p>
            )}
            <div className="flex items-center gap-6 text-[19px] text-white/70">
              {status && (
                <span className="flex items-center gap-2">
                  <span className="inline-block h-[12px] w-[12px] rounded-full" style={{ background: status.color }} />
                  {status.text}
                </span>
              )}
              {canNav && current && <span>min {current.minutes}</span>}
              <span className="font-semibold tabular-nums text-white/85">
                {step <= PRE_STEP ? "Antes" : step >= END_STEP ? "Fin" : `${step} / ${STEPS.length}`}
              </span>
              {canNav && (
                <span className="flex gap-2">
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      go(-1);
                    }}
                    className="h-[44px] w-[52px] rounded-lg bg-white/10 text-[24px] font-bold hover:bg-white/20"
                    aria-label="Anterior"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      if (current?.kind === "atenea" && !typingDoneRef.current) setSkip((x) => x + 1);
                      else go(1);
                    }}
                    className="h-[44px] w-[52px] rounded-lg bg-white/10 text-[24px] font-bold hover:bg-white/20"
                    aria-label="Siguiente"
                  >
                    ›
                  </button>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </Stage>
  );
}
