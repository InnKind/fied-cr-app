-- Garantía dura contra sets de momentos duplicados (6 en vez de 3): un solo
-- registro por (mesa, ord). Si un facilitador reintenta tras un corte de red o
-- si dos dispositivos facilitan la misma mesa, el segundo insert falla con
-- 23505 y el código lo maneja recargando (no duplica).
--
-- El código ya funciona sin esto (usa realtime + maneja el conflicto), pero
-- esta restricción lo cierra del todo.
--
-- ⚠️ Si ya hay duplicados en la base, este índice FALLA. Corré antes la limpieza
-- (o /api/admin/reset-data) para dejar la tabla sin duplicados.
--
-- Pégalo en Supabase -> SQL Editor -> Run.

create unique index if not exists uniq_selected_moments_table_ord
  on selected_moments (table_number, ord);
