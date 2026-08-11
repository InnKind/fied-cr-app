"use client";

import { useEffect, useState } from "react";
import { ROLES, getPhase, normalizePhaseId } from "@/config/event";
import { getParticipant, type LocalParticipant } from "@/lib/participant";
import { useEventState } from "@/hooks/useEventState";
import Register from "@/components/Register";
import Waiting from "@/components/Waiting";
import ThemeSelection from "@/components/ThemeSelection";
import TableAssigned from "@/components/TableAssigned";
import MomentSelection from "@/components/MomentSelection";
import IdeaEntry from "@/components/IdeaEntry";
import Round2 from "@/components/Round2";
import Closing from "@/components/Closing";

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

  // TABLE_ASSIGNED: la persona ve su mesa asignada (con opción de corregirla).
  if (phaseId === "TABLE_ASSIGNED") {
    return <TableAssigned participantId={participant.id} accent={roleColor} />;
  }

  // MOMENT_SELECTION: elegir 1 de los 3 momentos que registró el facilitador.
  if (phaseId === "MOMENT_SELECTION") {
    return <MomentSelection participantId={participant.id} accent={roleColor} />;
  }

  // IDEA_ENTRY: escribir ideas (IA + Agency) para el momento elegido.
  if (phaseId === "IDEA_ENTRY") {
    return <IdeaEntry participantId={participant.id} accent={roleColor} />;
  }

  // ROUND2: reflexión final (tema + 3 roles + experiencia). La mesa no importa.
  if (phaseId === "ROUND2") {
    return <Round2 participantId={participant.id} accent={roleColor} />;
  }

  // ROUND1_COMPLETE: coffee break — invita a explorar con Atenea mientras procesa la IA.
  if (phaseId === "ROUND1_COMPLETE") {
    return (
      <Closing
        accent={roleColor}
        title="¡Terminaste la Ronda 1!"
        message="Toma tu café. Ya volvemos con los resultados. Mientras tanto, puedes seguir explorando."
        showAtenea
      />
    );
  }

  // FINISHED: cierre + acceso al archivo post-evento.
  if (phaseId === "FINISHED") {
    return (
      <Closing
        accent={roleColor}
        title="¡Gracias por participar!"
        message="El ejercicio terminó. Puedes consultar lo que trabajó tu mesa cuando quieras."
        showArchive
        showAtenea
      />
    );
  }

  // RESULTS: los resultados se proyectan en la pantalla principal (/presentation).
  if (phaseId === "RESULTS") {
    return (
      <Waiting
        accent={roleColor}
        title="Mira la pantalla principal"
        message="Los resultados de la Ronda 1 se están presentando. ¡Míralos con tu grupo!"
      />
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
