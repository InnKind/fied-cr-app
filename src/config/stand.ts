// Modo stand · GET Forum 2026 (Grupo BID, Quito, 5-7 oct 2026).
// FUENTE: "01 Contenido maestro.md" (carpeta stand-innkind-senecalab). Los textos
// de las preguntas, opciones y puertas son EXACTOS: si cambian allá, se cambian
// aquí. Lo que falta va como [PEDIR: …] o [APROBAR: …] y se ve en amarillo.
//
// Pantallas:
//   /stand             → celular (anónimo, sigue el paso de la sesión)
//   /stand/pantalla    → TV del stand (Adriana avanza con el clicker; ?k=CLAVE)
//   /stand/resultados  → resultados públicos
//   /stand/exportar    → CSV para la base maestra (pide la clave del stand)
// Base: supabase/12-stand.sql (tablas stand_state, stand_responses, stand_contacts
// y las funciones stand_answer, stand_my_answers, stand_results).

import ateneaJson from "./stand-atenea.json";

export const SESSION = "GET26";
export const EVENT_CODE = "STAND-EC-26";

export const STAND_URL = "https://fied-cr-app.vercel.app/stand";
export const RESULTS_URL = "https://fied-cr-app.vercel.app/stand/resultados";
export const STAND_SHORT_URL = "fied-cr-app.vercel.app/stand";
export const RESULTS_SHORT_URL = "fied-cr-app.vercel.app/stand/resultados";
export const ATENEA_GPT_URL =
  "https://chatgpt.com/g/g-jGO4zaEiC-fied-foro-internacional-de-educacion";

// QR ya generados (copiados de stand-innkind-senecalab/qr a public/stand).
export const QR = {
  entrar: "/stand/qr-entrar-stand.svg",
  resultados: "/stand/qr-resultados.svg",
  atenea: "/stand/qr-atenea-gpt.svg",
} as const;
export type QrKey = keyof typeof QR;

// Aviso de privacidad. Por defecto, el aviso propio del stand (/stand/privacidad,
// que muestra [APROBAR] hasta que Adriana lo apruebe). Si llega el enlace del
// aviso de las inscripciones del FIEd, se puede poner aquí. Con null, el pie
// muestra el marcador [PEDIR] en amarillo.
export const PRIVACY_URL: string | null = "/stand/privacidad";

export const BRAND_TEXT = "SenecaLab · InnKind";
export const NAVY = "#223c5d";
export const RED = "#c9283f";

// ---------------------------------------------------------------------------
// Frase de las dos marcas (sección 1)
// ---------------------------------------------------------------------------
export const TWO_BRANDS =
  "SenecaLab es la empresa que lleva IA y plataformas a las universidades. InnKind es la plataforma con la que estudiamos el fenómeno junto con la región. Atenea es la memoria de todo lo que hemos aprendido.";

// ---------------------------------------------------------------------------
// Preguntas (sección 6, texto exacto)
// ---------------------------------------------------------------------------
export type QuestionId =
  | "R1"
  | "R2"
  | "P0"
  | "P1"
  | "P2"
  | "P3"
  | "P3b"
  | "P4"
  | "P5"
  | "ABIERTA";

export type QuestionType = "registro" | "feedback" | "asesoria";
export type Option = { id: string; label: string; detail?: string };
export type Question = {
  id: QuestionId;
  type: QuestionType;
  mode: "single" | "multi" | "text";
  max?: number; // solo multi
  prompt: string;
  short: string; // título corto para el resumen y los resultados
  options: Option[];
  optional?: boolean;
};

export const R1: Question = {
  id: "R1",
  type: "registro",
  mode: "single",
  prompt: "¿Desde dónde miras el ecosistema?",
  short: "Desde dónde miran el ecosistema",
  options: [
    { id: "inversion", label: "Inversión (fondo, ángel, family office, corporate venturing)" },
    { id: "emprendimiento", label: "Emprendimiento (fundador/a o startup)" },
    { id: "estudiante", label: "Estudiante" },
    { id: "universidad", label: "Universidad o institución educativa" },
    { id: "aceleradora", label: "Aceleradora, incubadora o hub" },
    { id: "empresa", label: "Empresa" },
    { id: "gobierno", label: "Gobierno u organismo multilateral" },
    { id: "fundacion", label: "Fundación o cooperación" },
    { id: "otro", label: "Otro" },
  ],
};

export const R2: Question = {
  id: "R2",
  type: "registro",
  mode: "single",
  prompt: "¿Cuál es tu relación con nosotros?",
  short: "Su relación con nosotros",
  options: [
    { id: "fied", label: "Participé en un FIEd" },
    { id: "senecalab", label: "Trabajo o trabajé con SenecaLab" },
    { id: "ecosistema", label: "Nos conocemos del ecosistema" },
    { id: "primera-vez", label: "Es la primera vez que nos veo" },
  ],
};

// Hallazgos A-D (sección 3). P1 los usa como opciones.
export type Finding = { id: "A" | "B" | "C" | "D"; text: string; source: string };
export const FINDINGS: Finding[] = [
  {
    id: "A",
    text: "Las instituciones de educación superior aportan apenas **~5% de la formación que necesitan las empresas**.",
    source: "Karlo Mondragón, Grupo Salinas, en el FIEd",
  },
  {
    id: "B",
    text: "**Más del 75% de los estudiantes** siente que no podría terminar un trabajo sin IA.",
    source: "Turnitin, presentado en el FIEd",
  },
  {
    id: "C",
    text: "Solo el **0,04% de las patentes de IA** son de América Latina: nuestra ventaja no es inventar, es **adoptar**.",
    source: "Víctor Morales, CENIA, en el FIEd",
  },
  {
    id: "D",
    text: "En el FIEd Costa Rica 2026, **casi 1 de cada 3 líderes** (13 de 44) eligió empezar por **capacitar a sus docentes en IA**.",
    source: "Dato propio: app de ideación de InnKind, 20-ago-2026",
  },
];

export const P0: Question = {
  id: "P0",
  type: "asesoria",
  mode: "single",
  prompt: "¿Qué frena más a América Latina para convertir la IA en resultados?",
  short: "Lo que más frena a América Latina",
  options: [
    { id: "a", label: "Talento: faltan personas con las habilidades que pide el mercado" },
    { id: "b", label: "Las universidades cambian más lento que la tecnología" },
    { id: "c", label: "Se adopta IA sin medir si da resultados" },
    { id: "d", label: "Universidad, empresa y emprendimiento no conversan" },
    { id: "e", label: "No hay financiamiento para transformar la educación" },
  ],
};

export const P1: Question = {
  id: "P1",
  type: "feedback",
  mode: "single",
  prompt:
    "¿Cuál de estos hallazgos cambiaría una decisión tuya este año (invertir, emprender, contratar, diseñar un programa o una política)?",
  short: "El hallazgo que cambiaría una decisión",
  options: [
    ...FINDINGS.map((f) => ({ id: f.id, label: f.id, detail: f.text })),
    { id: "ya-lo-sabia", label: "Ninguno: ya lo sabía" },
    { id: "no-aplica", label: "Ninguno: no aplica a lo que hago" },
  ],
};

export const P2: Question = {
  id: "P2",
  type: "feedback",
  mode: "single",
  prompt: "Por lo que viste, ¿qué harías con Atenea?",
  short: "Qué harían con Atenea",
  options: [
    { id: "tal-cual", label: "La usaría tal cual" },
    { id: "datos-pais", label: "La usaría si tuviera datos de mi país" },
    { id: "verificar", label: "La usaría si pudiera verificar cada fuente" },
    { id: "no-usaria", label: "No la usaría para decidir nada importante" },
  ],
};

export const P3: Question = {
  id: "P3",
  type: "asesoria",
  mode: "multi",
  max: 2,
  prompt:
    "Si InnKind existiera todo el año, ¿en cuáles 2 de estas cosas pondrían recursos tú o tu organización?",
  short: "Dónde pondrían recursos",
  options: [
    { id: "fied-pais", label: "FIEd en tu país" },
    { id: "webinars", label: "Webinars y comunidad todo el año" },
    { id: "atenea", label: "Atenea para tu organización" },
    { id: "ruta", label: "Ruta de Transformación para docentes y directivos" },
    { id: "intelligence", label: "InnKind Intelligence: informes del sector por país" },
    { id: "ninguna", label: "Ninguna" },
  ],
};
export const P3_NONE = "ninguna";

export const P3B: Question = {
  id: "P3b",
  type: "asesoria",
  mode: "single",
  prompt: "¿Quién decide ese presupuesto?",
  short: "Quién decide ese presupuesto",
  options: [
    { id: "yo", label: "Yo" },
    { id: "influyo", label: "Influyo" },
    { id: "otra-area", label: "Otra área" },
  ],
};

export const P4: Question = {
  id: "P4",
  type: "asesoria",
  mode: "single",
  prompt:
    "Cuando una institución educativa adopta tecnología o IA, ¿dónde crees que más falla?",
  short: "Dónde más falla la adopción",
  options: [
    { id: "capacitacion", label: "Capacitación" },
    { id: "adopcion", label: "Adopción de los docentes" },
    { id: "soporte", label: "Soporte" },
    { id: "integracion", label: "Integración con otros sistemas" },
    { id: "medir", label: "Medir los resultados" },
    { id: "no-se", label: "No lo sé" },
  ],
};

export const P5: Question = {
  id: "P5",
  type: "feedback",
  mode: "single",
  prompt: "¿Qué te frenaría para trabajar con nosotros o apoyarnos?",
  short: "El freno para trabajar con nosotros",
  options: [
    { id: "precio", label: "Precio o costo" },
    { id: "resultados", label: "No conozco sus resultados" },
    { id: "escala", label: "No veo cómo escala" },
    { id: "proveedor", label: "Ya tengo proveedor o aliado" },
    { id: "prioridad", label: "No es prioridad este año" },
    { id: "no-entiendo", label: "No entiendo qué ofrecen" },
  ],
};

export const ABIERTA: Question = {
  id: "ABIERTA",
  type: "asesoria",
  mode: "text",
  optional: true,
  prompt: "Si fueras de nuestra junta directiva, ¿qué nos pedirías que empecemos a hacer?",
  short: "Lo que nos pedirían como junta directiva",
  options: [],
};
export const ABIERTA_MAX = 500;

export const QUESTIONS: Record<QuestionId, Question> = {
  R1,
  R2,
  P0,
  P1,
  P2,
  P3,
  P3b: P3B,
  P4,
  P5,
  ABIERTA,
};

// Orden en el resumen (s20) y en /stand/resultados.
export const SESSION_QUESTIONS: QuestionId[] = ["P0", "P1", "P2", "P3", "P3b", "P4", "P5"];

// Respuesta preparada de 20 segundos para cada freno de P5 (Adriana, minuto 24).
export const P5_ANSWERS: Record<string, string> = {
  precio:
    "Empezamos pequeño: un piloto con metas medibles antes de cualquier compromiso grande.",
  resultados:
    "Justo por eso publicamos lo que sale de cada encuentro. Les mandamos el caso [PEDIR: cliente del caso] y los resultados de esta sala.",
  escala:
    "Cada encuentro alimenta a Atenea e Intelligence: el conocimiento se acumula y se reutiliza en cada país sin empezar de cero.",
  proveedor:
    "No venimos a reemplazar: trabajamos con Canvas, BoodleBox y los aliados que ya tienen. Sumamos donde hay un hueco.",
  prioridad:
    "Entonces empecemos por lo que no cuesta: Atenea es abierta y el FIEd tiene un día virtual gratuito.",
  "no-entiendo": `Gracias, eso es lo más útil que nos pueden decir. En una frase: ${TWO_BRANDS} Y lo vamos a decir mejor.`,
};

// ---------------------------------------------------------------------------
// Atenea (s11): respuestas validadas, una por opción de P0.
// ---------------------------------------------------------------------------
export type AteneaAnswer = {
  reto: string;
  pregunta: string;
  respuesta: string;
  fuentes: string[];
};
export const ATENEA = ateneaJson as Record<"a" | "b" | "c" | "d" | "e", AteneaAnswer>;
export const ATENEA_LABEL = "Atenea · asistente de IA de InnKind";

// ---------------------------------------------------------------------------
// Tres puertas (sección 7, texto exacto)
// ---------------------------------------------------------------------------
export type DoorId = "0" | "1" | "2" | "3";
export type Door = {
  id: DoorId;
  title: string;
  short: string;
  text?: string; // en el celular (tú)
  tvText?: string; // en la pantalla, si cambia
  options?: Option[];
};

export const DOORS_PHRASE =
  "Durante 25 minutos nadie les pidió su nombre. Ahora sí, si quieren seguir con nosotros";

export const DOORS: Door[] = [
  {
    id: "1",
    title: "Puerta 1 · Trabajemos juntos",
    short: "Trabajemos juntos",
    options: [
      { id: "boodlebox", label: "Piloto de BoodleBox" },
      { id: "canvas", label: "Canvas: implementación o capacitación" },
      { id: "capacitacion-ia", label: "Capacitación en IA para docentes o equipos" },
      { id: "fied-pais", label: "FIEd o un encuentro en tu país" },
    ],
  },
  {
    id: "2",
    title: "Puerta 2 · Conozco a alguien",
    short: "Conozco a alguien",
    text: "Organización y cargo de la persona (sin su nombre ni su correo). Le mandamos a quien refiere un correo listo para reenviar.",
  },
  {
    id: "3",
    title: "Puerta 3 · Impulsa lo que viene",
    short: "Impulsa lo que viene",
    options: [
      { id: "patrocinar", label: "Patrocinar el FIEd 2027 (incluido InnKind Intelligence)" },
      {
        id: "invertir",
        label: "Invertir o cofinanciar un proyecto (Atenea, InnKind Intelligence, comunidad todo el año)",
      },
      { id: "cooperacion", label: "Cooperación o fondos (organismo o fundación)" },
    ],
  },
  {
    id: "0",
    title: "Puerta 0 · Todavía no",
    short: "Todavía no",
    text: "«Solo mándenme los resultados de esta sesión».",
  },
];

export const DOOR_TIMING_PROMPT = "¿Para cuándo?";
export const DOOR_TIMING: Option[] = [
  { id: "este-trimestre", label: "Este trimestre" },
  { id: "proximo-semestre", label: "Próximo semestre" },
  { id: "2027", label: "2027" },
];
export const DOOR_EVIDENCE_PROMPT =
  "¿Qué evidencia necesitaría quien decide (tú u otra persona)?";

export const CONSENTS = {
  contact: "Acepto que SenecaLab e InnKind me contacten sobre la opción que elegí.",
  results: "Quiero recibir los resultados de esta sesión.",
  news: "Quiero recibir novedades de InnKind (FIEd, webinars, comunidad).",
} as const;

export const PRIVACY_FOOTER =
  "Tus respuestas a las preguntas son anónimas y no se unen a estos datos. Tus datos los trata SenecaLab S.A. solo para lo que marcaste.";

// Topes de longitud (iguales o menores que los del SQL).
export const LIMITS = {
  name: 150,
  role: 150,
  org: 200,
  country: 100,
  email: 200,
  evidence: 600,
  referral_org: 200,
  referral_role: 150,
} as const;

// ---------------------------------------------------------------------------
// Pasos de la sesión (idénticos en la pantalla, el PowerPoint y el guion)
// ---------------------------------------------------------------------------
export type StepKind =
  | "slide"
  | "registro"
  | "question"
  | "atenea"
  | "resumen"
  | "puertas"
  | "gracias";
export type Act = "apertura" | "observamos" | "construimos" | "acompanamos" | "cierre";

export const ACTS: { id: Act; label: string }[] = [
  { id: "observamos", label: "Observamos" },
  { id: "construimos", label: "Construimos" },
  { id: "acompanamos", label: "Acompañamos" },
];
export const ACT_LABEL: Record<Act, string> = {
  apertura: "Apertura",
  observamos: "Acto 1 · Observamos",
  construimos: "Acto 2 · Construimos",
  acompanamos: "Acto 3 · Acompañamos",
  cierre: "Cierre",
};

export type Stat = { value: string; label: string };
export type Card = { tag?: string; title?: string; text: string; source?: string };
export type Quote = { text: string; author?: string };

// En cualquier texto: **negrita**, [PEDIR: …] y [APROBAR: …] (chips amarillos).
export type Step = {
  id: string; // s01…s22
  kind: StepKind;
  act: Act;
  minutes: string;
  label: string; // nombre corto del paso (guion)
  kicker?: string;
  title: string;
  lead?: string;
  statsTitle?: string;
  stats?: Stat[];
  cards?: Card[];
  lines?: string[];
  callout?: { label: string; text: string };
  quote?: Quote;
  footer?: string;
  sources?: string[];
  markers?: string[]; // p. ej. "[PEDIR: …]"
  questionIds?: QuestionId[];
  qr?: QrKey[];
};

export const STEPS: Step[] = [
  {
    id: "s01",
    kind: "slide",
    act: "apertura",
    minutes: "0:00-2:00",
    label: "Portada",
    kicker: "GET Forum 2026 · Quito",
    title: "Si casi todas las empresas ya usan IA, ¿por qué tan pocas ven resultados?",
    footer: BRAND_TEXT,
    qr: ["entrar"],
  },
  {
    id: "s02",
    kind: "slide",
    act: "apertura",
    minutes: "2:00-2:30",
    label: "Quiénes somos",
    kicker: BRAND_TEXT,
    title: "Quiénes somos",
    lead: TWO_BRANDS,
    cards: [
      { tag: "1", title: "Observamos", text: "el fenómeno (InnKind y el FIEd: 9 ediciones)." },
      {
        tag: "2",
        title: "Construimos",
        text: "productos para enfrentarlo (Atenea, la app de ideación, InnKind todo el año).",
      },
      {
        tag: "3",
        title: "Acompañamos",
        text: "a las instituciones: trabajamos, aprendemos, validamos y evolucionamos (SenecaLab en el aula y los aliados).",
      },
    ],
    footer: "«Queremos crítica, no aplausos» · «Sus respuestas son anónimas»",
  },
  {
    id: "s03",
    kind: "registro",
    act: "apertura",
    minutes: "2:30-3:00",
    label: "Registro",
    kicker: "Entren desde su celular",
    title: "¿Quiénes están en la sala?",
    lead: "Escaneen el código: son 2 toques y sus respuestas son anónimas.",
    questionIds: ["R1", "R2"],
    qr: ["entrar"],
  },
  {
    id: "s04",
    kind: "question",
    act: "apertura",
    minutes: "3:00-4:00",
    label: "P0 · asesoría",
    title: P0.prompt,
    questionIds: ["P0"],
    qr: ["entrar"],
  },
  {
    id: "s05",
    kind: "slide",
    act: "observamos",
    minutes: "4:00-5:00",
    label: "Dato del anfitrión",
    kicker: "GET Forum 2026",
    title: "El dato del anfitrión",
    stats: [
      { value: "80%", label: "de las empresas de América Latina usa inteligencia artificial" },
      { value: "23%", label: "reporta beneficios económicos concretos" },
    ],
    sources: [
      "Ignez Tristao, Grupo BID, en la presentación del GET Forum 2026 (Primicias, septiembre de 2026)",
    ],
    quote: {
      text: "El principal cuello de botella no es el financiamiento, sino las personas.",
      author: "Fernando Vargas, BID, en el FIEd",
    },
    footer: "Y las personas se forman en la educación superior. Ahí trabajamos nosotros.",
  },
  {
    id: "s06",
    kind: "slide",
    act: "observamos",
    minutes: "5:00-6:00",
    label: "9 ediciones",
    kicker: "InnKind y el FIEd",
    title: "Observamos el fenómeno",
    stats: [
      { value: "9", label: "ediciones del FIEd" },
      { value: "4", label: "países: Panamá, Colombia, Perú y Costa Rica" },
      { value: "1.200+", label: "participantes en el foro virtual: nuestro récord" },
    ],
    lines: [
      "**2024** · «Unleashing Human Power in the A.I. Era»",
      "**2025** · «Educación Hack: más datos, menos dogmas»",
      "**2026** · «La educación + allá: hacia una nueva arquitectura de la educación superior»",
    ],
    markers: [
      "[PEDIR: confirmar las 9 ediciones y el dato de 1.200+; número total de asistentes y de universidades]",
    ],
  },
  {
    id: "s07",
    kind: "slide",
    act: "observamos",
    minutes: "6:00-8:00",
    label: "Hallazgos A-D",
    kicker: "Lo que hemos observado",
    title: "Cuatro hallazgos",
    cards: FINDINGS.map((f) => ({ tag: f.id, text: f.text, source: f.source })),
    markers: ["[PEDIR: la edición del FIEd de cada cita A-C, para ponerla en la fuente]"],
  },
  {
    id: "s08",
    kind: "question",
    act: "observamos",
    minutes: "8:00-9:00",
    label: "P1 · feedback",
    title: P1.prompt,
    questionIds: ["P1"],
    qr: ["entrar"],
  },
  {
    id: "s09",
    kind: "slide",
    act: "observamos",
    minutes: "9:00-10:00",
    label: "Nuestra postura",
    kicker: "Nuestra postura",
    title: "Para qué existe la educación superior",
    quote: {
      text: "Creemos que la educación superior existe para formar personas capaces de pensar, decidir y crear valor con la IA, sin dejar a nadie atrás. Nuestro trabajo es ayudar a las instituciones a lograrlo con evidencia, no con dogmas.",
    },
    markers: ["[APROBAR: Adriana confirma la redacción]"],
  },
  {
    id: "s10",
    kind: "slide",
    act: "construimos",
    minutes: "10:00-11:00",
    label: "Revelación",
    kicker: "La app de ideación del FIEd: web, anónima y sin descarga",
    title: "Llevan 10 minutos usando un producto de InnKind",
    statsTitle: "En el FIEd Costa Rica 2026",
    stats: [
      { value: "89", label: "personas la usaron en vivo" },
      { value: "30", label: "momentos críticos eligieron las mesas" },
      { value: "59", label: "ideas escribieron" },
      { value: "44", label: "personas cerraron con su plan" },
    ],
    footer: "La IA agrupó las ideas durante el coffee break.",
  },
  {
    id: "s11",
    kind: "atenea",
    act: "construimos",
    minutes: "11:00-14:00",
    label: "Atenea",
    title: "Atenea",
    questionIds: ["P0"],
  },
  {
    id: "s12",
    kind: "question",
    act: "construimos",
    minutes: "14:00-15:00",
    label: "P2 · feedback",
    title: P2.prompt,
    questionIds: ["P2"],
    qr: ["entrar"],
  },
  {
    id: "s13",
    kind: "slide",
    act: "construimos",
    minutes: "15:00-17:00",
    label: "InnKind todo el año",
    kicker: "Más allá del foro",
    title: "InnKind todo el año",
    cards: [
      {
        title: "FIEd LATAM y FIEd país",
        text: "El próximo FIEd LATAM es en **mayo de 2027**.",
      },
      { title: "Webinars y comunidad", text: "**3 webinars al año** y una comunidad permanente." },
      {
        title: "Ruta de Transformación",
        text: "Para docentes y directivos: Curioso Digital → Líder de Innovación → Líder Transformador → Líder Promotor.",
      },
      { title: "Credenciales verificables", text: "En blockchain." },
      {
        title: "InnKind Intelligence",
        text: "Insights y análisis de lo que piensan y deciden los líderes de la educación superior, a partir de lo que pasa en nuestros encuentros. **Esta misma sesión es un ejemplo en pequeño.**",
      },
      {
        title: "Paquete de patrocinio 2027",
        text: "Niveles para empresas: bronce, plata, oro, platino y regional. Niveles de influencia para aliados (uno de ellos, InnKind Intelligence) y una experiencia digital.",
      },
    ],
  },
  {
    id: "s14",
    kind: "question",
    act: "construimos",
    minutes: "17:00-18:00",
    label: "P3 + P3b · asesoría",
    title: P3.prompt,
    questionIds: ["P3", "P3b"],
    qr: ["entrar"],
  },
  {
    id: "s15",
    kind: "slide",
    act: "acompanamos",
    minutes: "18:00-20:00",
    label: "SenecaLab en el aula",
    kicker: "SenecaLab",
    title: "SenecaLab en el aula",
    cards: [
      { title: "Canvas (Instructure)", text: "Implementación." },
      {
        title: "BoodleBox",
        text: "IA para docentes y estudiantes, con asistentes que guían sin dar la respuesta. Pilotos de **~200 usuarios**.",
      },
      { title: "Capacitación docente en IA", text: "A la medida de cada institución." },
      {
        title: "Analítica de datos",
        text: "Modelos predictivos de retención y empleabilidad.",
      },
    ],
    callout: {
      label: "Un caso",
      text: "[PEDIR: un caso de un cliente de SenecaLab con una cifra de resultado y permiso para nombrarlo]",
    },
  },
  {
    id: "s16",
    kind: "question",
    act: "acompanamos",
    minutes: "20:00-21:00",
    label: "P4 · asesoría",
    title: P4.prompt,
    questionIds: ["P4"],
    qr: ["entrar"],
  },
  {
    id: "s17",
    kind: "slide",
    act: "acompanamos",
    minutes: "21:00-22:30",
    label: "Aliados y testimonios",
    kicker: "Aliados que confiaron en nosotros",
    title: "Nos confiaron · Hicimos · Seguimos",
    lines: [
      "**Institucionales:** Fundación Qatar, EdLatam Alliance, CAF, UNESCO, BID, ONU.",
      "**EdTech** (patrocinadores de ediciones): Instructure/Canvas, Coursera, Turnitin, AWS, D2L, Wooclap, Symplicity, POK, McKinsey.",
    ],
    cards: [
      { title: "Nos confiaron", text: "[PEDIR: historia 1 e historia 2]" },
      { title: "Hicimos", text: "[PEDIR: historia 1 e historia 2]" },
      { title: "Seguimos", text: "[PEDIR: historia 1 e historia 2]" },
    ],
    quote: {
      text: "Inn.kind es un espacio único de reflexión, colaboración y exploración de ideas novedosas para el mejoramiento de la educación.",
      author:
        "Francisco Marmolejo, Consejo Asesor de InnKind (presidente de Educación Superior, Fundación Qatar)",
    },
    markers: [
      "[PEDIR: cuáles logos se pueden mostrar con permiso escrito]",
      "[PEDIR: T1, cliente de SenecaLab: texto, nombre, cargo, institución y permiso]",
      "[PEDIR: T2, speaker del FIEd: texto, nombre, cargo, institución y permiso]",
      "[PEDIR: T3, patrocinador de InnKind: texto, nombre, cargo, empresa y permiso]",
      "[PEDIR: T4, asistente del FIEd: texto, nombre, cargo, institución y permiso]",
    ],
  },
  {
    id: "s18",
    kind: "slide",
    act: "acompanamos",
    minutes: "22:30-23:00",
    label: "Lo cambiamos",
    kicker: "Trabajamos, aprendemos, validamos y evolucionamos",
    title: "Esto lo cambiamos porque nos lo dijeron",
    cards: [
      {
        title: "Nos dijeron",
        text: "En el ensayo del FIEd Costa Rica 2026, los facilitadores nos dijeron que las mesas se quedaban esperando a las demás.",
      },
      {
        title: "Lo cambiamos",
        text: "En una semana cambiamos la app para que cada mesa avanzara a su propio ritmo, y así se usó en el evento.",
      },
    ],
    callout: {
      label: "Otro ejemplo",
      text: "Los patrocinios 2027 se rediseñaron con lo que nos dijeron los patrocinadores (por ejemplo, el stand ya no es obligatorio para todos). [APROBAR: si Adriana lo aprueba]",
    },
  },
  {
    id: "s19",
    kind: "question",
    act: "acompanamos",
    minutes: "23:00-24:00",
    label: "P5 · feedback + abierta",
    title: P5.prompt,
    questionIds: ["P5", "ABIERTA"],
    qr: ["entrar"],
  },
  {
    id: "s20",
    kind: "resumen",
    act: "cierre",
    minutes: "24:00-25:00",
    label: "Cerrar el círculo",
    kicker: "Cerrar el círculo",
    title: "Lo que dijo la sala",
    questionIds: SESSION_QUESTIONS,
  },
  {
    id: "s21",
    kind: "puertas",
    act: "cierre",
    minutes: "25:00-29:00",
    label: "Tres puertas",
    kicker: "Ahora sí",
    title: "Tres puertas",
    lead: `«${DOORS_PHRASE}».`,
    qr: ["entrar"],
  },
  {
    id: "s22",
    kind: "gracias",
    act: "cierre",
    minutes: "29:00-30:00",
    label: "Gracias",
    kicker: BRAND_TEXT,
    title: "Gracias",
    qr: ["atenea", "resultados"],
  },
];

// Paso 0 = antes de empezar; 1…22 = s01…s22; 23 = la sesión terminó.
export const PRE_STEP = 0;
export const END_STEP = STEPS.length + 1;

export function stepAt(n: number): Step | null {
  if (!Number.isInteger(n) || n < 1 || n > STEPS.length) return null;
  return STEPS[n - 1];
}

// Número de la pregunta en pantalla ("Pregunta 1 de 6").
export const NUMBERED_QUESTIONS: QuestionId[] = ["P0", "P1", "P2", "P3", "P4", "P5"];

// Cómo se muestra una opción: letra en círculo (P0 a-e; hallazgos A-D de P1)
// y la etiqueta. En P1 la etiqueta del hallazgo es su texto completo.
export function displayOption(q: Question, o: Option): { letter: string | null; label: string } {
  if (q.id === "P0") return { letter: o.id, label: o.label };
  if (o.detail && /^[A-D]$/.test(o.label)) return { letter: o.label, label: o.detail };
  return { letter: null, label: o.label };
}

export function optionLabel(q: Question, id: string): string {
  const o = q.options.find((x) => x.id === id);
  if (!o) return id;
  return o.detail ? `${o.label} · ${o.detail.replace(/\*\*/g, "")}` : o.label;
}
