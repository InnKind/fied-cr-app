"use client";

import { useState, useSyncExternalStore } from "react";
import notasJson from "@/config/charla-notas.json";
import {
  END_STEP,
  MOMENTS,
  PRE_STEP,
  QUESTIONS,
  SESSION,
  STEPS,
  stepAt,
  type Step,
} from "@/config/charla";
import { safeStorage } from "@/lib/charla";
import { useCharlaResults, useCharlaStep } from "@/hooks/useCharla";
import { useDeck } from "@/hooks/useDeck";
import { BrandLogos, Kicker, SERIF } from "@/components/charla/CharlaUI";

// Control de la charla para quien presenta (celular, tableta o segunda
// pantalla): las notas de cada lámina (las del .pptx), los botones para avanzar
// y cuántas respuestas van. Pide la clave (la misma del stand) y mueve la misma
// sesión que /charla/pantalla: las dos pueden estar abiertas a la vez.

const KEY_STORAGE = "stand_key";
const NOTAS = notasJson as Record<string, string>;

// Las notas del .pptx de las láminas de participación hablan del formulario de
// Google; aquí van las indicaciones equivalentes para la app.
const CUES: Record<string, string> = {
  pre: "En la pantalla está el código para entrar. Quien lo escanee ya puede completar su perfil. Al tocar Siguiente aparece la portada.",
  p04: "Pedir que escaneen el código. En el celular: nombre, organización, cargo y correo; luego rol, sector y, del 1 al 5, qué tan preparados llegan los recién graduados que contratan. Esperar a que suba el contador y pasar a los resultados.",
  p05: "Leer el promedio y cómo se reparte del 1 al 5. Quien todavía no termina puede seguir respondiendo: la pantalla se actualiza sola.",
  p14: "No hace falta escanear de nuevo: las preguntas aparecen solas en el celular de quien ya entró. Son dos: (1) por cada 10 contrataciones de primer empleo, cuántas pasantías ofrece su organización; (2) qué les impide ofrecer más.",
  p15: "Mostrar la distribución frente a la vara 1:10. Esto le dice a InnKind dónde diseñar el próximo experimento con empleadores.",
  p17: "Esta es la participación central para SénecaLab e InnKind. En el celular: capacidades que más cuesta encontrar (hasta 3), posiciones que tardan más en cubrir, información que compartirían con las universidades, qué co-experimentarían, una frase para la educación superior y cómo les gustaría seguir.",
  p18: "Capacidades, información y co-experimentos, en vivo. Las respuestas escritas (posiciones y frases) no se muestran en pantalla: quedan en el archivo que se descarga después.",
  fin: "Fin. En la pantalla quedan los códigos para completar las respuestas y para ver los resultados. Recordar: sus respuestas alimentan InnKind Intelligence y recibirán los resultados.",
};

function notesFor(step: number, s: Step | null): string {
  if (!s) return step >= END_STEP ? CUES.fin : CUES.pre;
  if (s.kind !== "lamina") return CUES[s.id] ?? "";
  return (s.lamina && NOTAS[String(s.lamina)]) || "";
}

function labelFor(step: number): string {
  if (step <= PRE_STEP) return "Antes de empezar";
  if (step >= END_STEP) return "Fin";
  return stepAt(step)?.label ?? "";
}

const noopSubscribe = () => () => {};

export default function CharlaControl() {
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  if (!mounted) return <main className="min-h-dvh flex-1 bg-[#223c5d]" />;
  return <Control />;
}

function KeyForm() {
  const [key, setKey] = useState("");
  return (
    <form
      className="mt-8 space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!key.trim()) return;
        safeStorage.set(KEY_STORAGE, key.trim());
        window.location.reload();
      }}
    >
      <label className="block">
        <span className="mb-1.5 block text-sm font-bold">Clave</span>
        <input
          type="password"
          autoComplete="off"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          className="w-full rounded-xl border-0 bg-white px-4 py-3 text-base text-[#223c5d] outline-none ring-2 ring-transparent focus:ring-[#ff5800]"
        />
      </label>
      <button
        type="submit"
        disabled={!key.trim()}
        className="w-full rounded-xl bg-[#ff5800] px-4 py-3.5 text-lg font-bold text-white disabled:opacity-50"
      >
        Entrar al control
      </button>
      <p className="text-sm text-[#dce4ff]">
        Es la misma clave que se usa para controlar la pantalla. Se guarda solo en este navegador.
      </p>
    </form>
  );
}

function Control() {
  const remote = useCharlaStep(3000);
  const { mode, step, sync, go } = useDeck({
    endpoint: "/api/charla/step",
    session: SESSION,
    min: PRE_STEP,
    max: END_STEP,
    keyStorage: KEY_STORAGE,
    remote,
  });
  const results = useCharlaResults(true, 3000);
  const current = stepAt(step);

  const header = (
    <header className="flex items-center justify-between gap-3">
      <BrandLogos height={24} />
      <span className="text-xs font-bold uppercase tracking-widest text-[#dce4ff]">Control</span>
    </header>
  );

  if (mode.kind !== "control" || sync === "bad-key") {
    return (
      <main className="min-h-dvh flex-1 bg-[#223c5d] px-5 pb-10 pt-5 text-white">
        <div className="mx-auto max-w-md">
          {header}
          <h1 className="mt-8 text-3xl leading-tight" style={SERIF}>
            Control de la charla
          </h1>
          {sync === "bad-key" && (
            <p className="mt-4 rounded-xl bg-[#fff1f3] px-4 py-3 text-sm font-semibold text-[#9f1239]">
              La clave no es correcta. Escríbala de nuevo.
            </p>
          )}
          {mode.kind === "preview" ? (
            <p className="mt-4 text-[#dce4ff]">Quite «?paso=» de la dirección para usar el control.</p>
          ) : (
            <KeyForm />
          )}
        </div>
      </main>
    );
  }

  const problem =
    sync === "no-secret"
      ? "El servidor no tiene la clave configurada (STAND_SECRET)."
      : sync === "no-service-role"
        ? "Falta SUPABASE_SERVICE_ROLE en el servidor."
        : remote.error?.kind === "missing"
          ? "Falta correr supabase/14-charla.sql en Supabase."
          : sync === "retrying" || remote.error
            ? "Sin conexión: reintentando…"
            : null;

  const next = step < END_STEP ? labelFor(step + 1) : null;
  const moment = current?.moment;
  const notes = notesFor(step, current);

  return (
    <main className="flex min-h-dvh flex-1 flex-col bg-[#223c5d] text-white">
      <div className="mx-auto w-full max-w-2xl flex-1 px-5 pb-44 pt-5">
        {header}
        {problem && (
          <p className="mt-4 rounded-lg bg-[#fde047] px-3 py-2 text-center text-sm font-bold text-[#3a2c00]">
            {problem}
          </p>
        )}

        <Kicker className="mt-6 text-xs text-[#dce4ff]">
          {step <= PRE_STEP
            ? "Paso 0"
            : step >= END_STEP
              ? "Cierre"
              : `Paso ${step} de ${STEPS.length}${current?.lamina ? ` · lámina ${current.lamina}` : ""}`}
        </Kicker>
        <h1 className="mt-1 text-3xl leading-tight" style={SERIF}>
          {labelFor(step)}
        </h1>

        {moment && (
          <div className="mt-4 rounded-2xl bg-white/10 p-4">
            <p className="text-sm font-bold">
              {MOMENTS[moment].kicker} · {results.people} {results.people === 1 ? "persona" : "personas"} en la sala
            </p>
            <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-[#dce4ff]">
              {MOMENTS[moment].questions.map((id) => (
                <li key={id} className="flex justify-between gap-2">
                  <span className="min-w-0 truncate">{QUESTIONS[id].short}</span>
                  <span className="font-bold tabular-nums text-white">{results.answered[id] ?? 0}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-5 whitespace-pre-line text-[19px] leading-relaxed text-white">
          {notes || <span className="text-[#dce4ff]">Esta lámina no tiene notas.</span>}
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-white/10 bg-[#1a3050]/95 px-5 pb-[max(14px,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <div className="mx-auto max-w-2xl">
          <p className="mb-2 truncate text-sm text-[#dce4ff]">
            {next ? (
              <>
                Sigue: <span className="font-bold text-white">{next}</span>
              </>
            ) : (
              "Es el último paso."
            )}
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => go(-1)}
              disabled={step <= PRE_STEP}
              className="h-16 w-28 shrink-0 rounded-xl bg-white/10 text-lg font-bold text-white ring-1 ring-white/30 disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              disabled={step >= END_STEP}
              className="h-16 flex-1 rounded-xl bg-[#ff5800] text-xl font-bold text-white disabled:opacity-40"
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
