-- "Mesa lista": el facilitador marca cuando su mesa terminó el paso actual y el
-- admin lo ve en su panel. El estado se reinicia al cambiar de fase (lo hace el
-- servidor con el rol de servicio, en /api/admin/set-state).
--
-- Pégalo en Supabase -> SQL Editor -> Run. (Se corre una sola vez.)

create table if not exists table_status (
  table_number int primary key,
  ready boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table table_status enable row level security;

-- Anónimo: el facilitador marca/desmarca su mesa; todos pueden leer.
drop policy if exists "table_status_read" on table_status;
drop policy if exists "table_status_insert" on table_status;
drop policy if exists "table_status_update" on table_status;
create policy "table_status_read" on table_status for select using (true);
create policy "table_status_insert" on table_status for insert with check (true);
create policy "table_status_update" on table_status for update using (true) with check (true);

-- Tiempo real (para que el facilitador vea el reinicio al cambiar de fase).
-- Si ya estaba en la publicación, este ALTER da error inofensivo: ignóralo.
alter publication supabase_realtime add table table_status;
