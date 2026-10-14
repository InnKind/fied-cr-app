"use client";

import {
  CONTACT,
  END_STEP,
  MOMENTS,
  MOMENT_IDS,
  MOMENT_OPENS_AT,
  QUESTIONS,
  openMoments,
  type QuestionId,
} from "@/config/charla";
import { answerLines, isAnswered, type Mine } from "@/lib/charla";
import { Kicker, SERIF } from "@/components/charla/CharlaUI";
import { BTN_PRIMARY, BTN_SECONDARY, CheckIcon } from "@/components/charla/PhoneUI";

// Qué hizo la persona con el contacto opcional del final (null = todavía nada).
export type ContactState = "enviado" | "no" | null;

// Sin preguntas pendientes: «Listo, mire la pantalla» (o «Gracias» si la charla
// terminó), abajo lo que la persona respondió, para cambiarlo o completar lo
// que saltó, y el contacto opcional.
export default function PhoneDone({
  step,
  openStep,
  mine,
  contact,
  onEdit,
  onContact,
}: {
  step: number;
  openStep: number; // hasta dónde llegó la pantalla (momentos abiertos)
  mine: Mine;
  contact: ContactState;
  onEdit: (id: QuestionId) => void;
  onContact: () => void;
}) {
  const ended = step >= END_STEP;
  // ¿Falta que se abra algún momento?
  const more = MOMENT_IDS.some((m) => MOMENT_OPENS_AT[m] > openStep);

  return (
    <div className="space-y-8">
      <div className="rounded-2xl bg-white p-6 text-center text-[#223C5D] shadow-lg">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#FF5800] text-white">
          <CheckIcon className="h-7 w-7" />
        </div>
        {ended ? (
          <>
            <h1 className="mt-4 text-[30px] leading-tight" style={SERIF}>
              Gracias por participar
            </h1>
            <p className="mt-2 text-[16px] leading-relaxed text-[#55657A]">
              Sus respuestas quedaron guardadas, de forma anónima.
            </p>
            <a href="/charla/resultados" className={`mt-5 ${BTN_PRIMARY}`}>
              Ver lo que dijo la sala
            </a>
          </>
        ) : (
          <>
            <h1 className="mt-4 text-[34px] leading-tight" style={SERIF}>
              Listo
            </h1>
            <p className="mt-1 text-xl font-bold">Mire la pantalla</p>
            {more && (
              <p className="mt-3 text-[15px] leading-relaxed text-[#55657A]">
                Habrá más preguntas durante la charla: aparecerán aquí solas.
              </p>
            )}
          </>
        )}
      </div>

      <section>
        <h2 className="text-[24px] leading-tight text-white" style={SERIF}>
          Sus respuestas
        </h2>
        <div className="mt-3 space-y-4">
          {openMoments(openStep).map((m) => (
            <div key={m} className="rounded-2xl bg-[#F6F3EE] px-4 pb-1 pt-4 text-[#223C5D]">
              <Kicker className="text-[11px] text-[#55657A]">
                {MOMENTS[m].kicker} · {MOMENTS[m].title}
              </Kicker>
              <ul className="mt-1 divide-y divide-[#C9D2DE]">
                {MOMENTS[m].questions.map((id) => {
                  const q = QUESTIONS[id];
                  const done = isAnswered(q, mine[id]);
                  return (
                    <li key={id} className="flex items-center gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold leading-snug text-[#55657A]">{q.short}</p>
                        {done ? (
                          answerLines(q, mine[id]).map((line, i) => (
                            <p
                              key={i}
                              className={`mt-0.5 break-words text-[16px] font-bold leading-snug ${
                                q.mode === "text" ? "line-clamp-4" : ""
                              }`}
                            >
                              {line}
                            </p>
                          ))
                        ) : (
                          <p className="mt-0.5 text-[16px] italic leading-snug text-[#55657A]">
                            Sin responder
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => onEdit(id)}
                        className="min-h-12 shrink-0 rounded-lg px-3 text-sm font-bold ring-1 ring-inset ring-[#223C5D]/35 active:bg-[#ECE8E1]"
                      >
                        {done ? "Cambiar" : "Responder"}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl bg-white/10 px-4 py-4">
        {contact === "enviado" ? (
          <p className="text-[15px] leading-relaxed text-white">
            <span className="font-bold">Sus datos de contacto quedaron guardados</span>, aparte de sus
            respuestas.
          </p>
        ) : (
          <>
            <h2 className="text-[20px] leading-tight text-white" style={SERIF}>
              {CONTACT.title}
            </h2>
            <p className="mt-1.5 text-[15px] leading-relaxed text-[#DCE4FF]">{CONTACT.intro}</p>
            <button type="button" onClick={onContact} className={`mt-4 ${BTN_SECONDARY}`}>
              Dejar mis datos de contacto
            </button>
          </>
        )}
      </section>
    </div>
  );
}
