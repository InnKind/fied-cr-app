# Guía de operación del evento — App FIEd Costa Rica

> Versión 1 (2026-08-06). **Se ajustará tras la reunión** (el flujo de rondas puede cambiar).

## URLs
- **Participantes (el QR apunta acá):** https://fied-cr-app.vercel.app/
- **Administrador:** https://fied-cr-app.vercel.app/admin  · código: **`fied2026`**
- **Resultados (para proyectar):** https://fied-cr-app.vercel.app/results

## Antes del evento
- [ ] **Limpiar datos de prueba** en Supabase → SQL Editor:
  ```sql
  delete from participants;
  update event_state set current_round = 0, phase = 'welcome' where id = 1;
  ```
- [ ] Probar el circuito completo con los **facilitadores** (llamada previa).
- [ ] Imprimir el **QR** para las mesas y/o proyectarlo al inicio.
- [ ] Confirmar el **wifi** del hotel; tener listo el **Plan B** (Google Forms).
- [ ] (Antes del evento) endurecer el código del admin (hoy es un candado suave).

## Durante el evento — secuencia del administrador
1. **Inicio:** el estado arranca en *Bienvenida (Ronda 0)*. La gente escanea el QR, elige **rol + número de mesa**, y ve "¡Ya estás dentro!".
2. Cuando la mayoría entró → **"▶ Iniciar Ronda 1"**. Los celulares muestran la pregunta; responden.
3. En `/admin` mirás cuántos respondieron. Cuando ya respondió la mayoría →
4. **"✨ Generar síntesis + mostrar resultados"** (tarda ~10 seg). Los temas aparecen en el celular de cada quien y en **`/results`** (proyectar).
5. Presentar los temas. *(Rondas siguientes: por definir tras la reunión.)*
6. **"⟳ Bienvenida"** para reiniciar el estado si hace falta.

## Si algo falla
- **La app no carga:** revisar wifi del dispositivo. La URL es pública (no depende de ninguna compu).
- **La síntesis tarda o da error:** reintenta sola (tiene respaldo de modelos); si no, volvé a tocar "Generar síntesis".
- **Falla total (luz/internet):** Plan B = Google Forms; se procesa después.

## Datos útiles
- Base de datos: Supabase (proyecto `akcszskepgncurhflogp`).
- IA: Google Gemini (`gemini-flash-latest` + respaldos).
- Cada cambio de código se publica solo al hacer `git push` (Vercel).
