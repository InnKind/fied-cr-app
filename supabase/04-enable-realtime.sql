-- Activa Supabase Realtime en las tablas que la app escucha en vivo.
-- Sin esto, la suscripción "al instante" (postgres_changes) NO recibe nada
-- y el único camino de actualización es el poll de respaldo (lento).
-- Pégalo en Supabase -> SQL Editor -> Run. Es idempotente: puedes correrlo
-- aunque las tablas ya estuvieran activadas (no falla).

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'event_state'
  ) then
    execute 'alter publication supabase_realtime add table public.event_state';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'synthesis'
  ) then
    execute 'alter publication supabase_realtime add table public.synthesis';
  end if;
end $$;

-- Verificación: deben aparecer 'event_state' y 'synthesis' en el resultado.
select tablename
from pg_publication_tables
where pubname = 'supabase_realtime' and schemaname = 'public'
order by tablename;
