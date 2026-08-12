"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { onForeground } from "@/lib/realtime";
import { EVENT, THEMES, isPlaceholder, numberedThemeTitle } from "@/config/event";
import { BRAND_BG } from "@/lib/brand";
import BrandLogo from "@/components/BrandLogo";

type Moment = { id: string; ord: number; text: string };

// Fase MOMENT_SELECTION: la persona elige 1 de los 3 momentos que registró el
// facilitador de su mesa. Espera (en vivo) a que aparezcan si aún no están.
export default function MomentSelection({
  participantId,
  accent,
  onSelected,
}: {
  participantId: string;
  accent?: string;
  onSelected?: () => void;
}) {
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

  // El facilitador todavía no registra los momentos: actividad en la mesa. Se
  // muestra la provocación por escrito (si el equipo ya la puso) mientras el
  // facilitador guía el post-it. En cuanto guarda los momentos, aparece el
  // selector (en vivo). El botón "No es mi mesa" evita que un rezagado que
  // tecleó mal su mesa quede sin salida.
  if (moments.length === 0) {
    const t = THEMES.find((x) => x.id === theme);
    const showProvocation = t && !isPlaceholder(t.provocation);
    const showQuestion = t && !isPlaceholder(t.openingQuestion);
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

          {(showProvocation || showQuestion) && (
            <div className="mt-5 rounded-2xl bg-white/10 p-5 text-left ring-1 ring-white/15">
              {t && (
                <p className="text-xs font-semibold uppercase tracking-wider text-teal-200">
                  {numberedThemeTitle(t.id)}
                </p>
              )}
              {showProvocation && (
                <p className="mt-2 text-lg font-medium text-white">{t!.provocation}</p>
              )}
              {showQuestion && (
                <p className="mt-3 text-white/85">{t!.openingQuestion}</p>
              )}
            </div>
          )}

          <p className="mt-5 text-white/80">
            Sigue al facilitador. Cuando tu mesa tenga los momentos, aquí vas a
            elegir el tuyo.
          </p>
          <div className="mt-8 flex justify-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-teal-300 animate-bounce [animation-delay:-0.2s]" />
            <span className="h-2 w-2 rounded-full bg-teal-300 animate-bounce [animation-delay:-0.1s]" />
            <span className="h-2 w-2 rounded-full bg-teal-300 animate-bounce" />
          </div>
          <button
            onClick={() => {
              setManualInput(String(tableNumber));
              setEditing(true);
            }}
            className="mt-8 text-sm font-medium text-white/60 underline underline-offset-2 hover:text-white"
          >
            No es mi mesa
          </button>
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
          No es mi mesa
        </button>
      </div>
    </main>
  );
}
