-- Addendum: permite que el panel de administrador actualice event_state.
-- Pegá esto en Supabase -> SQL Editor -> Run.
-- NOTA DE SEGURIDAD: por ahora es permisivo (cualquiera con la app podría
-- cambiar el estado). Antes del evento conviene endurecerlo (mover los cambios
-- a una ruta de servidor con la clave service_role). Para el prototipo va bien.

drop policy if exists "event_state_update" on event_state;
create policy "event_state_update" on event_state for update using (true) with check (true);
