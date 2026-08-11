// SOLO servidor: usa la GEMINI_API_KEY secreta. NO importar desde componentes cliente.
const API = "https://generativelanguage.googleapis.com/v1beta/models";

// Modelo(s) principal(es) desde el entorno + respaldos por si alguno está
// sobrecargado (503) o no disponible. Se prueban en orden.
const PRIMARY = (process.env.GEMINI_MODEL || "gemini-flash-latest")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const FALLBACKS = ["gemini-2.0-flash", "gemini-flash-lite-latest", "gemini-2.5-flash-lite"];
const MODELS = [...new Set([...PRIMARY, ...FALLBACKS])];

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// Llamada genérica a Gemini con reintentos + modelos de respaldo. Devuelve el texto.
export async function geminiGenerate(
  prompt: string,
  opts: { json?: boolean; temperature?: number } = {}
): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("Falta GEMINI_API_KEY en el servidor.");

  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      ...(opts.json ? { responseMimeType: "application/json" } : {}),
      temperature: opts.temperature ?? 0.3,
    },
  });

  let lastErr = "sin intentos";
  for (const model of MODELS) {
    for (let attempt = 0; attempt < 3; attempt++) {
      let res: Response;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000); // 30s máx por intento
      try {
        res = await fetch(`${API}/${model}:generateContent?key=${key}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          signal: controller.signal,
        });
      } catch (e) {
        lastErr = `${model}: red/timeout (${e instanceof Error ? e.message : "?"})`;
        await sleep(600 * (attempt + 1));
        continue;
      } finally {
        clearTimeout(timeout);
      }

      if (res.ok) {
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return text as string;
        lastErr = `${model}: sin texto`;
        break; // probar siguiente modelo
      }

      lastErr = `${model}: HTTP ${res.status}`;
      if (res.status === 503 || res.status === 429 || res.status === 500) {
        await sleep(800 * (attempt + 1));
        continue;
      }
      break; // otro error -> probar siguiente modelo
    }
  }

  throw new Error(`Gemini no disponible. Último error: ${lastErr}`);
}

export type Theme = { title: string; description: string; count: number };
export type Synthesis = { themes: Theme[]; total: number };

// Toma las respuestas abiertas de una ronda y las agrupa en 3-5 temas comunes.
export async function synthesizeResponses(
  question: string,
  answers: string[]
): Promise<Synthesis> {
  const listado = answers.map((a, i) => `${i + 1}. ${a}`).join("\n");
  const prompt =
    `Sos un analista experto de un foro de educación superior. ` +
    `Te doy varias respuestas de participantes a esta pregunta:\n\n` +
    `Pregunta: ${question}\n\n` +
    `Respuestas de los participantes (${answers.length} en total):\n${listado}\n\n` +
    `Agrupá las respuestas en 3 a 5 temas comunes (no más). Para cada tema: un título ` +
    `corto (máx 6 palabras), una descripción de una línea, y cuántas respuestas encajan ` +
    `(aprox; deben sumar alrededor del total). Ordená por frecuencia (mayor primero). ` +
    `Devolvé SOLO JSON válido con esta forma exacta: ` +
    `{"themes":[{"title":"...","description":"...","count":0}],"total":${answers.length}}. ` +
    `Sin texto fuera del JSON.`;

  const text = await geminiGenerate(prompt, { json: true });
  return JSON.parse(text) as Synthesis;
}

// ---- Procesamiento de la Ronda 1 (diseño 2 rondas, coffee break) ----

export type MomentInput = {
  table: number | null;
  text: string;
  aiIdeas: string[];
  agencyIdeas: string[];
};

export type IdeaTriple = {
  mostRepeated: string;
  easiest: string;
  mostDisruptive: string;
};

export type Slide = {
  moment: string;
  tables: number;
  ai: IdeaTriple;
  agency: IdeaTriple;
};

// Toma los momentos de un TEMA (de varias mesas) con sus ideas de IA y Agency,
// agrupa los equivalentes y arma una diapositiva por momento con 3 ideas de IA
// y 3 de Agency según los criterios: más repetida / más fácil / más disruptiva.
export async function processRound1(
  themeTitle: string,
  moments: MomentInput[]
): Promise<{ slides: Slide[] }> {
  const block = moments
    .map((m, i) => {
      const ai = m.aiIdeas.length
        ? m.aiIdeas.map((x) => `      - ${x}`).join("\n")
        : "      (sin ideas de IA)";
      const ag = m.agencyIdeas.length
        ? m.agencyIdeas.map((x) => `      - ${x}`).join("\n")
        : "      (sin ideas de Agency)";
      return `Momento ${i + 1} (Mesa ${m.table ?? "?"}): ${m.text}\n    Ideas de IA:\n${ai}\n    Ideas de Agency:\n${ag}`;
    })
    .join("\n\n");

  const prompt =
    `Eres un analista experto de un foro de educación superior (FIED). ` +
    `Tema: "${themeTitle}".\n\n` +
    `Estos son los "momentos" que varias mesas identificaron para rediseñar, con las ideas ` +
    `que la gente escribió en dos dimensiones: IA (cómo integrar mejor la inteligencia ` +
    `artificial) y Agency (cómo dar más autonomía, voz o decisión al actor).\n\n` +
    `${block}\n\n` +
    `Tu tarea:\n` +
    `1. AGRUPA los momentos que son esencialmente el mismo aunque estén dichos con palabras ` +
    `distintas (p. ej. "elegir mis cursos" y "decidir qué materias estudiar" son el mismo). ` +
    `Dale a cada grupo un título corto y claro.\n` +
    `2. Para cada grupo, indica en cuántas MESAS distintas apareció ("tables").\n` +
    `3. Para cada grupo, elige HASTA 3 ideas de IA y HASTA 3 de Agency, TOMADAS de las ideas ` +
    `escritas para ese momento, según: "mostRepeated" (la más común), "easiest" (la más fácil de ` +
    `implementar) y "mostDisruptive" (la más radical/transformadora). REGLAS IMPORTANTES: ` +
    `(a) las tres ideas de cada dimensión deben ser DISTINTAS entre sí; NUNCA repitas la misma ` +
    `idea (ni una versión apenas reformulada) en más de un criterio. ` +
    `(b) Si para ese momento hay menos de 3 ideas distintas y con sustancia, llena solo los ` +
    `criterios que puedas con ideas reales y deja los demás como cadena vacía "". Es mejor ` +
    `mostrar 1 idea buena que 3 repetidas o de relleno. ` +
    `(c) NO inventes ideas que nadie escribió; puedes parafrasear para que sean breves y claras.\n` +
    `4. Ordena los grupos por número de mesas (más repetidos primero) y luego por riqueza (los ` +
    `que tienen ideas en ambas dimensiones primero).\n\n` +
    `Responde en español latinoamericano neutro. Devuelve SOLO JSON con esta forma exacta:\n` +
    `{"slides":[{"moment":"...","tables":0,"ai":{"mostRepeated":"...","easiest":"...","mostDisruptive":"..."},"agency":{"mostRepeated":"...","easiest":"...","mostDisruptive":"..."}}]}\n` +
    `Sin texto fuera del JSON.`;

  // La IA a veces devuelve JSON válido pero con OTRA forma (sin el arreglo
  // "slides"). Validamos la forma y reintentamos para no dejar un tema vacío.
  let lastErr = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    const text = await geminiGenerate(prompt, { json: true });
    try {
      const parsed = JSON.parse(text) as { slides?: Slide[] } | Slide[];
      const slides = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.slides)
          ? parsed.slides
          : null;
      if (slides) return { slides };
      lastErr = "la respuesta no traía un arreglo 'slides'";
    } catch (e) {
      lastErr = e instanceof Error ? e.message : "JSON inválido";
    }
  }
  throw new Error(
    `processRound1 no pudo interpretar la respuesta de la IA: ${lastErr}`
  );
}

// ---- Agregación de la Ronda 2 (reflexión) ----

export type Round2Aggregation = {
  topRoles: { role: string; count: number }[];
  experiences: IdeaTriple;
};

// Para un TEMA: agrupa los roles-a-involucrar equivalentes (con conteo) y
// resume las experiencias por los 3 criterios (más repetida/fácil/disruptiva).
export async function processRound2(
  themeTitle: string,
  roles: string[],
  experiences: string[]
): Promise<Round2Aggregation> {
  const rolesBlock = roles.length
    ? roles.map((r) => `  - ${r}`).join("\n")
    : "  (ninguno)";
  const expBlock = experiences.length
    ? experiences.map((e, i) => `  ${i + 1}. ${e}`).join("\n")
    : "  (ninguna)";

  const prompt =
    `Eres un analista de un foro de educación superior (FIED). Tema: "${themeTitle}".\n\n` +
    `Los participantes que quieren accionar este tema indicaron los ROLES que necesitan ` +
    `involucrar y una EXPERIENCIA que diseñarían para inspirarlos.\n\n` +
    `ROLES a involucrar (escritos por la gente; pueden repetirse con otras palabras):\n` +
    `${rolesBlock}\n\n` +
    `EXPERIENCIAS propuestas:\n${expBlock}\n\n` +
    `Tu tarea:\n` +
    `1. Agrupa los ROLES equivalentes (p. ej. "Decano", "Decano/a" y "Dean" son el mismo) ` +
    `y cuenta cuántas veces aparece cada uno. Devuelve los más frecuentes primero (máx 6).\n` +
    `2. De las EXPERIENCIAS elige HASTA 3 según: "mostRepeated" (la más común), "easiest" (la ` +
    `más fácil de implementar) y "mostDisruptive" (la más radical). Las tres deben ser DISTINTAS ` +
    `entre sí; NUNCA repitas la misma experiencia (ni apenas reformulada) en más de un criterio. ` +
    `Si hay menos de 3 experiencias distintas y con sustancia, deja los demás campos como "". ` +
    `Parafrasea breve; no inventes.\n\n` +
    `Responde en español latinoamericano neutro. Devuelve SOLO JSON con esta forma exacta:\n` +
    `{"topRoles":[{"role":"...","count":0}],"experiences":{"mostRepeated":"...","easiest":"...","mostDisruptive":"..."}}\n` +
    `Sin texto fuera del JSON.`;

  const text = await geminiGenerate(prompt, { json: true });
  return JSON.parse(text) as Round2Aggregation;
}
