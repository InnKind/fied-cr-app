-- Correcciones de la revisión (correr una vez en Supabase -> SQL Editor -> Run).

-- (1) Garantía dura contra sets de momentos duplicados (6 en vez de 3): un solo
-- registro por (mesa, ord). Si un facilitador reintenta tras un corte de red o
-- si dos dispositivos facilitan la misma mesa, el segundo insert falla con
-- 23505 y el código lo maneja recargando (no duplica).
-- El realtime del código mitiga el caso de segundo dispositivo/reintento
-- DIFERIDO, pero NO la simultaneidad verdadera (dos "Guardar" en el mismo
-- instante, antes de que llegue ningún evento). Solo este índice único cierra
-- ese caso: correrlo es OBLIGATORIO para la garantía dura.
-- ⚠️ Si ya hay duplicados en la base, este índice FALLA. Corré antes la limpieza
-- (o /api/admin/reset-data) para dejar la tabla sin duplicados.
create unique index if not exists uniq_selected_moments_table_ord
  on selected_moments (table_number, ord);

-- (2) Tiempo real sobre participants: para que, si el participante quedó sin
-- mesa y el admin (re)distribuye, su pantalla se actualice sola (sin recargar).
-- Sin esto, el rescate manual "Ingresar mi mesa" igual funciona, pero la
-- actualización automática no.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='participants'
  ) then
    alter publication supabase_realtime add table public.participants;
  end if;
end $$;
