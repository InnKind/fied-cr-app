// Identidad anónima del participante, guardada en el navegador (localStorage).
// No hay login: solo un id generado por la base + el rol elegido.

export type LocalParticipant = { id: string; role: string };

const ID_KEY = "fied_participant_id";
const ROLE_KEY = "fied_role";

export function getParticipant(): LocalParticipant | null {
  if (typeof window === "undefined") return null;
  const id = localStorage.getItem(ID_KEY);
  const role = localStorage.getItem(ROLE_KEY);
  if (!id || !role) return null;
  return { id, role };
}

export function setParticipant(id: string, role: string): void {
  localStorage.setItem(ID_KEY, id);
  localStorage.setItem(ROLE_KEY, role);
}
