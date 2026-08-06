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

export const EVENT = {
  name: "Inn.Kind · FIEd Costa Rica",
  exerciseTitle: "Ejercicio de Prototipado",
  tableSize: SEATS_PER_TABLE,
  // Solo lo usa el registro viejo (flujo en vivo). En Agenda V2 la mesa la asigna la app.
  numberOfTables: THEMES.length * TABLES_PER_THEME,
};
