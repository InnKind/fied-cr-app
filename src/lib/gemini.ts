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

// La IA a veces devuelve un criterio como arreglo, número o null. Las vistas
// hacen `.trim()` sobre estos valores, así que se normalizan SIEMPRE a texto.
function asText(v: unknown): string {
  if (typeof v === "string") return v;
  if (Array.isArray(v))
    return v.filter((x) => typeof x === "string" && x.trim()).join(" · ");
  if (typeof v === "number") return String(v);
  return "";
}

export function asTriple(v: unknown): IdeaTriple {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  return {
    mostRepeated: asText(o.mostRepeated),
    easiest: asText(o.easiest),
    mostDisruptive: asText(o.mostDisruptive),
  };
}

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
  moments: MomentInput[],
  // Las 2 preguntas EXACTAS que se le hicieron a la gente en este tema
  // (empoderamiento e IA). Sin ellas la IA interpreta las dimensiones a ciegas.
  questions?: { agency: string; ai: string }
): Promise<{ slides: Slide[] }> {
  const block = moments
    .map((m, i) => {
      const ai = m.aiIdeas.length
        ? m.aiIdeas.map((x) => `      - ${x}`).join("\n")
        : "      (sin ideas de IA)";
      const ag = m.agencyIdeas.length
        ? m.agencyIdeas.map((x) => `      - ${x}`).join("\n")
        : "      (sin ideas de empoderamiento)";
      return `Momento ${i + 1} (Mesa ${m.table ?? "?"}): ${m.text}\n    Ideas de Empoderamiento:\n${ag}\n    Ideas de IA:\n${ai}`;
    })
    .join("\n\n");

  const prompt =
    `Eres un analista experto de un foro de educación superior (FIED). ` +
    `Tema: "${themeTitle}".\n\n` +
    `Estos son los "momentos" que varias mesas identificaron para rediseñar, con las ideas ` +
    `que la gente escribió en dos dimensiones: EMPODERAMIENTO e IA.\n` +
    (questions
      ? `Las preguntas exactas que se les hicieron fueron:\n` +
        `- EMPODERAMIENTO: "${questions.agency}"\n` +
        `- IA: "${questions.ai}"\n\n`
      : `EMPODERAMIENTO = cómo darle al actor de ese momento más autonomía, voz o poder de ` +
        `decisión; IA = cómo aprovechar la inteligencia artificial en ese momento.\n\n`) +
    `${block}\n\n` +
    `Tu tarea:\n` +
    `1. AGRUPA los momentos que son esencialmente el mismo aunque estén dichos con palabras ` +
    `distintas (p. ej. "elegir mis cursos" y "decidir qué materias estudiar" son el mismo). ` +
    `Dale a cada grupo un título corto y claro.\n` +
    `2. Para cada grupo, indica en cuántas MESAS distintas apareció ("tables").\n` +
    `3. Para cada grupo, elige HASTA 3 ideas de empoderamiento (campo "agency") y HASTA 3 de ` +
    `IA (campo "ai"), TOMADAS de las ideas ` +
    `escritas para ese momento, según: "mostRepeated" (la más común), "easiest" (la más fácil de ` +
    `implementar) y "mostDisruptive" (la más radical/transformadora). REGLAS IMPORTANTES: ` +
    `(a) las tres ideas de cada dimensión deben ser DISTINTAS entre sí; NUNCA repitas la misma ` +
    `idea (ni una versión apenas reformulada) en más de un criterio. ` +
    `(b) Si para ese momento hay menos de 3 ideas distintas y con sustancia, llena solo los ` +
    `criterios que puedas con ideas reales y deja los demás como cadena vacía "". Es mejor ` +
    `mostrar 1 idea buena que 3 repetidas o de relleno. ` +
    `(c) ESCRIBE CADA IDEA EN 1 O 2 ORACIONES COMPLETAS (unas 15 a 35 palabras), no en una ` +
    `frase suelta: la primera dice QUÉ se hace y la segunda QUÉ CAMBIA para la persona de ese ` +
    `momento. Quien la lea proyectada debe entenderla sin más contexto. ` +
    `(d) NO inventes ideas que nadie escribió ni agregues propuestas nuevas: puedes completar ` +
    `y ordenar la redacción para que se entienda, pero el contenido debe salir de lo que ` +
    `escribieron las mesas. Si una idea vino en 2 palabras y no se entiende qué propone, ` +
    `prefiere dejar el criterio vacío antes que rellenarlo con algo que nadie dijo.\n` +
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
      if (slides)
        return {
          // Normaliza los 6 criterios de cada diapositiva: la presentación hace
          // .trim() sobre ellos y un arreglo/null rompería el deck en vivo.
          slides: slides.map((s) => ({
            ...s,
            ai: asTriple(s?.ai),
            agency: asTriple(s?.agency),
          })),
        };
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
  // Ideas motivadoras agrupadas (Cambio #1): "¿con qué idea te sientes
  // motivado/a a empezar?" — la IA junta las parecidas con su conteo.
  topIdeas: { idea: string; count: number }[];
  // Las mismas ideas resumidas por los 3 criterios (más mencionada / más fácil
  // de implementar / más disruptiva), igual que las experiencias.
  ideaCriteria: IdeaTriple;
};

// Para un TEMA: agrupa los roles-a-involucrar equivalentes (con conteo), las
// ideas motivadoras parecidas (con conteo) y resume las experiencias por los 3
// criterios (más repetida/fácil/disruptiva).
export async function processRound2(
  themeTitle: string,
  roles: string[],
  experiences: string[],
  ideas: string[]
): Promise<Round2Aggregation> {
  const rolesBlock = roles.length
    ? roles.map((r) => `  - ${r}`).join("\n")
    : "  (ninguno)";
  const expBlock = experiences.length
    ? experiences.map((e, i) => `  ${i + 1}. ${e}`).join("\n")
    : "  (ninguna)";
  const ideasBlock = ideas.length
    ? ideas.map((x) => `  - ${x}`).join("\n")
    : "  (ninguna)";

  const prompt =
    `Eres un analista de un foro de educación superior (FIED). Tema: "${themeTitle}".\n\n` +
    `Los participantes que quieren accionar este tema indicaron: una IDEA con la que se ` +
    `sienten motivados a empezar, las PERSONAS (roles) que necesitan involucrar, y un ` +
    `SIGUIENTE PASO que darían para inspirar a esas personas a involucrarse.\n\n` +
    `IDEAS con las que quieren empezar (escritas por la gente; pueden repetirse con otras palabras):\n` +
    `${ideasBlock}\n\n` +
    `ROLES a involucrar (pueden repetirse con otras palabras):\n${rolesBlock}\n\n` +
    `SIGUIENTES PASOS propuestos:\n${expBlock}\n\n` +
    `Tu tarea:\n` +
    `1. Agrupa las IDEAS equivalentes (aunque estén dichas con otras palabras) y cuenta ` +
    `cuántas veces aparece cada una. Devuelve las más frecuentes primero (máx 6). No inventes.\n` +
    `2. De esas mismas IDEAS elige HASTA 3 en "ideaCriteria" según: "mostRepeated" (la más ` +
    `mencionada), "easiest" (la más fácil de implementar) y "mostDisruptive" (la más radical). ` +
    `Las tres deben ser DISTINTAS entre sí; NUNCA repitas la misma idea (ni apenas reformulada) ` +
    `en más de un criterio. Si hay menos de 3 ideas distintas y con sustancia, deja los demás ` +
    `campos como "". Parafrasea breve; no inventes.\n` +
    `3. Agrupa los ROLES equivalentes (p. ej. "Decano", "Decano/a" y "Dean" son el mismo) ` +
    `y cuenta cuántas veces aparece cada uno. Devuelve los más frecuentes primero (máx 6).\n` +
    `4. De los SIGUIENTES PASOS elige HASTA 3 (campo "experiences") según: "mostRepeated" (el ` +
    `más común), "easiest" (el más fácil de implementar) y "mostDisruptive" (el más radical). ` +
    `Los tres deben ser DISTINTOS entre sí; NUNCA repitas el mismo paso (ni apenas reformulado) ` +
    `en más de un criterio. Si hay menos de 3 pasos distintos y con sustancia, deja los demás ` +
    `campos como "". Parafrasea breve; no inventes.\n\n` +
    `Responde en español latinoamericano neutro. Devuelve SOLO JSON con esta forma exacta:\n` +
    `{"topIdeas":[{"idea":"...","count":0}],"ideaCriteria":{"mostRepeated":"...","easiest":"...","mostDisruptive":"..."},"topRoles":[{"role":"...","count":0}],"experiences":{"mostRepeated":"...","easiest":"...","mostDisruptive":"..."}}\n` +
    `Sin texto fuera del JSON.`;

  // Igual que processRound1: la IA a veces devuelve JSON válido con otra forma.
  // Validamos que traiga 'topRoles' (arreglo) y reintentamos; normalizamos
  // 'experiences' a un objeto para no romper a quien lo consuma.
  let lastErr = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    const text = await geminiGenerate(prompt, { json: true });
    try {
      const parsed = JSON.parse(text) as Partial<Round2Aggregation>;
      // Se acepta si trae AL MENOS uno de los campos esperados (si falta uno,
      // se rellena vacío en vez de tirar toda la respuesta a la basura).
      const okRoles = Array.isArray(parsed?.topRoles);
      const okIdeas = Array.isArray(parsed?.topIdeas);
      const okCrit = !!parsed?.ideaCriteria && typeof parsed.ideaCriteria === "object";
      const okExp = !!parsed?.experiences && typeof parsed.experiences === "object";
      if (okRoles || okIdeas || okCrit || okExp) {
        if (!okRoles || !okCrit)
          console.warn(
            "processRound2: respuesta incompleta de la IA",
            JSON.stringify({ okRoles, okIdeas, okCrit, okExp })
          );
        return {
          topRoles: okRoles ? parsed.topRoles! : [],
          topIdeas: okIdeas ? parsed.topIdeas! : [],
          ideaCriteria: asTriple(parsed?.ideaCriteria),
          experiences: asTriple(parsed?.experiences),
        };
      }
      lastErr = "la respuesta no traía ninguno de los campos esperados";
    } catch (e) {
      lastErr = e instanceof Error ? e.message : "JSON inválido";
    }
  }
  throw new Error(
    `processRound2 no pudo interpretar la respuesta de la IA: ${lastErr}`
  );
}
