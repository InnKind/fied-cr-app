"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { onForeground } from "@/lib/realtime";
import {
  EVENT,
  THEMES,
  isPlaceholder,
  numberedThemeTitle,
  ACTIVITY_STEPS,
  ACTIVITY_STEPS_TITLE,
  ACTIVITY_THINK_HINT,
  ACTIVITY_FACILITATOR_HINT,
  MOMENT_STEPS,
  MOMENT_STEPS_TITLE,
} from "@/config/event";
import { BRAND_BG } from "@/lib/brand";
import BrandLogo from "@/components/BrandLogo";

type Moment = { id: string; ord: number; text: string };

// Fase MOMENT_SELECTION: la persona elige 1 de los 3 momentos que registró el
// facilitador de su mesa. Espera (en vivo) a que aparezcan si aún no están.
// `guided` (true desde el flujo real) activa las pantallas de instrucciones
// (Cambio #2): pasos → "Empezar" → tema+preguntas mientras espera; y otra
// pantalla de pasos antes de elegir el momento. En "Cambiar momento" va false.
export default function MomentSelection({
  participantId,
  accent,
  onSelected,
  guided = false,
}: {
  participantId: string;
  accent?: string;
  onSelected?: () => void;
  guided?: boolean;
}) {
  // Instrucciones (Cambio #2): "Empezar" (pantalla de pasos -> tema+preguntas)
  // y "Continuar" (pantalla de pasos antes del selector de momento).
  const [activityStarted, setActivityStarted] = useState(false);
  const [readyToPick, setReadyToPick] = useState(false);
  const [tableNumber, setTableNumber] = useState<number | null>(null);
  const [theme, setTheme] = useState<string | null>(null);
  const [moments, setMoments] = useState<Moment[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Entrada/corrección manual de mesa (rescate si quedó sin mesa o con la mesa
  // equivocada).
  const [editing, setEditing] = useState(false);
  const [manualInput, setManualInput] = useState("");
  const [savingTable, setSavingTable] = useState(false);
  const [tableErr, setTableErr] = useState<string | null>(null);

  // Mesa actual del participante + su selección previa (resiliente a recargar).
  // En vivo: si el admin (re)distribuye mesas, current_table cambia y esta
  // pantalla se actualiza sola, sin que la persona tenga que recargar.
  const loadParticipant = useCallback(async () => {
    const { data: p } = await supabase
      .from("participants")
      .select("current_table, selected_theme")
      .eq("id", participantId)
      .single();
    setTableNumber((p?.current_table as number | null) ?? null);
    setTheme((p?.selected_theme as string | null) ?? null);
    const { data: sel } = await supabase
      .from("moment_selections")
      .select("moment_id")
      .eq("participant_id", participantId)
      .maybeSingle();
    setSelected((sel?.moment_id as string | null) ?? null);
    setLoaded(true);
  }, [participantId]);

  useEffect(() => {
    loadParticipant();
    const channel = supabase
      .channel(`rt-participant-${participantId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "participants",
          filter: `id=eq.${participantId}`,
        },
        () => loadParticipant()
      )
      .subscribe((status) => {
        // Refetch al (re)suscribir: cubre una asignación de mesa que ocurra
        // justo en la ventana de suscripción (consistente con el canal de momentos).
        if (status === "SUBSCRIBED") loadParticipant();
      });
    const stop = onForeground(loadParticipant);
    return () => {
      supabase.removeChannel(channel);
      stop();
    };
  }, [participantId, loadParticipant]);

  // Momentos de la mesa (aparecen en vivo cuando el facilitador los registra).
  const loadMoments = useCallback(async (ct: number) => {
    const { data } = await supabase
      .from("selected_moments")
      .select("id, ord, text")
      .eq("table_number", ct)
      .order("ord");
    setMoments((data as Moment[]) ?? []);
  }, []);

  useEffect(() => {
    if (tableNumber == null) return;
    setMoments(null); // al cambiar de mesa, no mostrar los momentos de la anterior
    loadMoments(tableNumber);
    const channel = supabase
      .channel(`rt-moments-${tableNumber}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "selected_moments",
          filter: `table_number=eq.${tableNumber}`,
        },
        () => loadMoments(tableNumber)
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") loadMoments(tableNumber);
      });
    const stopForeground = onForeground(() => loadMoments(tableNumber));
    return () => {
      supabase.removeChannel(channel);
      stopForeground();
    };
  }, [tableNumber, loadMoments]);

  async function pick(momentId: string) {
    setSaving(true);
    setError(null);
    const { error: dbErr } = await supabase
      .from("moment_selections")
      .upsert(
        { participant_id: participantId, moment_id: momentId },
        { onConflict: "participant_id" }
      );
    setSaving(false);
    if (dbErr) {
      setError("No se pudo guardar. Intenta de nuevo.");
      return;
    }
    setSelected(momentId);
    onSelected?.();
  }

  async function saveTable() {
    const n = parseInt(manualInput, 10);
    if (!manualInput || Number.isNaN(n) || n < 1 || n > EVENT.numberOfTables) {
      setTableErr(`Ingresa un número de mesa (1 a ${EVENT.numberOfTables}).`);
      return;
    }
    setSavingTable(true);
    setTableErr(null);
    const { error: dbErr } = await supabase
      .from("participants")
      .update({ current_table: n })
      .eq("id", participantId);
    setSavingTable(false);
    if (dbErr) {
      setTableErr("No se pudo actualizar. Intenta de nuevo.");
      return;
    }
    setEditing(false);
    setManualInput("");
    setTableNumber(n); // el efecto de momentos recargará los de la mesa nueva
  }

  if (!loaded) {
    return (
      <main
        className="flex-1 flex items-center justify-center p-6"
        style={{ background: BRAND_BG }}
      >
        <p className="text-white/80">Cargando…</p>
      </main>
    );
  }

  // Corrección/ingreso manual de mesa — alcanzable desde cualquier estado
  // (sin mesa, o con la mesa equivocada). Va ANTES del gate de tableNumber.
  if (editing) {
    return (
      <main
        className="flex-1 flex items-center justify-center p-6"
        style={{ background: BRAND_BG }}
      >
        <div className="w-full max-w-sm text-center">
          <BrandLogo className="mx-auto mb-6" />
          <h1 className="text-xl font-semibold text-white">
            ¿En qué mesa estás?
          </h1>
          <div className="mt-4 rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-black/5">
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={EVENT.numberOfTables}
              value={manualInput}
              onChange={(e) => {
                setManualInput(e.target.value);
                setTableErr(null);
              }}
              placeholder="Ej: 7"
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-center text-lg text-slate-900 shadow-sm focus:border-[#0c7d75] focus:outline-none focus:ring-2 focus:ring-[#0c7d75]/30"
            />
            {tableErr && (
              <p className="mt-3 text-sm font-medium text-red-600">{tableErr}</p>
            )}
            <button
              onClick={saveTable}
              disabled={savingTable}
              className="mt-4 w-full rounded-lg bg-[#c8103e] px-4 py-3 font-semibold text-white shadow-sm transition hover:bg-[#a50d33] active:bg-[#8a0b2b] disabled:opacity-60"
            >
              {savingTable ? "Guardando…" : "Guardar mi mesa"}
            </button>
          </div>
          <button
            onClick={() => {
              setEditing(false);
              setTableErr(null);
            }}
            className="mt-3 text-sm font-medium text-white/70 hover:text-white"
          >
            Cancelar
          </button>
        </div>
      </main>
    );
  }

  // Sin mesa asignada aún: permitir ingresarla a mano (rescate para rezagados).
  if (tableNumber == null) {
    return (
      <main
        className="flex-1 flex items-center justify-center p-6"
        style={{ background: BRAND_BG }}
      >
        <div className="w-full max-w-sm text-center">
          <BrandLogo className="mx-auto mb-6" />
          {accent && (
            <span
              className="mb-4 inline-block h-3 w-3 rounded-full"
              style={{ backgroundColor: accent }}
            />
          )}
          <h1 className="text-xl font-semibold text-white">
            Aún no tienes mesa
          </h1>
          <p className="mt-3 text-white/80">
            No apareces en ninguna mesa. Acércate a un organizador para que te
            ubique en la mesa de tu tema. Cuando sepas tu número de mesa,
            ingrésalo aquí.
          </p>
          <button
            onClick={() => setEditing(true)}
            className="mt-6 rounded-lg bg-[#c8103e] px-4 py-3 font-semibold text-white shadow-sm transition hover:bg-[#a50d33] active:bg-[#8a0b2b]"
          >
            Ingresar mi mesa
          </button>
        </div>
      </main>
    );
  }

  // Con mesa, pero los momentos aún cargando.
  if (moments === null) {
    return (
      <main
        className="flex-1 flex items-center justify-center p-6"
        style={{ background: BRAND_BG }}
      >
        <p className="text-white/80">Cargando…</p>
      </main>
    );
  }

  // Botón de rescate ("No es mi mesa"), reutilizado en varias pantallas.
  const rescueLink = (
    <button
      onClick={() => {
        setManualInput(String(tableNumber));
        setEditing(true);
      }}
      className="mt-8 text-sm font-medium text-white/60 underline underline-offset-2 hover:text-white"
    >
      Cambiar de mesa.
    </button>
  );

  // PANTALLA A (Cambio #2): al llegar a la mesa, los pasos del proceso + "Empezar".
  // Solo en el flujo guiado y mientras aún no hay momentos y no tocó "Empezar".
  if (moments.length === 0 && guided && !activityStarted) {
    return (
      <main
        className="flex-1 flex items-center justify-center p-6"
        style={{ background: BRAND_BG }}
      >
        <div className="w-full max-w-md text-center">
          <BrandLogo className="mx-auto mb-6" />
          {accent && (
            <span
              className="mb-4 inline-block h-3 w-3 rounded-full"
              style={{ backgroundColor: accent }}
            />
          )}
          <h1 className="text-xl font-semibold text-white">Actividad en tu mesa</h1>
          {ACTIVITY_STEPS.length > 0 && (
            <div className="mt-5 rounded-2xl bg-white p-5 text-left shadow-sm">
              <p className="text-sm font-semibold text-[#0c7d75]">
                {ACTIVITY_STEPS_TITLE}
              </p>
              <ol className="mt-3 space-y-2.5">
                {ACTIVITY_STEPS.map((step, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0c7d75]/10 text-sm font-bold text-[#0c7d75]">
                      {i + 1}
                    </span>
                    <span className="text-slate-700">
                      <b className="font-semibold text-slate-900">
                        {step.label}:
                      </b>{" "}
                      {step.text}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}
          <button
            onClick={() => setActivityStarted(true)}
            className="mt-6 w-full rounded-lg bg-[#c8103e] px-4 py-3 font-semibold text-white shadow-sm transition hover:bg-[#a50d33] active:bg-[#8a0b2b]"
          >
            Empezar
          </button>
          {rescueLink}
        </div>
      </main>
    );
  }

  // PANTALLA B (Cambio #2): tu tema + preguntas de apoyo + la pregunta clave para
  // definir tus "momentos", mientras el facilitador guía el post-it. En cuanto
  // guarda los momentos, esta pantalla cambia sola (en vivo).
  if (moments.length === 0) {
    const t = THEMES.find((x) => x.id === theme);
    const showProvocation = t && !isPlaceholder(t.provocation);
    const examples = (t?.examples ?? []).filter((q) => !isPlaceholder(q));
    const showExamplesIntro = t && !isPlaceholder(t.examplesIntro);
    const showMomentsQ = t && !isPlaceholder(t.momentsQuestion);
    return (
      <main
        className="flex-1 flex items-center justify-center p-6"
        style={{ background: BRAND_BG }}
      >
        <div className="w-full max-w-md">
          <BrandLogo className="mb-6" />
          {accent && (
            <span
              className="mb-4 inline-block h-3 w-3 rounded-full"
              style={{ backgroundColor: accent }}
            />
          )}
          {t && (
            <p className="text-xs font-semibold uppercase tracking-wider text-teal-200">
              {numberedThemeTitle(t.id)}
            </p>
          )}
          {showProvocation && (
            <p className="mt-1 text-white/80">{t!.provocation}</p>
          )}

          {(examples.length > 0 || showMomentsQ) && (
            <div className="mt-4 rounded-2xl bg-white p-5 text-left shadow-sm">
              {examples.length > 0 && (
                <>
                  {showExamplesIntro && (
                    <p className="text-sm text-slate-600">{t!.examplesIntro}</p>
                  )}
                  <ul className="mt-2 list-disc space-y-1.5 pl-5 text-slate-700">
                    {examples.map((q, i) => (
                      <li key={i}>{q}</li>
                    ))}
                  </ul>
                </>
              )}
              {showMomentsQ && (
                <div
                  className={
                    examples.length > 0
                      ? "mt-4 border-t border-slate-100 pt-4"
                      : ""
                  }
                >
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#c8103e]">
                    La pregunta clave
                  </p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {t!.momentsQuestion}
                  </p>
                </div>
              )}
            </div>
          )}

          <p className="mt-4 text-white/85">{ACTIVITY_THINK_HINT}</p>

          <div className="mt-6 flex items-center justify-center gap-2 text-sm text-white/70">
            <span className="flex gap-1.5">
              <span className="h-2 w-2 rounded-full bg-teal-300 animate-bounce [animation-delay:-0.2s]" />
              <span className="h-2 w-2 rounded-full bg-teal-300 animate-bounce [animation-delay:-0.1s]" />
              <span className="h-2 w-2 rounded-full bg-teal-300 animate-bounce" />
            </span>
            <span>{ACTIVITY_FACILITATOR_HINT}</span>
          </div>
          <div className="text-center">{rescueLink}</div>
        </div>
      </main>
    );
  }

  // PANTALLA C (Cambio #2): ya hay momentos guardados; antes de elegir, los pasos
  // de la siguiente etapa (elegir, pensar, enviar ideas, conversar, presentar).
  if (guided && !readyToPick) {
    return (
      <main
        className="flex-1 flex items-center justify-center p-6"
        style={{ background: BRAND_BG }}
      >
        <div className="w-full max-w-md text-center">
          <BrandLogo className="mx-auto mb-6" />
          {accent && (
            <span
              className="mb-4 inline-block h-3 w-3 rounded-full"
              style={{ backgroundColor: accent }}
            />
          )}
          <h1 className="text-xl font-semibold text-white">¡Ya están los momentos!</h1>
          {MOMENT_STEPS.length > 0 && (
            <div className="mt-5 rounded-2xl bg-white p-5 text-left shadow-sm">
              <p className="text-sm font-semibold text-[#0c7d75]">
                {MOMENT_STEPS_TITLE}
              </p>
              <ol className="mt-3 space-y-2.5">
                {MOMENT_STEPS.map((step, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0c7d75]/10 text-sm font-bold text-[#0c7d75]">
                      {i + 1}
                    </span>
                    <span className="text-slate-700">
                      <b className="font-semibold text-slate-900">
                        {step.label}:
                      </b>{" "}
                      {step.text}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}
          <button
            onClick={() => setReadyToPick(true)}
            className="mt-6 w-full rounded-lg bg-[#c8103e] px-4 py-3 font-semibold text-white shadow-sm transition hover:bg-[#a50d33] active:bg-[#8a0b2b]"
          >
            Continuar
          </button>
          {rescueLink}
        </div>
      </main>
    );
  }

  // Elegir 1 de los 3 momentos.
  return (
    <main
      className="flex-1 flex items-center justify-center p-6"
      style={{ background: BRAND_BG }}
    >
      <div className="w-full max-w-md">
        <BrandLogo className="mb-6" />
        <p className="text-xs font-semibold uppercase tracking-wider text-teal-200">
          Mesa {tableNumber}
        </p>
        <h2 className="mt-1 text-2xl font-bold text-white">
          ¿Qué momento quieres trabajar?
        </h2>
        <p className="mt-2 text-sm text-white/80">
          Elige uno. Puedes cambiarlo tocando otro.
        </p>
        <div className="mt-5 space-y-3">
          {moments.map((m) => {
            const isSel = selected === m.id;
            return (
              <button
                key={m.id}
                disabled={saving}
                onClick={() => pick(m.id)}
                className={`w-full rounded-lg border p-4 text-left shadow-sm transition disabled:opacity-60 ${
                  isSel
                    ? "border-[#0c7d75] bg-[#0c7d75]/10 ring-1 ring-[#0c7d75]/40"
                    : "border-slate-300 bg-white hover:border-[#0c7d75] hover:bg-[#0c7d75]/5"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-slate-900">
                    <b className="text-slate-400">{m.ord}.</b> {m.text}
                  </span>
                  {isSel && (
                    <span className="shrink-0 text-sm font-semibold text-[#0c7d75]">
                      ✓ elegido
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
        {error && (
          <p className="mt-3 text-sm font-medium text-red-600">{error}</p>
        )}
        <button
          onClick={() => {
            setManualInput(String(tableNumber));
            setEditing(true);
          }}
          className="mt-5 text-sm font-medium text-white/60 underline underline-offset-2 hover:text-white"
        >
          Cambiar de mesa.
        </button>
      </div>
    </main>
  );
}
