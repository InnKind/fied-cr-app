// Configuración del evento (config-driven).
// Editá aquí las preguntas, temas y roles: la app los lee desde este archivo.
// Fuente: docs/preguntas-y-temas.md. En rojo del documento = confirmado.
// NOTA: la lista de ROLES es PROVISIONAL — falta la lista final del equipo.

export type Role = {
  id: string;
  label: string;
  color: string; // color del gafete/badge
};

export type Topic = {
  id: string;
  title: string;
  question: string;
  context?: string;
};

export type RoundQuestion = {
  id: string;
  prompt: string;
};

// --- Roles / sectores (PROVISIONAL — confirmar lista final con el equipo) ---
export const ROLES: Role[] = [
  { id: "docente", label: "Docente / Profesor", color: "#2563eb" },
  { id: "estudiante", label: "Estudiante", color: "#16a34a" },
  { id: "sector-productivo", label: "Sector productivo / Empresa", color: "#ea580c" },
  { id: "admin-universitario", label: "Administrador universitario (rector, vicerrector…)", color: "#7c3aed" },
  { id: "regulador", label: "Regulador / Aseguramiento de calidad", color: "#dc2626" },
  { id: "gobierno", label: "Gobierno", color: "#0d9488" },
];

// --- Temas de la Ronda 2 (4 confirmados; se puede agregar un 5º sin romper nada) ---
export const TOPICS: Topic[] = [
  {
    id: "aula",
    title: "La experiencia en el aula",
    question:
      "¿Cómo podríamos rediseñar una experiencia universitaria concreta para que el estudiante tome más decisiones sobre su aprendizaje, utilice la IA con criterio y demuestre capacidades que hoy no se observan adecuadamente?",
    context:
      "Modelo basado en la agencia del estudiante y la colaboración docente + IA. Ej.: una clase de 90 minutos con 25 estudiantes.",
  },
  {
    id: "organizacional",
    title: "El modelo organizacional de la universidad",
    question:
      "¿Cómo podría una universidad reorganizar procesos, roles e incentivos para actualizar continuamente su oferta y responder con mayor velocidad a los cambios tecnológicos y sociales?",
    context:
      "La universidad como espacio de aprendizaje continuo. Innovación, plan de acción, cambio organizacional.",
  },
  {
    id: "calidad",
    title: "Impulso de calidad del sistema",
    question:
      "¿Qué evidencia mínima común permitiría reconocer, comparar y mejorar la calidad de los aprendizajes sin aumentar innecesariamente la burocracia institucional?",
    context:
      "Qué y cómo medir, y cómo compartirlo. Resultado, no proceso. Mejora continua entre todas las universidades.",
  },
  {
    id: "oferta",
    title: "Alinear la oferta con la demanda",
    question:
      "¿Cómo podría Costa Rica detectar cambios en la demanda de capacidades y traducirlos oportunamente en decisiones de oferta, currículo, microcredenciales y orientación estudiantil?",
    context: "Nuevos formatos, los contenidos correctos, nueva oferta en 90 días.",
  },
];

// --- Preguntas por ronda ---
export const ROUND_1_QUESTION: RoundQuestion = {
  id: "r1",
  prompt:
    "¿Qué tendría que ser observable en estudiantes, docentes, instituciones y empleadores para afirmar que Costa Rica ofrece educación superior de calidad en la era de la IA?",
};

// Ronda 2: la pregunta depende del tema escogido (ver TOPICS).

export const ROUND_3_QUESTIONS: RoundQuestion[] = [
  {
    id: "r3-1",
    prompt:
      "¿Qué aspectos de la experiencia de aprendizaje que tuvimos juntos esta tarde podrían ser adoptados en las aulas universitarias?",
  },
  {
    id: "r3-2",
    prompt:
      "Con base en las conversaciones, ¿cuáles son los cambios concretos que quisieras hacer a la forma en la que abordás tu rol en el sistema de educación superior? ¿Qué acciones querés tomar en las siguientes 2 semanas?",
  },
];

export const EVENT = {
  name: "Inn.Kind · FIEd Costa Rica",
  exerciseTitle: "Ejercicio de Prototipado",
  tableSize: 8,
  numberOfTables: 32, // configurable: ~20 mesas reales; 32 cubre hasta ~250 personas
};
