"use client";

import { useEffect, useState } from "react";
import { ROLES } from "@/config/event";
import { supabase } from "@/lib/supabase";
import { getParticipant, type LocalParticipant } from "@/lib/participant";
import { useEventState } from "@/hooks/useEventState";
import Register from "@/components/Register";
import Waiting from "@/components/Waiting";
import RoundOne from "@/components/RoundOne";
import Results from "@/components/Results";

export default function Home() {
  const [participant, setParticipant] = useState<LocalParticipant | null>(null);
  const [identityLoaded, setIdentityLoaded] = useState(false);
  const [r1Submitted, setR1Submitted] = useState<boolean | null>(null);
  const eventState = useEventState();

  // Cargar identidad anónima del navegador (solo en el cliente).
  useEffect(() => {
    setParticipant(getParticipant());
    setIdentityLoaded(true);
  }, []);

  // ¿Esta persona ya envió su respuesta de la Ronda 1?
  useEffect(() => {
    if (!participant) {
      setR1Submitted(null);
      return;
    }
    let active = true;
    supabase
      .from("responses")
      .select("id")
      .eq("participant_id", participant.id)
      .eq("round", 1)
      .limit(1)
      .then(({ data }) => {
        if (active) setR1Submitted(!!(data && data.length > 0));
      });
    return () => {
      active = false;
    };
  }, [participant]);

  if (!identityLoaded || !eventState) {
    return <Waiting title="Cargando…" message="Un momento." />;
  }

  if (!participant) {
    return <Register onRegistered={() => setParticipant(getParticipant())} />;
  }

  const roleColor = ROLES.find((r) => r.id === participant.role)?.color;

  // Ronda 0 = bienvenida: ya registrado, esperando que empiece.
  if (eventState.current_round === 0) {
    return (
      <Waiting
        accent={roleColor}
        title="¡Ya estás dentro!"
        message="Esperá un momento: la Ronda 1 arranca en breve."
      />
    );
  }

  // Ronda 1
  if (eventState.current_round === 1) {
    if (eventState.phase === "answering") {
      if (r1Submitted === null) {
        return <Waiting title="Cargando…" message="Un momento." />;
      }
      if (r1Submitted) {
        return (
          <Waiting
            accent={roleColor}
            title="¡Respuesta enviada!"
            message="Ahora conversala con tu mesa. Esperá el siguiente paso."
          />
        );
      }
      return (
        <RoundOne
          participantId={participant.id}
          onSubmitted={() => setR1Submitted(true)}
        />
      );
    }
    // fase de resultados
    return (
      <main className="flex-1 flex items-start justify-center p-6 bg-slate-50">
        <Results round={1} />
      </main>
    );
  }

  // Rondas 2 y 3: por construir.
  return (
    <Waiting
      accent={roleColor}
      title="Seguimos pronto"
      message="Esperá la próxima ronda."
    />
  );
}
