// Configuración del evento (config-driven). Editá acá las preguntas, temas y roles.
// Alineado con "Agenda V2". Los textos marcados POR DEFINIR se cambian en un solo lugar.

export type Role = { id: string; label: string; color: string };
export type Theme = {
  id: string;
  title: string;
  provocation: string; // descripción del tema (la ve la persona al elegir tema)
  // Ejemplos de "momentos" del tema: una línea introductoria + 2-3 ejemplos.
  // Orientan el pensamiento del participante en la pantalla de actividad.
  examplesIntro?: string;
  examples?: string[];
  // Pregunta principal que guía a la persona a definir sus "momentos". Es la más
  // importante de la pantalla (se resalta).
  momentsQuestion?: string;
  roles: string[]; // roles a los que este tema "les calza" (guía la elección)
};

// ¿El texto sigue en placeholder ("POR DEFINIR")? Sirve para no mostrarle a los
// participantes un texto de relleno si el equipo aún no puso el contenido real.
export function isPlaceholder(text: string | null | undefined): boolean {
  return !text || /POR DEFINIR/i.test(text);
}
export type RoundQuestion = { id: string; prompt: string };

// --- Roles / sectores (para el registro) ---
// El orden es el del catálogo del equipo (18-ago): los 2 roles de cada tema y,
// al final, los que pueden ir a cualquier tema (idealmente repartidos, por eso
// NO aparecen en `Theme.roles` y no reciben la marca "sugerido para tu rol").
export const ROLES: Role[] = [
  { id: "estudiante", label: "Estudiante", color: "#16a34a" },
  { id: "docente", label: "Docente", color: "#2563eb" },
  {
    id: "decano",
    label: "Decano / Director académico / Coordinador de carrera",
    color: "#7c3aed",
  },
  {
    id: "calidad-admin",
    label: "Calidad/innovación académica y áreas administrativas",
    color: "#db2777",
  },
  {
    id: "rector",
    label: "Rector / Vicerrector / Asociación de universidades",
    color: "#dc2626",
  },
  {
    id: "politica-regulacion",
    label: "Política y regulación educativa / Organismos internacionales",
    color: "#0d9488",
  },
  { id: "edtech", label: "EdTec / Tecnología", color: "#ea580c" },
  {
    id: "empresa",
    label: "Sector empresarial / Política de apoyo a la empresa",
    color: "#ca8a04",
  },
  { id: "otro", label: "Otro", color: "#64748b" },
];

// --- Mesas ---
export const SEATS_PER_TABLE = 8;
// Nº REAL de mesas físicas del salón (confirmado por el equipo el 19-ago: 20).
// La app las reparte entre los 3 temas según la demanda al momento de
// distribuir (mesas dinámicas).
export const TOTAL_TABLES = 20;
// LEGACY: bloque fijo por tema. Solo lo usan el demo viejo (/demo/tema) y
// helpers legacy en lib/tables.ts. El flujo real ya NO lo usa.
export const TABLES_PER_THEME = 12;

// --- 3 TEMAS — contenido final del equipo (word del 18-ago) ---
// OJO: los `id` se guardan en la base (participants.selected_theme,
// idea_submissions.theme, table_themes.theme…). NO cambiarlos.
export const THEMES: Theme[] = [
  {
    id: "aula",
    title: "Experiencia educativa del estudiante",
    provocation:
      "Una metodología didáctica que aprovecha la IA y empodera al estudiante y al docente para mejorar el aprendizaje.",
    examplesIntro:
      "Ejemplos de momentos de interacción entre docente y estudiante que son parte de una metodología didáctica:",
    examples: [
      "Docente da una charla magistral y los estudiantes toman apuntes.",
      "Docente asigna tareas que el estudiante hace asincrónicamente.",
      "Estudiante hace examen que el docente califica para ofrecer retroalimentación.",
    ],
    momentsQuestion:
      "¿Qué momentos en metodologías didácticas comúnmente utilizadas tienen las mayores oportunidades de mejora?",
    roles: ["estudiante", "docente"],
  },
  {
    id: "organizacional",
    title: "Modelo organizacional de la universidad",
    provocation:
      "Un modelo organizacional que aprovecha la IA y empodera a decanos, directores / coordinadores académicos y administradores para mejorar la oferta educativa.",
    examplesIntro:
      "Ejemplos de momentos de interacción entre decano/director/coordinador y administradores que son parte de un modelo organizacional que afecta la oferta educativa:",
    examples: [
      "Administración aprueba / desaprueba modificación curricular sugerida por decanos.",
      "Administración incentiva publicaciones y los directores le piden a sus docentes publicar.",
      "Administración requiere feedback y participación de industria para aprobar nuevos cursos.",
    ],
    momentsQuestion:
      "¿Qué momentos en el flujo del modelo organizacional de las universidades tienen las mayores oportunidades de mejora?",
    roles: ["decano", "calidad-admin"],
  },
  {
    id: "regulatorio",
    title: "Sistema nacional para la calidad de la educación superior",
    provocation:
      "Un sistema nacional de educación superior que aprovecha la IA y empodera a líderes universitarios y reguladores para mejorar los modelos de gestión de la calidad e innovación de las universidades.",
    examplesIntro:
      "Ejemplos de momentos en los que rectores / vicerrectores y reguladores interactúan que influyen en el modelo de gestión de la calidad e innovación de la universidad:",
    examples: [
      "Reguladores aprueban o desaprueban modificaciones a planilla de personal académico.",
      "Acreditadora requiere visita de universidad internacional para ofrecer retroalimentación.",
      "Reguladores requieren que la oferta educativa calce con una nomenclatura de grado y títulos.",
    ],
    momentsQuestion:
      "¿Qué momentos en el flujo de la regulación y promoción de la calidad tienen las mayores oportunidades de mejora?",
    roles: ["rector", "politica-regulacion"],
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
// Los tiempos suman 20 minutos y son los que el facilitador va cantando.
export const FACILITATOR_GUIDE: FacilitatorStep[] = [
  {
    title: "1 · Pensar (5 mins)",
    detail:
      "Tómate un par de minutos para pensar en silencio y anota 2 o 3 “momentos” en post-its.",
  },
  {
    title: "2 · Compartir (8 mins)",
    detail:
      "Comparte tu nombre y tu rol. Lee cada momento en voz alta mientras colocas tus post-its en la mesa.",
  },
  {
    title: "3 · Agrupar (2 mins)",
    detail: "Entre todos, agrupen los post-its parecidos.",
  },
  {
    title: "4 · Votar (2 mins)",
    detail:
      "Cada persona vota en silencio por los 2 momentos que considera más prometedores con una calcomanía.",
  },
  {
    title: "5 · Entregar (3 mins)",
    detail:
      "Escriban los 3 momentos en 3 post-its y pásenle los momentos a un facilitador.",
  },
];

// --- Instrucciones para el PARTICIPANTE ---
// Cada paso tiene una etiqueta corta en negrita (Pensar, Votar…) y el detalle.
export type ActivityStep = { label: string; text: string };

// Pantalla A ("Actividad en tu mesa"): los pasos del proceso, al llegar a la
// mesa. Luego un botón "Empezar" lleva a la pantalla del tema + la pregunta.
export const ACTIVITY_STEPS_TITLE = "Qué van a hacer en la mesa (25 mins)";
export const ACTIVITY_STEPS: ActivityStep[] = [
  {
    label: "Pensar",
    text: "Tómate un par de minutos para pensar en silencio y anota 2 o 3 “momentos” en post-its.",
  },
  {
    label: "Preséntate",
    text: "tu nombre y tu rol. Luego lee cada momento en voz alta mientras colocas tus post-its en la mesa.",
  },
  { label: "Agrupar", text: "Entre todos, agrupen los post-its parecidos." },
  {
    label: "Votar",
    text: "Ahora cada persona vota en silencio por los 2 momentos que considera más prometedores con una calcomanía.",
  },
  {
    label: "Entregar",
    text: "Escriban los tres momentos en una hoja y pásenle la hoja a un facilitador.",
  },
];

// Instrucción fija bajo la pregunta del tema (pantalla B, tras "Empezar").
export const ACTIVITY_THINK_HINT =
  "Tómate un par de minutos para pensar en silencio, y anota 2 o 3 “momentos” en post-its.";
// Cómo llegan los momentos a la app (misma pantalla, debajo del hint).
export const ACTIVITY_FACILITATOR_HINT =
  "Cuando tu mesa tenga los momentos, un facilitador les ayudará a añadirlos a la app.";

// Pantalla C: pasos de la SIGUIENTE etapa, cuando el facilitador ya guardó los
// 3 momentos y la persona va a elegir el suyo y trabajar las ideas.
export const MOMENT_STEPS_TITLE = "Qué van a hacer en la mesa (20 mins)";
export const MOMENT_STEPS: ActivityStep[] = [
  {
    label: "Elegir",
    text: "Elige el momento en el que quieres trabajar y siéntate en un grupo con las otras personas que escogen ese momento.",
  },
  {
    label: "Idear",
    text: "Tómate un par de minutos para pensar en silencio y envía tus ideas a través de la app.",
  },
  {
    label: "Conversar",
    text: "En tu grupo, compartan / generen ideas conjuntas sobre el momento que escogieron.",
  },
  {
    label: "Presentar",
    text: "Una persona de cada grupo presenta las mejores ideas a los demás grupos de la mesa.",
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

// --- Captura de ideas (prototipado) ---
// Dos preguntas POR TEMA. El orden es: primero EMPODERAMIENTO (agency), después
// IA — así lo pidió el equipo. `agency` y `ai` son los nombres de las columnas
// en idea_submissions (agency_text / ai_text), no los cambies.
export type IdeaPrompt = { label: string; placeholder: string };
export type IdeaPromptPair = { agency: IdeaPrompt; ai: IdeaPrompt };

// Respaldo genérico (si un tema no tiene preguntas propias).
export const IDEA_PROMPTS_DEFAULT: IdeaPromptPair = {
  agency: {
    label:
      "¿Cómo podría la persona involucrada tener más autonomía, voz o poder de decisión en ese momento?",
    placeholder: "Tus ideas de empoderamiento",
  },
  ai: {
    label: "¿Cómo podría integrarse mejor la IA en el momento que elegiste?",
    placeholder: "Tus ideas sobre la IA",
  },
};

export const IDEA_PROMPTS_BY_THEME: Record<string, IdeaPromptPair> = {
  aula: {
    agency: {
      label:
        "En ese momento, ¿cómo podrían los docentes empoderar más al estudiante para mejorar el resultado de aprendizaje?",
      placeholder: "Tus ideas de empoderamiento",
    },
    ai: {
      label:
        "En ese momento, ¿cómo podríamos aprovechar la IA para potenciar el aprendizaje del estudiante?",
      placeholder: "Tus ideas sobre la IA",
    },
  },
  organizacional: {
    agency: {
      label:
        "En ese momento, ¿cómo podría la universidad empoderar más a decanos y directores/coordinadores académicos para facilitar la evolución de la oferta educativa?",
      placeholder: "Tus ideas de empoderamiento",
    },
    ai: {
      label:
        "En ese momento, ¿cómo podríamos aprovechar la IA para potenciar la evolución de la oferta educativa?",
      placeholder: "Tus ideas sobre la IA",
    },
  },
  regulatorio: {
    agency: {
      label:
        "En ese momento, ¿cómo podrían los reguladores/promotores de la calidad de la educación superior empoderar más al liderazgo de cada universidad para impulsar la innovación y calidad en su universidad?",
      placeholder: "Tus ideas de empoderamiento",
    },
    ai: {
      label:
        "En ese momento, ¿cómo podríamos aprovechar la IA para impulsar la gestión universitaria hacia la innovación y calidad?",
      placeholder: "Tus ideas sobre la IA",
    },
  },
};

export function ideaPromptsFor(
  themeId: string | null | undefined
): IdeaPromptPair {
  return (themeId && IDEA_PROMPTS_BY_THEME[themeId]) || IDEA_PROMPTS_DEFAULT;
}

// Enlace a Atenea (GPT externo) para seguir explorando tras enviar ideas.
export const ATHENEA_URL =
  "https://chatgpt.com/g/g-jGO4zaEiC-fied-foro-internacional-de-educacion";

// --- Ronda 2 (reflexión) — 3 preguntas. La mesa ya no importa. ---
export const ROUND2_QUESTIONS = {
  theme: "¿En cuál de los 3 temas quieres tomar acción en tu contexto real?",
  // Nueva pregunta (Cambio #1), va después del tema.
  motivatingIdea: "¿Con qué idea te sientes motivado/a a empezar?",
  roles:
    "¿Cuáles son las 3 personas que necesitas involucrar para llevar esta idea adelante? (roles, no nombres)",
  experience:
    "¿Qué paso podrías tomar para inspirar a esas personas a involucrarse?",
  // 4ª opción del dropdown de tema y su pregunta de seguimiento (Cambio #1).
  cantCommitOption: "Prefiero no tomar acción en este momento.",
  cantCommitReason:
    "Para entenderte mejor, ¿qué te frena de tomar un siguiente paso?",
};
// Valor centinela para la 4ª opción "no puedo comprometerme".
export const R2_CANT_COMMIT = "__cant_commit__";

export const EVENT = {
  name: "Inn.Kind · FIEd Costa Rica",
  exerciseTitle: "Ejercicio de Ideación",
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
