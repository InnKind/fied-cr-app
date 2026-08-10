-- Endurecer seguridad: SOLO el servidor (rol de servicio) puede CAMBIAR el
-- estado del evento y ESCRIBIR los resultados de la IA. El navegador solo LEE.
--
-- ⚠️  CORRER SOLO DESPUÉS de:
--   (1) configurar SUPABASE_SERVICE_ROLE y ADMIN_SECRET en Vercel + redeploy, y
--   (2) confirmar en /api/admin/health que serviceRole=true y adminSecret=true.
-- Si lo corres antes, el panel de admin no podrá cambiar de fase ni procesar.
--
-- Pégalo en Supabase -> SQL Editor -> Run.

-- event_state: quitar el UPDATE abierto (lo cambia el server con service role).
drop policy if exists "event_state_update" on event_state;

-- synthesis: quitar INSERT/UPDATE abiertos (los escribe el server con service role).
drop policy if exists "synthesis_insert" on synthesis;
drop policy if exists "synthesis_update" on synthesis;

-- Se MANTIENEN las políticas de SELECT (todos leen el estado y los resultados).
-- Verificación: deberían quedar solo policies de 'SELECT' (cmd = r) en estas tablas.
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public' and tablename in ('event_state', 'synthesis')
order by tablename, cmd;
