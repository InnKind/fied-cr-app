-- Tabla para guardar la síntesis de IA de cada ronda (los 3-5 temas).
-- Pegá esto en Supabase -> SQL Editor -> Run.

create table if not exists synthesis (
  round int primary key,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

alter table synthesis enable row level security;

drop policy if exists "synthesis_read" on synthesis;
create policy "synthesis_read" on synthesis for select using (true);

drop policy if exists "synthesis_insert" on synthesis;
create policy "synthesis_insert" on synthesis for insert with check (true);

drop policy if exists "synthesis_update" on synthesis;
create policy "synthesis_update" on synthesis for update using (true) with check (true);
