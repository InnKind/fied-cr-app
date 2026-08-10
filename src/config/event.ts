// Configuración del evento (config-driven). Editá acá las preguntas, temas y roles.
// Alineado con "Agenda V2". Los textos marcados POR DEFINIR se cambian en un solo lugar.

export type Role = { id: string; label: string; color: string };
export type Theme = {
  id: string;
  title: string;
  provocation: string; // la "provocación" del tema (POR DEFINIR)
  roles: string[]; // roles a los que este tema "les calza" (guía la elección)
};
export type RoundQuestion = { id: string; prompt: string };

// --- Roles / sectores (para el registro y para las preguntas por rol) ---
export const ROLES: Role[] = [
  { id: "docente", label: "Docente / Profesor", color: "#2563eb" },
  { id: "estudiante", label: "Estudiante", color: "#16a34a" },
  { id: "sector-productivo", label: "Sector productivo / Empresa", color: "#ea580c" },
  { id: "admin-universitario", label: "Administrador universitario (rector, vicerrector…)", color: "#7c3aed" },
  { id: "regulador", label: "Regulador / Aseguramiento de calidad", color: "#dc2626" },
  { id: "gobierno", label: "Gobierno", color: "#0d9488" },
];

// --- Mesas ---
export const SEATS_PER_TABLE = 8;
export const TABLES_PER_THEME = 12; // PLACEHOLDER: ajustar según el # real de mesas del salón

// --- 3 TEMAS (Agenda V2) — las provocaciones están POR DEFINIR ---
export const THEMES: Theme[] = [
  {
    id: "aula",
    title: "La experiencia en el aula",
    provocation: "POR DEFINIR (provocación del tema 1 — perspectiva del estudiante).",
    roles: ["estudiante", "docente"],
  },
  {
    id: "organizacional",
    title: "El modelo organizacional de la universidad",
    provocation: "POR DEFINIR (provocación del tema 2 — perspectiva docente/facultad).",
    roles: ["docente", "admin-universitario"],
  },
  {
    id: "regulatorio",
    title: "Calidad y regulación del sistema",
    provocation: "POR DEFINIR (provocación del tema 3 — perspectiva del regulador).",
    roles: ["regulador", "gobierno", "sector-productivo"],
  },
];

// --- Ronda 1 abierta (LEGACY: Agenda V2 la elimina; se deja por compatibilidad) ---
export const ROUND_1_QUESTION: RoundQuestion = {
  id: "r1",
  prompt:
    "¿Qué tendría que ser observable en estudiantes, docentes, instituciones y empleadores para afirmar que Costa Rica ofrece educación superior de calidad en la era de la IA?",
};

// --- Reflexión final (3 preguntas, Agenda V2) ---
export const REFLECTION_QUESTIONS: RoundQuestion[] = [
  { id: "ref-1", prompt: "¿Qué prototipo te llevas? (el arco de transformación que quieres impulsar)" },
  { id: "ref-2", prompt: "¿Quiénes son las 3 personas más importantes que necesitás involucrar para que esto pase en tu ámbito?" },
  { id: "ref-3", prompt: "En las próximas 2 semanas, ¿cómo vas a inspirar a estas personas a involucrarse?" },
];

// --- Preguntas al colectivo, una por rol (Agenda V2) — POR DEFINIR ---
export const COLLECTIVE_QUESTIONS: Record<string, string> = {
  estudiante: "POR DEFINIR (pregunta a estudiantes).",
  docente: "POR DEFINIR (pregunta a docentes).",
  "admin-universitario": "POR DEFINIR (pregunta a administradores de universidad).",
  "sector-productivo": "POR DEFINIR (pregunta al sector productivo).",
  regulador: "POR DEFINIR (pregunta a reguladores).",
};

// --- Captura de ideas (fase IDEA_ENTRY) ---
// Preguntas genéricas (sirven para cualquier tema/momento). Redacción final del
// equipo: ajustar aquí en un solo lugar.
export const IDEA_PROMPTS = {
  ai: "¿Cómo podría integrarse mejor la IA en el momento que elegiste?",
  agency:
    "¿Cómo podría la persona involucrada tener más autonomía, voz o poder de decisión en ese momento?",
};

// Enlace a Athenea (GPT externo) para seguir explorando tras enviar ideas.
export const ATHENEA_URL =
  "https://chatgpt.com/g/g-jGO4zaEiC-fied-foro-internacional-de-educacion";

// --- Ronda 2 (reflexión) — 3 preguntas. La mesa ya no importa. ---
export const ROUND2_QUESTIONS = {
  theme: "¿En cuál de los 3 temas quieres tomar acción en tu contexto real?",
  roles:
    "¿Cuáles son los 3 roles que necesitas involucrar para llevar esta iniciativa adelante? (roles, no nombres)",
  experience:
    "¿Qué experiencia podrías diseñar para inspirar a esos roles a apoyarte?",
};

export const EVENT = {
  name: "Inn.Kind · FIEd Costa Rica",
  exerciseTitle: "Ejercicio de Prototipado",
  tableSize: SEATS_PER_TABLE,
  // Solo lo usa el registro viejo (flujo en vivo). En Agenda V2 la mesa la asigna la app.
  numberOfTables: THEMES.length * TABLES_PER_THEME,
};

// --- Máquina de estados del workshop (diseño de 2 rondas, reunión 7-ago) ---
// El administrador controla en qué FASE está el evento; cada dispositivo muestra
// la pantalla que corresponde a la fase actual (`event_state.phase` guarda el id).
// Muchas pantallas todavía son placeholders (waitTitle/waitMessage) y se irán
// construyendo una por una en los próximos pasos.
export type Phase = {
  id: string; // id canónico que se guarda en event_state.phase
  round: 0 | 1 | 2; // agrupación por ronda (también se guarda en current_round)
  label: string; // etiqueta para el panel de administrador
  // Si la pantalla real todavía no existe, el participante ve este texto de espera:
  waitTitle?: string;
  waitMessage?: string;
};

export const PHASES: Phase[] = [
  { id: "WELCOME", round: 0, label: "Bienvenida", waitTitle: "¡Ya estás dentro!", waitMessage: "El ejercicio arranca en breve. Deja tu celular a mano." },
  { id: "THEME_SELECTION", round: 1, label: "1 · Elección de tema", waitTitle: "Elección de tema", waitMessage: "Pantalla en construcción." },
  { id: "WAITING_ASSIGNMENT", round: 1, label: "2 · Esperando asignación de mesa", waitTitle: "Asignando mesas…", waitMessage: "Espera un momento mientras te ubicamos en una mesa." },
  { id: "TABLE_ASSIGNED", round: 1, label: "3 · Mesa asignada", waitTitle: "Ve a tu mesa", waitMessage: "Pantalla en construcción." },
  { id: "ROUND1_PHYSICAL_ACTIVITY", round: 1, label: "4 · Actividad en mesa (post-its)", waitTitle: "Actividad en tu mesa", waitMessage: "Sigue al facilitador. Por ahora no necesitas el celular." },
  { id: "MOMENT_SELECTION", round: 1, label: "5 · Selección de momento", waitTitle: "Elige tu momento", waitMessage: "Pantalla en construcción." },
  { id: "IDEA_ENTRY", round: 1, label: "6 · Captura de ideas (IA + Agency)", waitTitle: "Escribe tus ideas", waitMessage: "Pantalla en construcción." },
  { id: "ROUND1_COMPLETE", round: 1, label: "7 · Ronda 1 completa (coffee break)", waitTitle: "¡Terminaste la Ronda 1!", waitMessage: "Toma tu café. Ya volvemos con los resultados." },
  { id: "PROCESSING", round: 1, label: "8 · Procesando con IA", waitTitle: "Procesando…", waitMessage: "La IA está resumiendo las ideas de todas las mesas." },
  { id: "RESULTS", round: 1, label: "9 · Resultados (presentación)" }, // pantalla real: Results
  { id: "ROUND2", round: 2, label: "10 · Ronda 2 (reflexión)", waitTitle: "Ronda 2", waitMessage: "Pantalla en construcción." },
  { id: "FINISHED", round: 2, label: "11 · Cierre", waitTitle: "¡Gracias por participar!", waitMessage: "El ejercicio terminó. Pronto podrás consultar los resultados." },
];

// Alias de las fases viejas por si event_state todavía trae un valor legacy.
const LEGACY_PHASE_ALIAS: Record<string, string> = {
  welcome: "WELCOME",
  answering: "ROUND1_PHYSICAL_ACTIVITY",
  results: "RESULTS",
};

export function normalizePhaseId(phase: string | null | undefined): string {
  if (!phase) return "WELCOME";
  return LEGACY_PHASE_ALIAS[phase] ?? phase;
}

export function getPhase(id: string): Phase | undefined {
  return PHASES.find((p) => p.id === id);
}
