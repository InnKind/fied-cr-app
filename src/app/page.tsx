"use client";

import { useEffect, useState } from "react";
import { ROLES, getPhase, normalizePhaseId } from "@/config/event";
import {
  getParticipant,
  clearParticipant,
  type LocalParticipant,
} from "@/lib/participant";
import { supabase } from "@/lib/supabase";
import { onForeground } from "@/lib/realtime";
import { useEventState } from "@/hooks/useEventState";
import Register from "@/components/Register";
import Waiting from "@/components/Waiting";
import ThemeSelection from "@/components/ThemeSelection";
import TableAssigned from "@/components/TableAssigned";
import Round1Prototyping from "@/components/Round1Prototyping";
import Round2 from "@/components/Round2";
import Closing from "@/components/Closing";

export default function Home() {
  const [participant, setParticipant] = useState<LocalParticipant | null>(null);
  const [identityLoaded, setIdentityLoaded] = useState(false);
  const eventState = useEventState();

  // Cargar identidad anónima del navegador (solo en el cliente) y VERIFICAR que
  // ese participante todavía exista en la base. Si el id guardado quedó huérfano
  // (p. ej. se reseteó la base entre pruebas), se limpia y la persona vuelve a
  // registrarse — así no queda con un id que no está en la BD (que hacía que el
  // admin no la contara ni le asignara mesa).
  useEffect(() => {
    let active = true;
    const verify = async () => {
      const local = getParticipant();
      if (!local) {
        if (active) {
          setParticipant(null);
          setIdentityLoaded(true);
        }
        return;
      }
      const { data, error } = await supabase
        .from("participants")
        .select("id")
        .eq("id", local.id)
        .maybeSingle();
      if (!active) return;
      // Solo limpiar si la consulta funcionó Y el participante NO existe. Ante un
      // error de red no arriesgamos a "desloguear" a alguien válido.
      if (!error && !data) {
        clearParticipant();
        setParticipant(null);
      } else {
        setParticipant(local);
      }
      setIdentityLoaded(true);
    };
    verify();
    // Y CADA VEZ que la app vuelve al primer plano: si la base se reseteó
    // mientras el celular estaba en el bolsillo, el id guardado quedó huérfano
    // y sin esto la persona seguiría "adentro" pero sin que se guarde nada.
    const stop = onForeground(verify);
    return () => {
      active = false;
      stop();
    };
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
    return (
      <TableAssigned
        participantId={participant.id}
        role={participant.role}
        accent={roleColor}
      />
    );
  }

  // PROTOTIPADO RONDA 1 (a ritmo por mesa/persona): mientras la fase global sea
  // la ventana de prototipado, cada quien avanza por su cuenta — actividad en la
  // mesa → elegir momento (cuando el facilitador guarda) → escribir ideas
  // (cuando elige). Se enrutan también los ids viejos MOMENT_SELECTION/IDEA_ENTRY
  // por si event_state trae un valor previo.
  if (
    phaseId === "ROUND1_PHYSICAL_ACTIVITY" ||
    phaseId === "MOMENT_SELECTION" ||
    phaseId === "IDEA_ENTRY"
  ) {
    return (
      <Round1Prototyping participantId={participant.id} accent={roleColor} />
    );
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
