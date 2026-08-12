"use client";

import { useEffect, useState } from "react";
import { FACILITATOR_GUIDE } from "@/config/event";

// Guía colapsable para el facilitador: recordatorio de los pasos de la
// actividad en la mesa. Colapsada por defecto para no recargar la pantalla.
export default function FacilitatorGuide({
  defaultOpen = false,
}: {
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  // Auto-abrir cuando corresponde (p. ej. al entrar a la actividad): el estado
  // de la fase carga async, así que el valor inicial de useState no basta. Solo
  // ABRE (nunca fuerza el cierre), para no pelear con el facilitador.
  useEffect(() => {
    if (defaultOpen) setOpen(true);
  }, [defaultOpen]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
        aria-expanded={open}
      >
        <span className="font-semibold text-slate-900">
          📋 Guía de la actividad
          <span className="ml-2 font-normal text-slate-400">
            qué hacer en cada paso
          </span>
        </span>
        <span className="shrink-0 text-slate-400">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <ol className="space-y-3 border-t border-slate-100 px-5 py-4">
          {FACILITATOR_GUIDE.map((step, i) => (
            <li key={i}>
              <p className="text-sm font-semibold text-[#0c7d75]">{step.title}</p>
              <p className="mt-0.5 text-sm text-slate-700">{step.detail}</p>
              {step.script && step.script.trim() && (
                <p className="mt-1 rounded-md bg-slate-50 px-3 py-2 text-sm italic text-slate-600">
                  “{step.script}”
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
