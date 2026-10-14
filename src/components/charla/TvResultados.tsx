"use client";

import {
  C,
  CHARLA_SHORT_URL,
  MOMENTS,
  QR,
  QUESTIONS,
  type MomentId,
  type Question,
} from "@/config/charla";
import { formatMean, pct, tallyOf, type CharlaResults, type Tally } from "@/lib/charla";
import { Kicker, SERIF } from "@/components/charla/CharlaUI";
import { LAMINA_H, LAMINA_W } from "@/components/charla/Lamina";

// Pantallas «lo que dijo la sala» (no existen en el .pptx): las respuestas de
// cada participación, en vivo, con el mismo lenguaje visual de las láminas.
// Solo conteos: los textos escritos y el «Otros» nunca salen en pantalla.

type Tone = {
  bg: string;
  kicker: string;
  title: string;
  text: string;
  soft: string;
  track: string;
  bar: string;
};
const CLARO: Tone = {
  bg: C.cream,
  kicker: C.slate,
  title: C.navy,
  text: C.navy,
  soft: C.slate,
  track: "rgba(34,60,93,0.12)",
  bar: C.navy,
};
const HIELO: Tone = { ...CLARO, bg: C.ice, track: "rgba(34,60,93,0.16)" };
const OSCURO: Tone = {
  bg: C.navy,
  kicker: C.ice,
  title: C.cream,
  text: C.cream,
  soft: C.ice,
  track: "rgba(255,255,255,0.14)",
  bar: C.ice,
};

const people = (n: number) => (n === 1 ? "1 persona" : `${n} personas`);
const answers = (n: number) => (n === 1 ? "1 respuesta" : `${n} respuestas`);

function Bars({
  q,
  t,
  tone,
  fs,
  mark,
}: {
  q: Question;
  t: Tally;
  tone: Tone;
  fs: number;
  mark?: { id: string; text: string }; // etiqueta junto a una opción (la vara)
}) {
  const best = t.top ? (t.counts[t.top] ?? 0) : 0;
  return (
    <ul style={{ display: "flex", flexDirection: "column", gap: Math.round(fs * 0.6), margin: 0, padding: 0, listStyle: "none" }}>
      {/* Si hay empate en el primer lugar, se resaltan todas las que empatan. */}
      {q.options.map((o) => {
        const n = t.counts[o.id] ?? 0;
        const p = pct(n, t.respondents);
        const lead = n > 0 && n === best;
        return (
          <li key={o.id}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 16, fontSize: fs, lineHeight: 1.22, color: tone.text }}>
              <span style={{ minWidth: 0, flex: 1, fontWeight: lead ? 700 : 500 }}>
                {o.label}
                {mark?.id === o.id && (
                  <span
                    style={{
                      marginLeft: 16,
                      padding: "2px 14px",
                      borderRadius: 999,
                      background: C.orange,
                      color: C.white,
                      fontSize: Math.round(fs * 0.62),
                      fontWeight: 800,
                      whiteSpace: "nowrap",
                      verticalAlign: "middle",
                    }}
                  >
                    {mark.text}
                  </span>
                )}
              </span>
              <span style={{ flexShrink: 0, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
                {p}%
                <span style={{ marginLeft: 8, fontSize: Math.round(fs * 0.68), fontWeight: 500, color: tone.soft }}>
                  ({n})
                </span>
              </span>
            </div>
            <div
              style={{
                marginTop: Math.round(fs * 0.22),
                height: Math.max(8, Math.round(fs * 0.4)),
                borderRadius: 999,
                background: tone.track,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${p}%`,
                  height: "100%",
                  borderRadius: 999,
                  background: lead ? C.orange : tone.bar,
                  transition: "width 700ms ease-out",
                }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function PanelTitle({ q, tone, t, fs = 30, exact }: { q: Question; tone: Tone; t: Tally; fs?: number; exact?: boolean }) {
  const hint =
    q.mode === "multi" ? (q.max ? ` · hasta ${q.max}` : " · podían elegir varias") : "";
  return (
    <div style={{ marginBottom: Math.round(fs * 0.75) }}>
      <p style={{ margin: 0, fontSize: fs, lineHeight: 1.2, fontWeight: 800, color: tone.text }}>
        {exact ? q.prompt : q.short}
      </p>
      <p style={{ margin: "4px 0 0", fontSize: Math.round(fs * 0.72), color: tone.soft }}>
        {answers(t.respondents)}
        {hint}
      </p>
    </div>
  );
}

// Encabezado común: rótulo y título de la lámina de participación. Con `qr`,
// a la derecha va el código chico para quien todavía no entró.
function Frame({
  tone,
  kicker,
  title,
  total,
  qr = true,
  children,
}: {
  tone: Tone;
  kicker: string;
  title: string;
  total: number;
  qr?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        position: "relative",
        width: LAMINA_W,
        height: LAMINA_H,
        overflow: "hidden",
        background: tone.bg,
        padding: "80px 128px 48px",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 56 }}>
        <div style={{ minWidth: 0 }}>
          <Kicker style={{ margin: 0, fontSize: 26, color: tone.kicker }}>{kicker}</Kicker>
          <h1 style={{ ...SERIF, margin: "16px 0 0", fontSize: 56, lineHeight: 1.12, color: tone.title }}>
            {title}
          </h1>
        </div>
        {qr && (
          <div style={{ display: "flex", flexShrink: 0, alignItems: "center", gap: 20 }}>
            <div style={{ textAlign: "right", color: tone.soft }}>
              <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: tone.text }}>Responda desde su celular</p>
              <p style={{ margin: "4px 0 0", fontSize: 20 }}>{CHARLA_SHORT_URL}</p>
              <p style={{ margin: "8px 0 0", fontSize: 20 }}>{people(total)} en la sala</p>
            </div>
            <div style={{ borderRadius: 18, background: C.white, padding: 10 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={QR.entrar} alt="" width={128} height={128} style={{ display: "block", width: 128, height: 128 }} />
            </div>
          </div>
        )}
      </div>
      <div style={{ minHeight: 0, flex: 1, marginTop: 44 }}>{children}</div>
    </div>
  );
}

// --- Participación 1: preparación (1–5), rol y sector ---
function Momento1({ res }: { res: CharlaResults }) {
  const tone = CLARO;
  const prep = QUESTIONS.PREP;
  const tp = tallyOf(res, prep);
  const rol = tallyOf(res, QUESTIONS.ROL);
  const sector = tallyOf(res, QUESTIONS.SECTOR);
  const COL_H = 230;
  // La columna más alta llena el alto: así la forma se lee aunque nadie pase del 40%.
  const maxP = Math.max(1, ...prep.options.map((o) => pct(tp.counts[o.id] ?? 0, tp.respondents)));
  const bestPrep = tp.top ? (tp.counts[tp.top] ?? 0) : 0;
  return (
    <Frame
      tone={tone}
      kicker={`${MOMENTS[1].kicker} · lo que dijo la sala`}
      title="¿Cómo llegan los recién graduados a las organizaciones?"
      total={res.people}
    >
      <div style={{ display: "flex", height: "100%", gap: 56 }}>
        <div style={{ width: 520, flexShrink: 0 }}>
          <p style={{ margin: 0, fontSize: 30, fontWeight: 800, lineHeight: 1.2, color: tone.text }}>{prep.short}</p>
          <p style={{ margin: "4px 0 0", fontSize: 22, color: tone.soft }}>
            {answers(tp.respondents)} · promedio del 1 al 5
          </p>
          <p style={{ ...SERIF, margin: "6px 0 0", fontSize: 190, lineHeight: 1, color: C.orange }}>
            {formatMean(tp.mean)}
            <span style={{ marginLeft: 18, fontSize: 60, color: tone.text }}>de 5</span>
          </p>
          <div style={{ marginTop: 18, display: "flex", alignItems: "flex-end", gap: 18, height: COL_H + 44 }}>
            {prep.options.map((o) => {
              const n = tp.counts[o.id] ?? 0;
              const p = pct(n, tp.respondents);
              const lead = n > 0 && n === bestPrep;
              return (
                <div key={o.id} style={{ flex: 1, textAlign: "center" }}>
                  <p style={{ margin: "0 0 6px", fontSize: 26, fontWeight: 800, color: tone.text }}>{p}%</p>
                  <div
                    style={{
                      height: Math.max(6, Math.round((COL_H * p) / maxP)),
                      borderRadius: "12px 12px 0 0",
                      background: lead ? C.orange : tone.bar,
                      transition: "height 700ms ease-out",
                    }}
                  />
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 18, borderTop: `3px solid ${tone.text}`, paddingTop: 8 }}>
            {prep.options.map((o) => (
              <p key={o.id} style={{ flex: 1, margin: 0, textAlign: "center", fontSize: 30, fontWeight: 800, color: tone.text }}>
                {o.label}
              </p>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 22, color: tone.soft }}>
            <span>{prep.minLabel}</span>
            <span>{prep.maxLabel}</span>
          </div>
        </div>
        <div style={{ minWidth: 0, flex: 1.1 }}>
          <PanelTitle q={QUESTIONS.ROL} tone={tone} t={rol} />
          <Bars q={QUESTIONS.ROL} t={rol} tone={tone} fs={30} />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <PanelTitle q={QUESTIONS.SECTOR} tone={tone} t={sector} />
          <Bars q={QUESTIONS.SECTOR} t={sector} tone={tone} fs={24} />
        </div>
      </div>
    </Frame>
  );
}

// --- Participación 2: su vara frente al 1 : 10 de Burning Glass Institute ---
function Momento2({ res }: { res: CharlaResults }) {
  const tone = HIELO;
  const pas = tallyOf(res, QUESTIONS.PASANTIAS);
  const bar = tallyOf(res, QUESTIONS.BARRERAS);
  return (
    <Frame
      tone={tone}
      kicker={`${MOMENTS[2].kicker} · su vara`}
      title="Por cada 10 contrataciones de primer empleo, ¿cuántas pasantías ofrecen?"
      total={res.people}
    >
      <div style={{ display: "flex", height: "100%", gap: 88 }}>
        <div style={{ width: 780, flexShrink: 0 }}>
          <p style={{ margin: "0 0 30px", fontSize: 24, fontWeight: 700, color: tone.soft }}>
            {answers(pas.respondents)}
          </p>
          <Bars q={QUESTIONS.PASANTIAS} t={pas} tone={tone} fs={50} mark={{ id: "1", text: "La vara: 1 : 10" }} />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <PanelTitle q={QUESTIONS.BARRERAS} tone={tone} t={bar} fs={34} exact />
          <Bars q={QUESTIONS.BARRERAS} t={bar} tone={tone} fs={33} />
        </div>
      </div>
    </Frame>
  );
}

// --- Participación 3: capacidades, información y co-experimentos ---
function Momento3({ res }: { res: CharlaResults }) {
  const tone = OSCURO;
  const cols: Question[] = [QUESTIONS.CAPACIDADES, QUESTIONS.INFO, QUESTIONS.COEXP];
  const written: Question[] = [QUESTIONS.POSICIONES, QUESTIONS.FRASE];
  return (
    <Frame
      tone={tone}
      kicker={`${MOMENTS[3].kicker} · la voz que faltó`}
      title="Las 4 preguntas que el laboratorio dejó pendientes con empleadores"
      total={res.people}
      qr={false}
    >
      <div style={{ display: "flex", height: "100%", flexDirection: "column" }}>
        <div style={{ display: "flex", minHeight: 0, flex: 1, gap: 56 }}>
          {cols.map((q) => {
            const t = tallyOf(res, q);
            return (
              <div key={q.id} style={{ minWidth: 0, flex: 1 }}>
                <PanelTitle q={q} tone={tone} t={t} fs={28} />
                <Bars q={q} t={t} tone={tone} fs={26} />
              </div>
            );
          })}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 56,
            borderTop: "2px solid rgba(220,228,255,0.25)",
            paddingTop: 18,
          }}
        >
          {written.map((q) => (
            <div key={q.id} style={{ display: "flex", flex: 1, alignItems: "center", gap: 18 }}>
              <span style={{ ...SERIF, fontSize: 72, lineHeight: 1, color: C.orange }}>{res.answered[q.id] ?? 0}</span>
              <span style={{ fontSize: 22, lineHeight: 1.25, color: tone.soft }}>
                <strong style={{ color: tone.text }}>{q.short}</strong>
                <br />
                {(res.answered[q.id] ?? 0) === 1 ? "respuesta escrita" : "respuestas escritas"} desde el celular
              </span>
            </div>
          ))}
          <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "flex-end", gap: 18 }}>
            <span style={{ textAlign: "right", fontSize: 20, lineHeight: 1.3, color: tone.soft }}>
              <strong style={{ fontSize: 22, color: tone.text }}>Responda desde su celular</strong>
              <br />
              {CHARLA_SHORT_URL} · <span style={{ whiteSpace: "nowrap" }}>{people(res.people)} en la sala</span>
            </span>
            <div style={{ borderRadius: 14, background: C.white, padding: 8 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={QR.entrar} alt="" width={84} height={84} style={{ display: "block", width: 84, height: 84 }} />
            </div>
          </div>
        </div>
      </div>
    </Frame>
  );
}

export function TvResultados({ moment, res }: { moment: MomentId; res: CharlaResults }) {
  if (moment === 1) return <Momento1 res={res} />;
  if (moment === 2) return <Momento2 res={res} />;
  return <Momento3 res={res} />;
}
