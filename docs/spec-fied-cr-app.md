# FIEd Costa Rica — App del Ejercicio de Ideación — Spec (fuente de verdad)

> Documento maestro de este proyecto. Escrito a partir de dos reuniones de diseño (2026-07-29 y 2026-08-03) y la sesión de grilling.
> Si la realidad y este documento se contradicen, **se actualiza este documento**.
> Última actualización: 2026-08-05.

## 1. Resumen en una línea

App web (se entra por **QR, sin login**) para ~250 asistentes sentados en mesas de 8 que, en **3 rondas**, escriben una respuesta individual y luego conversan (pareja → 4 → mesa); la IA **sintetiza en vivo** los temas comunes, reorganiza las mesas por tema y produce diapositivas y un informe final — para hacer visible la inteligencia colectiva del foro y aterrizar compromisos de acción.

## 2. El problema y las personas

**Para quién:** los organizadores de Inn.Kind / FIEd (Adriana Angarita, David) y los ~150–250 asistentes del foro de educación superior (líderes universitarios, docentes, estudiantes, sector productivo, reguladores, gobierno).

**El problema:** al cierre del foro quieren un ejercicio participativo que **capture y sintetice lo que piensa toda la sala** sobre la educación superior en la era de la IA, sin que se pierda en conversaciones sueltas de mesa.

**Cómo se resuelve hoy:** conversaciones de mesa sin captura sistemática; Athenea existe solo como un GPT de chat de ChatGPT.

**Cómo se ve un win:** en **≤10 minutos** tras cada ronda, la sala ve en pantalla los **3–5 temas comunes + tensiones + el contraste con Athenea**; al final del evento, un **documento-memoria** compartible con los hallazgos y compromisos.

## 3. Alcance

### En alcance para v1 (lo CORE)
- Acceso por **QR, sin login**. Registro mínimo = elegir **sector/rol** en un dropdown controlado. **Anónimo**: sin nombre, correo ni contraseña.
- **Tres roles de app:** administrador, facilitador, participante.
- **Ronda 1:** una o más preguntas abiertas. Se captura **UNA respuesta individual por persona** (mientras piensa a solas); luego solo conversan (pareja → 4 → mesa), sin más envíos. Las mesas de R1 se arman **heterogéneas por rol**.
- **Ronda 2:** cada persona elige **1 de ~5 temas predefinidos** (dropdown). La app **reagrupa las mesas por tema** (ideal 8/mesa) y le indica a cada quien, en su celular, **a qué mesa ir**. Una pregunta por tema; se captura una respuesta individual.
- **Ronda 3:** ~3 preguntas de reflexión/compromiso; se capturan para el informe.
- **Síntesis por IA (en vivo):** 3–5 temas comunes + **tensiones** (contradicciones con masa crítica, no outliers sueltos) + **gráficos de frecuencia** + bullets autoexplicativos + **notas del presentador**.
- **Contraste con Athenea:** respuesta de Athenea (pre-generada) a la pregunta cabecera + se muestran **solo los deltas** vs. la síntesis de la sala.
- **Pantalla de resultados en vivo** (visible en el dispositivo de cada quien) y/o **export a PPTX** para subir a Wooclap.
- **Panel de facilitador** (ve llegar las respuestas de su mesa) y **panel de administrador** (ve qué mesas no han respondido).
- **Informe final escrito** (memoria) que sintetiza las 3 rondas: versión compartible + versión interna detallada.
- **Fallbacks:** Plan B (Forms + dashboard), Plan C (manual).

### Fuera de alcance (y por qué)
- **Chat 1-a-1 de IA embebido** → reemplazado por un **enlace al GPT de Athenea** existente.
- **Avatar / voz** → diferido (no alcanza el plazo).
- **Captura de audio** de las mesas → descartado (ruido, no distingue voces).
- **Athenea como API en vivo** → innecesario; sus respuestas se **pre-generan** (ver §5).
- **Registro con nombre/correo/contraseña** → descartado por anonimato y fricción.
- **Ruteo a la mesa más cercana** → plus (solo si sobra tiempo).
- **Interacción en vivo tipo Mentimeter al cierre** → futura.

### Prioridad (si no todo cabe)
1. Flujo de las 3 rondas + captura de respuesta individual + los 3 roles.
2. Síntesis por IA (3–5 temas + frecuencias + tensiones) + pantalla de resultados.
3. Contraste con Athenea + informe final.
4. Export a PPTX/Wooclap + notas del presentador.
5. Plus: ruteo a mesa más cercana, citas textuales en el informe.

## 4. Cómo funciona (vista del usuario)

**Setup (administrador, antes):** carga la configuración del evento — las preguntas de cada ronda, los ~5 temas de R2, la lista de roles/sectores, número de mesas y facilitadores. Genera el QR.

**Participante:**
1. Escanea el QR → abre la web → pantalla de bienvenida corta.
2. Elige su **sector/rol** en el dropdown (sin nombre). La app le asigna una **mesa heterogénea** (R1).
3. **R1:** ve la pregunta, **escribe su respuesta individual**, la envía. Luego conversa en pareja → 4 → mesa (sin volver a escribir).
4. Ve en su celular la **pantalla de resultados** (3–5 temas + frecuencias + contraste Athenea) mientras el guía presenta.
5. **R2:** elige **su tema** (dropdown). La app le dice **a qué mesa moverse**. Escribe su respuesta al tema. Conversa. Ve resultados.
6. **R3:** responde las preguntas de reflexión/compromiso.
7. Al cierre, recibe un enlace al **informe** y al **GPT de Athenea** para seguir explorando.

**Facilitador:** entra con su rol; tiene su **mesa asignada fija** (no rota); ve un panel con **cuántos de su mesa ya enviaron**; también responde las preguntas (su respuesta entra a la síntesis).

**Administrador:** ve el avance global (qué mesas faltan), dispara el cierre de cada ronda, revisa la síntesis y publica las diapositivas/resultados.

## 5. Tech y arquitectura

**Stack (recomendado, a confirmar):**
- **Next.js (React) desplegado en Vercel** — Vercel abre una conexión por persona y aguanta la concurrencia (probado a 500 por la asesora).
- **Supabase (Postgres + Realtime)** como base de datos y canal en vivo (pantalla de resultados y estados que se actualizan solos). Alternativa: Vercel Postgres + polling.
- App **en español**.

**IA de síntesis en vivo:** **API de Claude (Anthropic)**. Recibe las respuestas de una ronda y devuelve **JSON estructurado**: temas (3–5), % por tema, tensiones, bullets, notas. Necesita **API key + presupuesto** (bajo, ~pocos USD para el evento).

**Athenea (contraste):** **no requiere API en vivo.** Como las preguntas cabecera se conocen de antemano, se **pre-generan** las respuestas de Athenea offline, usando (a) el GPT existente manualmente, o (b) un "Athenea-en-Claude" cargado con `athenea/athenea-instructions.md` + los documentos de `athenea/knowledge/`. Se guardan como contenido estático y en vivo solo se calcula el **delta** contra la síntesis de la sala.

**Chat 1-a-1:** enlace externo al GPT de Athenea (https://chatgpt.com/g/g-jGO4zaEiC-fied-foro-internacional-de-educacion).

**Diapositivas / entregables:** el JSON de síntesis se renderiza en la **pantalla de resultados** y se puede **exportar a PPTX** (skill `pptx`) para Wooclap. Las **notas del presentador** salen en un doc Word/texto (skill `docx`).

**Modelo de datos (bosquejo):**
- `event_config` (preguntas por ronda, temas de R2, roles, nº mesas) — **todo configurable, nada hardcodeado**.
- `participants` (id anónimo, rol/sector, mesa_inicial, mesa_actual, es_facilitador).
- `responses` (participant_id, ronda, question_id, texto, timestamp).
- `topics` (R2, predefinidos) y `topic_choices` (participant_id → topic).
- `table_assignments` (ronda, participant_id → mesa).
- `synthesis_outputs` (ronda → JSON de la síntesis).

**Deployment:** Vercel; por ahora URL de Vercel + QR (dominio propio opcional, vía Namecheap + Cloudflare si se quisiera).

**Principio clave:** **config-driven.** Preguntas, temas y roles se cargan desde config/BD, para poder **enchufarlos tarde** (D3 aún pendiente) sin tocar el código.

## 6. Riesgos, edge cases y modos de falla

**El mayor riesgo:** el **wifi del hotel**. Mitigación: payload liviano; animar a compartir hotspot (en el script); **Plan B = Forms + dashboard**; **Plan C = manual**.

**Edge cases / manejo:**
- **SLA de 10 min** para la síntesis → prompts afinados; pre-generar lo pre-generable; probarlo con datos ficticios.
- **250 concurrentes** → Vercel serverless + Supabase; hacer prueba de carga.
- **Anonimato** → nunca pedir ni mostrar nombres; citas atribuidas por rol.
- **Gente que no envía / respuestas incompletas** → el admin ve las mesas faltantes; la síntesis tolera un N variable.
- **Movimiento físico de mesas** → la app le dice a cada quien su mesa; mapa de mesas proyectable; mesas del mismo tema **adyacentes** (logística de sala).
- **Fallo total (luz/internet)** → Plan C manual (Forms/papel + procesamiento a mano).

**Cómo sabremos que funciona (testing):** ensayo del ciclo completo con datos ficticios; **prueba con facilitadores por Zoom** la semana previa; prueba de carga con ~250 sesiones simuladas.

## 7. Otras restricciones

- **Cronograma:** hoy 2026-08-05 · prototipo meta **2026-08-10** · evento **2026-08-20** · 10–20 ago = corregir bugs.
- **Quién construye:** Jerónimo (poca experiencia construyendo apps con IA; trabajar **paso a paso**).
- **Greenfield** (proyecto desde cero).
- **Post-evento:** informe + link a la data de la app + subir el doc final al GPT de Athenea.

## 8. Preguntas abiertas

- [ ] **D3 (CRÍTICO):** preguntas exactas de R1/R2/R3 + los ~5 temas de R2 + la lista completa de roles/sectores. Owner: David + Adriana. Meta: 2026-08-04. **Todo lo que genera la app depende de esto.**
- [ ] **D6:** ratificar el enfoque de Athenea (pre-generado offline + Claude API para la síntesis en vivo).
- [ ] ¿El facilitador cuenta dentro de los 8 o es un 9º (guía adicional)?
- [ ] Formato final del display en vivo (Wooclap vs. slides proyectadas) — decidir cerca del evento.
- [ ] Nº real de participantes / mesas / cupos libres — Adriana confirma ~1 semana antes.
- [ ] Presupuesto y cuenta para la API de Claude.
- [ ] Interacción en vivo al cierre (Mentimeter-style) — a futuro.

## 9. Supuestos (corregir si están mal)

- Diseñamos para **250** aunque se esperen ~150.
- **Athenea no necesita API en vivo** (respuestas pre-generadas). Si el equipo la quiere 100% en vivo, cambia la arquitectura y el costo.
- Stack **Next.js + Vercel + Supabase + Claude API**. Si Jerónimo prefiere otro, se ajusta.
- Las **preguntas/temas/roles llegan configurables antes del 10-ago**; se puede construir el esqueleto sin ellos.
- **Una** respuesta individual por persona por pregunta (no una por etapa).
