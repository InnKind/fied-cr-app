// Configuración del evento (config-driven). Editá acá las preguntas, temas y roles.
// Alineado con "Agenda V2". Los textos marcados POR DEFINIR se cambian en un solo lugar.

export type Role = { id: string; label: string; color: string };
export type Theme = {
  id: string;
  title: string;
  provocation: string; // la "provocación" del tema (POR DEFINIR)
  // Pregunta de apertura que el facilitador lee en la mesa y que el participante
  // también ve por escrito durante la actividad (opcional, POR DEFINIR).
  openingQuestion?: string;
  // Preguntas de apoyo (2-3) que estimulan el pensamiento del participante en la
  // pantalla de actividad (Cambio #2). POR DEFINIR — las afina el equipo.
  supportingQuestions?: string[];
  // Pregunta principal que guía a la persona a definir sus "momentos". Es la más
  // importante de la pantalla (se resalta). POR DEFINIR.
  momentsQuestion?: string;
  roles: string[]; // roles a los que este tema "les calza" (guía la elección)
};

// ¿El texto sigue en placeholder ("POR DEFINIR")? Sirve para no mostrarle a los
// participantes un texto de relleno si el equipo aún no puso el contenido real.
export function isPlaceholder(text: string | null | undefined): boolean {
  return !text || /POR DEFINIR/i.test(text);
}
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
// Nº REAL de mesas físicas del salón. La app las reparte entre los 3 temas
// según la demanda al momento de distribuir (mesas dinámicas). AJUSTAR al salón.
export const TOTAL_TABLES = 24;
// LEGACY: bloque fijo por tema. Solo lo usan el demo viejo (/demo/tema) y
// helpers legacy en lib/tables.ts. El flujo real ya NO lo usa.
export const TABLES_PER_THEME = 12;

// --- 3 TEMAS (Agenda V2) — las provocaciones están POR DEFINIR ---
export const THEMES: Theme[] = [
  {
    id: "aula",
    title: "La experiencia en el aula",
    provocation: "POR DEFINIR (provocación del tema 1 — perspectiva del estudiante).",
    openingQuestion: "POR DEFINIR (pregunta de apertura del tema 1).",
    // Ejemplo del word de cambios (Tema 1). El equipo lo afina.
    supportingQuestions: [
      "¿Qué es pensamiento realmente crítico y dónde puedo apoyarme en la IA?",
      "¿Cómo evaluar el aprendizaje: asistencia y exámenes, o portafolios?",
    ],
    momentsQuestion:
      "¿En qué momentos del proceso de aprendizaje del estudiante podría mejorar el resultado aprovechando la IA y empoderando al estudiante a dirigir su propio proceso?",
    roles: ["estudiante", "docente"],
  },
  {
    id: "organizacional",
    title: "El modelo organizacional de la universidad",
    provocation: "POR DEFINIR (provocación del tema 2 — perspectiva docente/facultad).",
    openingQuestion: "POR DEFINIR (pregunta de apertura del tema 2).",
    supportingQuestions: ["POR DEFINIR (pregunta de apoyo 1 del tema 2)."],
    momentsQuestion: "POR DEFINIR (pregunta para definir momentos del tema 2).",
    roles: ["docente", "admin-universitario"],
  },
  {
    id: "regulatorio",
    title: "Calidad y regulación del sistema",
    provocation: "POR DEFINIR (provocación del tema 3 — perspectiva del regulador).",
    openingQuestion: "POR DEFINIR (pregunta de apertura del tema 3).",
    supportingQuestions: ["POR DEFINIR (pregunta de apoyo 1 del tema 3)."],
    momentsQuestion: "POR DEFINIR (pregunta para definir momentos del tema 3).",
    roles: ["regulador", "gobierno", "sector-productivo"],
  },
];

// Título numerado del tema para mostrarlo a las personas, p.ej.
// "Tema 1: La experiencia en el aula". El número sale del orden en THEMES.
export function numberedThemeTitle(id: string | null | undefined): string {
  const i = THEMES.findIndex((t) => t.id === id);
  if (i < 0) return "";
  return `Tema ${i + 1}: ${THEMES[i].title}`;
}

// --- Guía del facilitador (run-of-show de la actividad en la mesa) ---
// Recordatorio de los pasos que sigue el facilitador durante el prototipado.
// (Los "guiones" verbatim los aporta el equipo; aquí van las instrucciones.)
export type FacilitatorStep = { title: string; detail: string; script?: string };
export const FACILITATOR_GUIDE: FacilitatorStep[] = [
  {
    title: "1 · Presenta la provocación",
    detail: "Lee en voz alta la provocación y la pregunta de tu grupo.",
    script: "", // guion verbatim POR DEFINIR (opcional)
  },
  {
    title: "2 · Generen momentos",
    detail: "Invita a cada quien a pensar en 2 o 3 momentos y escribirlos en post-its.",
  },
  {
    title: "3 · Compartan y agrupen",
    detail:
      "Pide que lean sus momentos en voz alta y los coloquen en la mesa. Agrupa las ideas parecidas.",
  },
  {
    title: "4 · Voten los mejores",
    detail:
      "Invita a votar por sus 2 momentos favoritos con los stickers. Ayuda al grupo a identificar los 3 mejores.",
  },
  {
    title: "5 · Registra en la app",
    detail:
      "Escribe aquí abajo los 3 momentos ganadores, guárdalos y marca tu mesa como lista.",
  },
];

// --- Instrucciones para el PARTICIPANTE (Cambio #2) ---
// Pantalla A ("Actividad en tu mesa"): los pasos del proceso, al llegar a la
// mesa. Luego un botón "Empezar" lleva a la pantalla del tema + preguntas.
// El equipo edita estos textos.
export const ACTIVITY_STEPS: string[] = [
  "Piensa en los momentos y anota tus ideas en post-its.",
  "Preséntate, lee tus post-its en voz alta y agrupen los parecidos.",
  "Voten por sus 2 momentos favoritos con las calcomanías.",
  "Ayuden al grupo a elegir los 3 mejores momentos.",
  "Elige el momento en el que quieres trabajar y siéntate con ese subgrupo.",
];

// Instrucción fija bajo las preguntas del tema (pantalla B, tras "Empezar").
export const ACTIVITY_THINK_HINT =
  "Tómate un par de minutos para pensar en silencio y anota 2 o 3 “momentos” en post-its.";

// Pantalla C: pasos de la SIGUIENTE etapa, cuando el facilitador ya guardó los
// 3 momentos y la persona va a elegir el suyo y trabajar las ideas.
export const MOMENT_STEPS: string[] = [
  "Elige el momento en el que quieras trabajar y siéntate junto a quienes trabajen en el mismo.",
  "Tómate un par de minutos para pensar en silencio y envía tus ideas por la app.",
  "En tu subgrupo, conversen y mejoren las ideas que generaron para su momento.",
  "Una persona de cada subgrupo presenta las mejores ideas a los demás subgrupos.",
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

// Enlace a Atenea (GPT externo) para seguir explorando tras enviar ideas.
export const ATHENEA_URL =
  "https://chatgpt.com/g/g-jGO4zaEiC-fied-foro-internacional-de-educacion";

// --- Ronda 2 (reflexión) — 3 preguntas. La mesa ya no importa. ---
export const ROUND2_QUESTIONS = {
  theme: "¿En cuál de los 3 temas quieres tomar acción en tu contexto real?",
  // Nueva pregunta (Cambio #1), va después del tema.
  motivatingIdea: "¿Con qué idea te sientes motivado/a a empezar?",
  roles:
    "¿Cuáles son los 3 roles que necesitas involucrar para llevar esta iniciativa adelante? (roles, no nombres)",
  experience:
    "¿Qué experiencia podrías diseñar para inspirar a esos roles a apoyarte?",
  // 4ª opción del dropdown de tema y su pregunta de seguimiento (Cambio #1).
  cantCommitOption: "No puedo comprometerme a tomar acción en este momento.",
  cantCommitReason: "¿Por qué no puedes tomar acción en este momento?",
};
// Valor centinela para la 4ª opción "no puedo comprometerme".
export const R2_CANT_COMMIT = "__cant_commit__";

export const EVENT = {
  name: "Inn.Kind · FIEd Costa Rica",
  exerciseTitle: "Ejercicio de Prototipado",
  tableSize: SEATS_PER_TABLE,
  // Solo lo usa el registro viejo (flujo en vivo). En Agenda V2 la mesa la asigna la app.
  numberOfTables: TOTAL_TABLES,
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
  // Prototipado (Ronda 1): UN solo paso. Adentro, cada mesa y cada persona
  // avanza a su ritmo (actividad → elegir momento → ideas), orquestado por
  // Round1Prototyping. Ya NO hay fases globales separadas de "selección" e
  // "ideas"; el admin solo pone "Prototipado" y monitorea con "Mesa lista".
  { id: "ROUND1_PHYSICAL_ACTIVITY", round: 1, label: "4 · Prototipado en las mesas (a su ritmo)", waitTitle: "Actividad en tu mesa", waitMessage: "Sigue al facilitador. Por ahora no necesitas el celular." },
  { id: "ROUND1_COMPLETE", round: 1, label: "5 · Ronda 1 completa (coffee break)", waitTitle: "¡Terminaste la Ronda 1!", waitMessage: "Toma tu café. Ya volvemos con los resultados." },
  { id: "PROCESSING", round: 1, label: "6 · Procesando con IA", waitTitle: "Procesando…", waitMessage: "La IA está resumiendo las ideas de todas las mesas." },
  { id: "RESULTS", round: 1, label: "7 · Resultados (presentación)" }, // pantalla real: Results
  { id: "ROUND2", round: 2, label: "8 · Ronda 2 (reflexión)", waitTitle: "Ronda 2", waitMessage: "Pantalla en construcción." },
  { id: "FINISHED", round: 2, label: "9 · Cierre", waitTitle: "¡Gracias por participar!", waitMessage: "El ejercicio terminó. Pronto podrás consultar los resultados." },
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
