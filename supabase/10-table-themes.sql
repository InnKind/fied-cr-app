-- Mesas DINÁMICAS: el tema de cada mesa se decide al distribuir (según la
-- demanda) y se guarda aquí. Reemplaza la fórmula fija "mesa 1-12 = tema 1…".
-- Lo ESCRIBE el servidor (rol de servicio, en /api/admin/assign-tables); el
-- facilitador y el archivo solo lo LEEN.
--
-- Pégalo en Supabase -> SQL Editor -> Run. (Una sola vez.)

create table if not exists table_themes (
  table_number int primary key,
  theme text not null,
  updated_at timestamptz not null default now()
);

alter table table_themes enable row level security;

-- Lectura abierta (facilitador / archivo). La escritura la hace el servidor con
-- rol de servicio, que salta RLS: no hacen falta policies de insert/update.
drop policy if exists "table_themes_read" on table_themes;
create policy "table_themes_read" on table_themes for select using (true);

-- Tiempo real: para que el facilitador vea su tema aparecer al distribuir.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='table_themes'
  ) then
    alter publication supabase_realtime add table public.table_themes;
  end if;
end $$;
