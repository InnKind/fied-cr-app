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

export type Theme = { title: string; description: string; count: number };
export type Synthesis = { themes: Theme[]; total: number };

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// Toma las respuestas abiertas de una ronda y las agrupa en 3-5 temas comunes.
export async function synthesizeResponses(
  question: string,
  answers: string[]
): Promise<Synthesis> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("Falta GEMINI_API_KEY en el servidor.");

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

  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: "application/json", temperature: 0.3 },
  });

  let lastErr = "sin intentos";

  // Prueba cada modelo; reintenta 2 veces ante errores temporales (503/429/500).
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
        if (text) {
          try {
            return JSON.parse(text) as Synthesis;
          } catch {
            lastErr = `${model}: JSON inválido`;
            break; // probar siguiente modelo
          }
        }
        lastErr = `${model}: sin texto`;
        break; // probar siguiente modelo
      }

      lastErr = `${model}: HTTP ${res.status}`;
      // Errores temporales -> reintentar el mismo modelo con backoff.
      if (res.status === 503 || res.status === 429 || res.status === 500) {
        await sleep(800 * (attempt + 1));
        continue;
      }
      break; // otro error (p. ej. 404) -> probar siguiente modelo
    }
  }

  throw new Error(`Gemini no disponible. Último error: ${lastErr}`);
}
