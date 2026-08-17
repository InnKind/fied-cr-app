-- Cambio #1 (Ronda 2): columnas nuevas para las preguntas añadidas.
--  - motivating_idea:      "¿con qué idea te sientes motivado/a a empezar?" (texto)
--  - cant_commit:          true si eligió "no puedo comprometerme a tomar acción"
--  - cant_commit_reason:   "¿por qué no puedes tomar acción?" (texto; se recolecta
--                          pero NO se muestra en /resultados, solo el conteo)
alter table round2_responses add column if not exists motivating_idea text;
alter table round2_responses add column if not exists cant_commit boolean not null default false;
alter table round2_responses add column if not exists cant_commit_reason text;
