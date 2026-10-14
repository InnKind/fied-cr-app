// Charla «La universidad que el primer empleo necesita» (Adriana Angarita).
// FUENTES: la presentación «La universidad que el primer empleo necesita.pptx» y
// el formulario de Google «Su mirada sobre la educación superior». Los textos de
// las preguntas y de las opciones son EXACTOS a los del formulario: si cambian
// allá, se cambian aquí Y en supabase/14-charla.sql (la base valida las opciones).
//
// Pantallas:
//   /charla             → celular (ANÓNIMO: las preguntas sin pedir nombre; al final, contacto opcional aparte)
//   /charla/pantalla    → proyector (se avanza con el clicker; ?k=CLAVE)
//   /charla/resultados  → resultados públicos (solo conteos)
//   /charla/exportar    → CSV de respuestas anónimas y de contactos (pide la clave)
// Base: supabase/14-charla.sql y 15-charla-anonima.sql (tablas charla_state,
// charla_responses y charla_contacts; funciones charla_answer, charla_me,
// charla_results y charla_contact). No toca nada del stand ni del FIEd.
// Las respuestas son ANÓNIMAS (un código aleatorio del celular). El contacto
// del final es opcional y se guarda aparte, sin ese código: no se pueden unir.
//
// Las láminas se dibujan desde src/config/charla-laminas.json, que se genera a
// partir del .pptx (herramientas/pptx_a_laminas.py en la carpeta de entregables).

export const SESSION = "PE26";

export const TALK_TITLE = "La universidad que el primer empleo necesita";
export const BRAND_TEXT = "SénecaLab · InnKind";

export const CHARLA_URL = "https://fied-cr-app.vercel.app/charla";
export const RESULTS_URL = "https://fied-cr-app.vercel.app/charla/resultados";
export const CHARLA_SHORT_URL = "fied-cr-app.vercel.app/charla";
export const RESULTS_SHORT_URL = "fied-cr-app.vercel.app/charla/resultados";
export const PRIVACY_URL = "/charla/privacidad";
export const CONTACT_EMAIL = "info@senecalabonline.com";

export const QR = {
  entrar: "/charla/qr-entrar.svg",
  resultados: "/charla/qr-resultados.svg",
} as const;
export type QrKey = keyof typeof QR;

// Paleta de la presentación.
export const C = {
  navy: "#223C5D",
  navy2: "#2B4A70",
  ink: "#1E2A3A",
  orange: "#FF5800",
  cream: "#F6F3EE",
  sand: "#ECE8E1",
  ice: "#DCE4FF",
  slate: "#55657A",
  line: "#C9D2DE",
  white: "#FFFFFF",
} as const;

// Logos tomados del .pptx (public/charla/logos). «blanco» solo sobre fondo oscuro.
export const LOGOS = {
  senecalabBlanco: { src: "/charla/logos/senecalab-blanco.png", alt: "SénecaLab: Expertos en know how", width: 1329, height: 434 },
  innkindBlanco: { src: "/charla/logos/innkind-blanco.png", alt: "InnKind: Innovation, Human, Education", width: 2339, height: 665 },
  senecalabAzul: { src: "/charla/logos/senecalab-azul.png", alt: "SénecaLab: Expertos en know how", width: 1329, height: 434 },
  innkindAzul: { src: "/charla/logos/innkind-azul.png", alt: "InnKind: Innovation, Human, Education", width: 2339, height: 665 },
  central: { src: "/charla/logos/universidad-central-blanco.png", alt: "Universidad Central", width: 766, height: 298 },
} as const;

// ---------------------------------------------------------------------------
// Bienvenida (anónima)
// ---------------------------------------------------------------------------
export const FORM_TITLE = "Su mirada sobre la educación superior";
// Descripción del formulario, sin la parte que pedía datos personales.
export const FORM_INTRO =
  "Encuesta para líderes empresariales: 3 minutos. Sus respuestas alimentan InnKind Intelligence, el análisis de InnKind sobre lo que piensan y deciden los líderes de la educación superior y el empleo.";
export const ANON_NOTE = "Sus respuestas son anónimas: no le pedimos su nombre.";

// ---------------------------------------------------------------------------
// Contacto opcional del final. Va APARTE de las respuestas (charla_contacts no
// guarda el código del celular), así que no se puede saber qué respondió quien
// deja su contacto. Las opciones son las de la pregunta del formulario
// «¿Cómo le gustaría seguir con SénecaLab e InnKind?», textos exactos.
// ---------------------------------------------------------------------------
export const CONTACT = {
  title: "¿Quiere seguir en contacto?",
  intro: "Es opcional y va aparte: sus respuestas siguen siendo anónimas y no se unen a estos datos.",
  prompt: "¿Cómo le gustaría seguir con SénecaLab e InnKind?",
  options: [
    { id: "resultados", label: "Recibir los resultados de esta sesión" },
    { id: "proyecto", label: "Conversar sobre un proyecto con universidades" },
    { id: "mesa", label: "Participar en una mesa de prototipado InnKind" },
    { id: "fied2027", label: "Conocer el FIEd 2027" },
  ],
  consent: "Acepto que SénecaLab e InnKind me contacten para lo que marqué.",
} as const;
export type ContactOptionId = (typeof CONTACT.options)[number]["id"];

export type ContactField = "nombre" | "correo" | "organizacion" | "cargo";
export type Contact = Record<ContactField, string>;
export const CONTACT_FIELDS: {
  id: ContactField;
  label: string;
  max: number;
  type: "text" | "email";
  autoComplete: string;
  required: boolean;
}[] = [
  { id: "nombre", label: "Nombre", max: 150, type: "text", autoComplete: "name", required: true },
  { id: "correo", label: "Correo", max: 200, type: "email", autoComplete: "email", required: true },
  { id: "organizacion", label: "Organización (opcional)", max: 200, type: "text", autoComplete: "organization", required: false },
  { id: "cargo", label: "Cargo (opcional)", max: 150, type: "text", autoComplete: "organization-title", required: false },
];
export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// ---------------------------------------------------------------------------
// Preguntas (textos y opciones EXACTOS del formulario)
// ---------------------------------------------------------------------------
export type QuestionId =
  | "ROL"
  | "SECTOR"
  | "PREP"
  | "PASANTIAS"
  | "BARRERAS"
  | "CAPACIDADES"
  | "POSICIONES"
  | "INFO"
  | "COEXP"
  | "FRASE";

// single = una opción · multi = varias (casillas) · scale = escala 1–5 · text = texto libre
export type QuestionMode = "single" | "multi" | "scale" | "text";
export type Option = {
  id: string;
  label: string;
  other?: boolean; // «Otros:» con texto libre
  exclusive?: boolean; // «Ninguna por ahora»: no se combina con otras
};
export type Question = {
  id: QuestionId;
  moment: MomentId;
  mode: QuestionMode;
  prompt: string; // texto exacto del formulario
  short: string; // rótulo corto para paneles y columnas
  required: boolean;
  options: Option[];
  max?: number; // multi: máximo de opciones
  minLabel?: string; // scale
  maxLabel?: string; // scale
  textMax?: number; // text
  long?: boolean; // text: párrafo
};

export const OTHER_ID = "otro";
export const NONE_ID = "ninguna";
export const OTHER_MAX = 150;

export type MomentId = 1 | 2 | 3;

export const QUESTIONS: Record<QuestionId, Question> = {
  ROL: {
    id: "ROL",
    moment: 1,
    mode: "single",
    prompt: "¿Cuál es su rol principal?",
    short: "Rol principal",
    required: true,
    options: [
      { id: "junta", label: "Junta directiva" },
      { id: "alta-direccion", label: "Alta dirección (CEO, VP, gerencia)" },
      { id: "empresaria", label: "Empresaria o fundadora" },
      { id: "sector-publico", label: "Sector público" },
      { id: "academia", label: "Academia" },
      { id: OTHER_ID, label: "Otros", other: true },
    ],
  },
  SECTOR: {
    id: "SECTOR",
    moment: 1,
    mode: "single",
    prompt: "Sector de su organización",
    short: "Sector",
    required: true,
    options: [
      { id: "banca", label: "Banca y finanzas" },
      { id: "servicios", label: "Servicios profesionales" },
      { id: "comercio", label: "Comercio y logística" },
      { id: "salud", label: "Salud" },
      { id: "tecnologia", label: "Tecnología" },
      { id: "energia", label: "Energía, construcción e infraestructura" },
      { id: "turismo", label: "Turismo y hotelería" },
      { id: "educacion", label: "Educación" },
      { id: "gobierno", label: "Gobierno" },
      { id: OTHER_ID, label: "Otros", other: true },
    ],
  },
  PREP: {
    id: "PREP",
    moment: 1,
    mode: "scale",
    prompt: "¿Qué tan preparados llegan los recién graduados que contrata su organización?",
    short: "Preparación de los recién graduados",
    required: true,
    minLabel: "Nada preparados",
    maxLabel: "Muy preparados",
    options: [
      { id: "1", label: "1" },
      { id: "2", label: "2" },
      { id: "3", label: "3" },
      { id: "4", label: "4" },
      { id: "5", label: "5" },
    ],
  },
  PASANTIAS: {
    id: "PASANTIAS",
    moment: 2,
    mode: "single",
    prompt: "Por cada 10 contrataciones de primer empleo, ¿cuántas pasantías ofrece su organización?",
    short: "Pasantías por cada 10 primeros empleos",
    required: true,
    options: [
      { id: "0", label: "0" },
      { id: "1", label: "1" },
      { id: "2-a-4", label: "2 a 4" },
      { id: "5-mas", label: "5 o más" },
      { id: "no-se", label: "No sé" },
    ],
  },
  BARRERAS: {
    id: "BARRERAS",
    moment: 2,
    mode: "multi",
    prompt: "¿Qué les impide ofrecer más pasantías?",
    short: "Qué les impide ofrecer más",
    required: false,
    options: [
      { id: "costo", label: "Costo" },
      { id: "tiempo", label: "Tiempo de supervisión" },
      { id: "convenios", label: "Falta de convenios con universidades" },
      { id: "preparacion", label: "Preparación de los candidatos" },
      { id: "legal", label: "Marco legal" },
      { id: "no-considerado", label: "No lo hemos considerado" },
      { id: OTHER_ID, label: "Otros", other: true },
    ],
  },
  CAPACIDADES: {
    id: "CAPACIDADES",
    moment: 3,
    mode: "multi",
    prompt: "¿Qué capacidades le cuesta más encontrar en los recién graduados? (hasta 3)",
    short: "Capacidades que más cuesta encontrar",
    required: false,
    max: 3,
    options: [
      { id: "ia", label: "Uso aplicado de la IA" },
      { id: "criterio", label: "Criterio y toma de decisiones" },
      { id: "comunicacion", label: "Comunicación" },
      { id: "equipo", label: "Trabajo en equipo" },
      { id: "datos", label: "Análisis de datos" },
      { id: "tecnico", label: "Conocimiento técnico del sector" },
      { id: "ingles", label: "Inglés" },
      { id: OTHER_ID, label: "Otros", other: true },
    ],
  },
  POSICIONES: {
    id: "POSICIONES",
    moment: 3,
    mode: "text",
    prompt: "¿Qué posiciones tardan más en cubrir?",
    short: "Posiciones que tardan más en cubrir",
    required: false,
    textMax: 200,
    options: [],
  },
  INFO: {
    id: "INFO",
    moment: 3,
    mode: "multi",
    prompt: "¿Qué información compartiría con las universidades?",
    short: "Información que compartirían",
    required: false,
    options: [
      { id: "vacantes", label: "Vacantes y perfiles que buscamos" },
      { id: "tendencias", label: "Tendencias de nuestro sector" },
      { id: "retos", label: "Retos y casos reales" },
      { id: "desempeno", label: "Desempeño de egresados contratados" },
      { id: NONE_ID, label: "Ninguna por ahora", exclusive: true },
    ],
  },
  COEXP: {
    id: "COEXP",
    moment: 3,
    mode: "multi",
    prompt: "¿Qué estaría dispuesta a co-experimentar con InnKind y universidades?",
    short: "Qué co-experimentarían",
    required: false,
    options: [
      { id: "pasantias", label: "Pasantías" },
      { id: "mentoria", label: "Mentoría a estudiantes" },
      { id: "codiseno", label: "Co-diseño de cursos o microcredenciales" },
      { id: "mesas", label: "Mesas de prototipado InnKind" },
      { id: "datos", label: "Compartir datos de vacantes" },
      { id: "junta", label: "Junta o consejo consultivo" },
      { id: NONE_ID, label: "Ninguna por ahora", exclusive: true },
    ],
  },
  FRASE: {
    id: "FRASE",
    moment: 3,
    mode: "text",
    prompt: "En una frase: ¿qué le pediría hoy a la educación superior?",
    short: "Lo que le pedirían a la educación superior",
    required: false,
    textMax: 500,
    long: true,
    options: [],
  },
};

export const QUESTION_ORDER: QuestionId[] = [
  "ROL",
  "SECTOR",
  "PREP",
  "PASANTIAS",
  "BARRERAS",
  "CAPACIDADES",
  "POSICIONES",
  "INFO",
  "COEXP",
  "FRASE",
];

export function optionLabel(q: Question, id: string): string {
  return q.options.find((o) => o.id === id)?.label ?? id;
}

// ---------------------------------------------------------------------------
// Momentos de participación (las 3 secciones del formulario)
// ---------------------------------------------------------------------------
export type Moment = {
  id: MomentId;
  kicker: string; // rótulo de la lámina
  title: string; // título de la sección en el formulario
  intro?: string; // descripción de la sección en el formulario
  questions: QuestionId[];
};

export const MOMENTS: Record<MomentId, Moment> = {
  1: {
    id: 1,
    kicker: "Participación 1",
    title: "Su perfil",
    questions: ["ROL", "SECTOR", "PREP"],
  },
  2: {
    id: 2,
    kicker: "Participación 2",
    title: "Pasantías",
    intro:
      "Burning Glass Institute usa una vara: por cada aviso de pasantía hay, en promedio, unos 10 de primer empleo.",
    questions: ["PASANTIAS", "BARRERAS"],
  },
  3: {
    id: 3,
    kicker: "Participación 3",
    title: "La voz que faltó",
    intro: "Las preguntas que el Costa Rica Talent Adaptation Lab dejó pendientes con empleadores.",
    questions: ["CAPACIDADES", "POSICIONES", "INFO", "COEXP", "FRASE"],
  },
};
export const MOMENT_IDS: MomentId[] = [1, 2, 3];

// ---------------------------------------------------------------------------
// Pasos de la pantalla
// ---------------------------------------------------------------------------
// lamina  = una lámina de la presentación (número de diapositiva del .pptx)
// escanear = lámina de participación: la misma del .pptx, con el QR y el conteo en vivo
// resultados = respuestas de la sala en vivo (no existe en el .pptx)
export type StepKind = "lamina" | "escanear" | "resultados";
export type Step = {
  id: string;
  kind: StepKind;
  lamina?: number; // diapositiva del .pptx
  moment?: MomentId;
  label: string;
};

export const STEPS: Step[] = [
  { id: "p01", kind: "lamina", lamina: 1, label: "Portada" },
  { id: "p02", kind: "lamina", lamina: 2, label: "De dónde viene esta mirada" },
  { id: "p03", kind: "lamina", lamina: 3, label: "Un mapa para leer la educación superior" },
  { id: "p04", kind: "escanear", lamina: 4, moment: 1, label: "Participación 1 · escanee y responda" },
  { id: "p05", kind: "resultados", moment: 1, label: "Participación 1 · lo que dijo la sala" },
  { id: "p06", kind: "lamina", lamina: 5, label: "EE. UU. como espejo" },
  { id: "p07", kind: "lamina", lamina: 6, label: "América Latina: entran muchos, se gradúan pocos" },
  { id: "p08", kind: "lamina", lamina: 7, label: "El talento que viene" },
  { id: "p09", kind: "lamina", lamina: 8, label: "La IA llegó antes a los estudiantes" },
  { id: "p10", kind: "lamina", lamina: 9, label: "La paradoja del primer empleo" },
  { id: "p11", kind: "lamina", lamina: 10, label: "Panamá: jóvenes sin empleo, empresas sin talento" },
  { id: "p12", kind: "lamina", lamina: 11, label: "Lo que ven las empresas" },
  { id: "p13", kind: "lamina", lamina: 12, label: "La vara de Burning Glass Institute" },
  { id: "p14", kind: "escanear", lamina: 13, moment: 2, label: "Participación 2 · su vara" },
  { id: "p15", kind: "resultados", moment: 2, label: "Participación 2 · lo que dijo la sala" },
  { id: "p16", kind: "lamina", lamina: 14, label: "Costa Rica Talent Adaptation Lab" },
  { id: "p17", kind: "escanear", lamina: 15, moment: 3, label: "Participación 3 · la voz que faltó" },
  { id: "p18", kind: "resultados", moment: 3, label: "Participación 3 · lo que dijo la sala" },
  { id: "p19", kind: "lamina", lamina: 16, label: "El peligro invisible: la rendición cognitiva" },
  { id: "p20", kind: "lamina", lamina: 17, label: "Aumentar, no automatizar" },
  { id: "p21", kind: "lamina", lamina: 18, label: "Tres compromisos que no se delegan" },
  { id: "p22", kind: "lamina", lamina: 19, label: "Cuatro desafíos · Gracias" },
];

// Paso 0 = antes de empezar · 1..STEPS.length = pasos · STEPS.length + 1 = fin.
export const PRE_STEP = 0;
export const END_STEP = STEPS.length + 1;

export function stepAt(step: number): Step | null {
  return step >= 1 && step <= STEPS.length ? STEPS[step - 1] : null;
}

// Paso en el que se abre cada momento en los celulares. El 1 (el perfil) está
// abierto desde el registro; el 2 y el 3 se abren cuando la pantalla llega a su
// lámina de participación, y ya no se cierran: quien llega tarde se pone al día.
export const MOMENT_OPENS_AT: Record<MomentId, number> = {
  1: PRE_STEP,
  2: STEPS.findIndex((s) => s.kind === "escanear" && s.moment === 2) + 1,
  3: STEPS.findIndex((s) => s.kind === "escanear" && s.moment === 3) + 1,
};

export function openMoments(step: number): MomentId[] {
  return MOMENT_IDS.filter((m) => step >= MOMENT_OPENS_AT[m]);
}

// Preguntas abiertas en los celulares en un paso dado, en orden.
export function openQuestions(step: number): QuestionId[] {
  return openMoments(step).flatMap((m) => MOMENTS[m].questions);
}
