"use client";

import { useEffect, useState } from "react";
import { ROLES, getPhase, normalizePhaseId } from "@/config/event";
import { getParticipant, type LocalParticipant } from "@/lib/participant";
import { useEventState } from "@/hooks/useEventState";
import Register from "@/components/Register";
import Waiting from "@/components/Waiting";
import Results from "@/components/Results";
import ThemeSelection from "@/components/ThemeSelection";

export default function Home() {
  const [participant, setParticipant] = useState<LocalParticipant | null>(null);
  const [identityLoaded, setIdentityLoaded] = useState(false);
  const eventState = useEventState();

  // Cargar identidad anónima del navegador (solo en el cliente).
  useEffect(() => {
    setParticipant(getParticipant());
    setIdentityLoaded(true);
  }, []);

  if (!identityLoaded || !eventState) {
    return <Waiting title="Cargando…" message="Un momento." />;
  }

  // Sin identidad todavía: registro (rol + mesa). La elección de tema llega
  // después, en la fase THEME_SELECTION.
  if (!participant) {
    return <Register onRegistered={() => setParticipant(getParticipant())} />;
  }

  const roleColor = ROLES.find((r) => r.id === participant.role)?.color;
  const phaseId = normalizePhaseId(eventState.phase);

  // --- Pantallas reales por fase ---
  // THEME_SELECTION: elegir 1 de los 3 temas.
  if (phaseId === "THEME_SELECTION") {
    return (
      <ThemeSelection
        participantId={participant.id}
        role={participant.role}
        accent={roleColor}
      />
    );
  }

  // RESULTS: presentación de la síntesis.
  if (phaseId === "RESULTS") {
    return (
      <main className="flex-1 flex items-start justify-center p-6 bg-slate-50">
        <Results round={eventState.current_round || 1} />
      </main>
    );
  }

  // Resto de fases: pantalla de espera con el texto de la fase (placeholders
  // que se irán reemplazando por la pantalla real en los próximos pasos).
  const phase = getPhase(phaseId);
  return (
    <Waiting
      accent={roleColor}
      title={phase?.waitTitle ?? "Espera un momento"}
      message={phase?.waitMessage ?? "El facilitador te indicará el siguiente paso."}
    />
  );
}
