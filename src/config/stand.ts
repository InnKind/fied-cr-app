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
// aprobado por Adriana el 28-sep). Si llega el enlace del aviso de las
// inscripciones del FIEd, se puede poner aquí. Con null, el pie muestra el
// marcador [PEDIR] en amarillo.
export const PRIVACY_URL: string | null = "/stand/privacidad";

// Espacio que no se corta al final de la línea (p. ej. «7.000 usuarios» en una sola línea).
export const NBSP = String.fromCharCode(160);

export const BRAND_TEXT = "SenecaLab · InnKind";
export const NAVY = "#223c5d";
export const RED = "#c9283f";

// Logos de las marcas (carpeta logos/ de los entregables, copiados a public/stand/logos).
// Son BLANCOS con fondo transparente: solo sobre fondos oscuros (la TV).
export const LOGOS = {
  senecalab: {
    src: "/stand/logos/senecalab-horizontal-blanco.png",
    alt: "SenecaLab: Expertos en know how",
    width: 1561,
    height: 666,
  },
  innkind: {
    src: "/stand/logos/innkind-blanco-puntos-color.png",
    alt: "InnKind: Innovation, Human, Education",
    width: 2422,
    height: 766,
  },
} as const;

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
    source: "Karlo Mondragón, Grupo Salinas, en el FIEd 2025",
  },
  {
    id: "B",
    text: "**Más del 75% de los estudiantes** siente que no podría terminar un trabajo sin IA.",
    source: "Turnitin, presentado en el FIEd 2026",
  },
  {
    id: "C",
    text: "Solo el **0,04% de las patentes de IA** son de América Latina: nuestra ventaja no es inventar, es **adoptar**.",
    source: "Víctor Morales, CENIA, en el FIEd 2025",
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
    `Justo por eso publicamos lo que sale de cada encuentro. En UNIVO habilitamos a 7.000${NBSP}usuarios; a la Universidad Central de Panamá la acompañamos desde su creación. Les mandamos esos casos y los resultados de esta sala.`,
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

// Pie del formulario (sección 7). La línea de los datos fuera de Ecuador la aprobó
// Adriana el 28-sep y es la misma del talón del tríptico.
export const PRIVACY_FOOTER =
  "Tus respuestas a las preguntas son anónimas y no se unen a estos datos. Tus datos los trata SenecaLab S.A. solo para lo que marcaste. Tus datos se guardan en servicios en la nube cuyos servidores pueden estar fuera de Ecuador.";

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
// Una tarjeta lleva `text` o, si tiene partes con su rótulo (p. ej. «Nos dijeron» /
// «Lo cambiamos»), `rows`.
export type Card = {
  tag?: string;
  title?: string;
  text?: string;
  rows?: { label: string; text: string }[];
  source?: string;
};
// `tag`: rótulo corto sobre la cita (p. ej. la marca a la que habla el testimonio).
export type Quote = { text: string; author?: string; tag?: string };

// Un caso de SenecaLab (sección 5). `value` es la cifra grande (solo el caso principal).
export type Case = {
  id: "C1" | "C2" | "C3" | "C4" | "C5";
  tag: string; // rótulo pequeño: «Caso · país»
  name: string;
  value?: string;
  valueLabel?: string;
  text: string;
  points?: string[];
  quote?: Quote;
};

// ---------------------------------------------------------------------------
// Testimonios (sección 5): citas TEXTUALES del contenido maestro, que las tomó de
// los videos del 28-sep (con su minuto) y de la cita escrita de Lupita Humbert.
// No se editan aquí: si cambian, se cambian primero en el maestro.
// ---------------------------------------------------------------------------
export const TESTIMONIALS = {
  // Video UNIVO, [00:39]. Va en s15, junto al caso.
  T1: {
    text: "Una nueva plataforma de aprendizaje permite la innovación, la modernización del sistema de enseñanza aprendizaje",
    author: "María Luisa Sevillano, vicerrectora académica, Universidad de Oriente (UNIVO)",
    tag: "SenecaLab",
  },
  // Cita escrita (versión corta). Va en s17.
  T2: {
    text: "Sin duda, nuestro proyecto no hubiera sido posible sin el apoyo de SenecaLab",
    author: "Lupita Humbert, cofundadora, Universidad Central de Panamá",
    tag: "SenecaLab",
  },
  // Video SPEAKER, [00:00]. Va en s17.
  T3: {
    text: "Este evento lo que tiene como diferenciador único es esta conversación que integra el sector empresarial, gobierno, universidad pública, privada y diferentes países",
    author: "Fernando Valenzuela, Co-Steward en Integrans (speaker del FIEd)",
    tag: "InnKind",
  },
} satisfies Record<string, Quote>;
// T4 (Mauricio Bernal) y T5 (Juan Camilo Páez) van solo en las notas del guion.

// ---------------------------------------------------------------------------
// Casos de SenecaLab (sección 5; Excel de Marcela del 28-sep). Solo las cifras
// del maestro: no se inventa ninguna.
// ---------------------------------------------------------------------------
export const CASES: Case[] = [
  {
    id: "C1",
    tag: "Caso · El Salvador",
    name: "Universidad de Oriente (UNIVO)",
    value: "7.000",
    valueLabel: "usuarios habilitados",
    // Texto corto del caso (máx. 20 palabras), tal cual el maestro.
    text: "Primera universidad de LATAM que usa Canvas con Intelligent Insights desde el inicio, y rúbricas con trazabilidad de competencias directivas",
    quote: { text: TESTIMONIALS.T1.text, author: "María Luisa Sevillano, vicerrectora académica" },
  },
  {
    id: "C2",
    tag: "Caso · Panamá",
    name: "Universidad Central de Panamá",
    text: "Acompañamos su creación ante la regulación panameña.",
    points: [
      "**4** programas curriculares",
      "**1** expediente institucional estructurado",
      "Documentación organizada y digitalizada para **MEDUCA** y entidades regulatorias",
    ],
  },
];

// C3 (RedTec LATAM), C4 (QLU) y C5 (OTEIMA): el Excel no da permiso explícito para
// nombrarlas. La pantalla es pública, así que van ANÓNIMAS, con la forma que fija
// el maestro. Si Marcela o Adriana confirman el permiso, aquí se ponen los nombres.
export const CASES_ANON = {
  title: "También acompañamos a",
  items: [
    "**Una red regional de educación técnica en 7 países:** impulsamos su expansión, con 4 instituciones vinculadas y un alcance de ~115.000 estudiantes.",
    "**Una universidad privada en Panamá:** diseñamos con expertos y el sector productivo un programa internacional de Derecho.",
    "**Otra universidad privada en Panamá:** convertimos su estrategia institucional en un plan operativo con indicadores y metas cuantificables.",
  ],
};

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
  callout?: { label: string; text: string }; // recuadro destacado
  quote?: Quote;
  quotes?: Quote[]; // varias citas lado a lado (en vez de `quote`)
  cases?: Case[]; // el primero es el caso principal (con la cifra grande)
  casesMore?: { title: string; items: string[] }; // casos sin nombre, en una lista corta
  logos?: boolean; // logos de las dos marcas (solo en pantallas de fondo oscuro)
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
    logos: true,
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
      text: "El principal cuello de botella para incorporar inteligencia artificial en las empresas son las personas, en sus distintos niveles de formación.",
      author: "Fernando Vargas, BID, en el FIEd LATAM 2026",
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
        text: `IA para docentes y estudiantes, con asistentes que guían sin dar la respuesta. Pilotos de **~200${NBSP}usuarios**.`,
      },
      { title: "Capacitación docente en IA", text: "A la medida de cada institución." },
      {
        title: "Analítica de datos",
        text: "Modelos predictivos de retención y empleabilidad.",
      },
    ],
    // Caso principal: UNIVO, con 7.000 como número grande y T1 (la vicerrectora).
    // Segundo caso: la Universidad Central de Panamá. C3-C5, anónimos.
    cases: CASES,
    casesMore: CASES_ANON,
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
    minutes: "21:00-22:15",
    label: "Aliados y testimonios",
    kicker: "Nos confiaron",
    title: "Aliados que confiaron en nosotros",
    lines: [
      "**Institucionales:** Fundación Qatar, EdLatam Alliance, CAF, UNESCO, BID, ONU.",
      `**EdTech** (patrocinadores de ediciones): Instructure/Canvas, Coursera, Turnitin, AWS, D2L, Wooclap, Symplicity, POK, McKinsey, Open${NBSP}LMS.`,
    ],
    // Testimonios en pantalla (sección 5): T2 (cliente de SenecaLab) y T3 (speaker
    // del FIEd, InnKind). T4 (Bernal) y T5 (Páez) van en las notas del guion.
    quotes: [TESTIMONIALS.T2, TESTIMONIALS.T3],
    // Lo único pendiente de esta pantalla.
    markers: ["[PEDIR: cuáles logos de aliados se pueden mostrar con permiso escrito]"],
  },
  {
    id: "s18",
    kind: "slide",
    act: "acompanamos",
    minutes: "22:15-23:00",
    label: "Lo cambiamos",
    kicker: "Trabajamos, aprendemos, validamos y evolucionamos",
    title: "Esto lo cambiamos porque nos lo dijeron",
    // Dos ejemplos (el segundo, aprobado por Adriana el 27-sep; en pantalla va
    // su versión corta: la larga está en el contenido maestro, sección 5).
    cards: [
      {
        tag: "1",
        rows: [
          {
            label: "Nos dijeron",
            text: "En el ensayo del FIEd Costa Rica 2026, los facilitadores nos dijeron que las mesas se quedaban esperando a las demás.",
          },
          {
            label: "Lo cambiamos",
            text: "En una semana cambiamos la app para que cada mesa avanzara a su propio ritmo, y así se usó en el evento.",
          },
        ],
      },
      {
        tag: "2",
        rows: [
          {
            label: "Nos dijeron",
            text: "Los patrocinadores nos dijeron qué les servía y qué no de patrocinar un FIEd.",
          },
          {
            label: "Lo cambiamos",
            text: "Patrocinios 2027: stand opcional, sin videos obligatorios, presencia todo el año, datos por intereses e InnKind Intelligence.",
          },
        ],
      },
    ],
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
    // Adriana muestra lo más votado de cada pregunta y responde el freno n.° 1
    // de P5 con su respuesta de 20 s (P5_ANSWERS). Se llena sola con los votos.
    label: "Lo que dijo la sala",
    kicker: "Resultados en vivo",
    title: "Lo que dijo la sala",
    lead: "La respuesta más votada de cada pregunta",
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
    logos: true,
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
