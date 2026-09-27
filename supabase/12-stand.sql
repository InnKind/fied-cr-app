-- Modo stand (GET Forum 2026, Quito) — ADITIVO e IDEMPOTENTE.
-- No toca ninguna tabla del FIEd. Solo crea 3 tablas nuevas:
--   stand_state      → en qué paso va la sesión (lo escribe el servidor).
--   stand_responses  → respuestas ANÓNIMAS a las preguntas (sin datos personales).
--   stand_contacts   → contactos de las Tres puertas (el navegador NO los puede leer).
-- Pégalo en Supabase -> SQL Editor -> New query -> Run. Se puede correr varias veces.

-- === 1. Estado de la sesión ===
create table if not exists stand_state (
  session text primary key,
  step int not null default 0,
  updated_at timestamptz default now()
);
insert into stand_state (session, step) values ('GET26', 0)
on conflict (session) do nothing;

-- === 2. Respuestas anónimas ===
-- Una fila por persona (anon_id) y pregunta. El celular hace UPSERT sobre
-- (session, anon_id, question_id), así la persona puede cambiar su respuesta.
create table if not exists stand_responses (
  id bigserial primary key,
  session text not null check (char_length(session) <= 20),
  anon_id text not null check (char_length(anon_id) between 8 and 64),
  question_id text not null check (char_length(question_id) <= 20),
  answer jsonb not null check (pg_column_size(answer) <= 4000),
  created_at timestamptz default now(),
  unique (session, anon_id, question_id)
);
create index if not exists idx_stand_responses_session on stand_responses(session, question_id);

-- === 3. Contactos de las Tres puertas ===
create table if not exists stand_contacts (
  id bigserial primary key,
  session text not null check (char_length(session) <= 20),
  event_code text not null default 'STAND-EC-26' check (char_length(event_code) <= 30),
  door text not null check (door in ('0', '1', '2', '3')),
  options jsonb check (options is null or pg_column_size(options) <= 2000),
  name text check (char_length(name) <= 150),
  role text check (char_length(role) <= 150),
  org text check (char_length(org) <= 200),
  country text check (char_length(country) <= 100),
  email text not null check (char_length(email) between 3 and 200),
  timing text check (char_length(timing) <= 40),
  evidence text check (char_length(evidence) <= 600),
  referral_org text check (char_length(referral_org) <= 200),
  referral_role text check (char_length(referral_role) <= 150),
  consent_contact boolean not null default false,
  consent_results boolean not null default false,
  consent_news boolean not null default false,
  created_at timestamptz default now()
);

-- === 4. Seguridad (RLS) ===
alter table stand_state enable row level security;
alter table stand_responses enable row level security;
alter table stand_contacts enable row level security;

-- stand_state: el público SOLO lee. El paso lo cambia el servidor con service role
-- (POST /api/stand/step, protegido con ADMIN_SECRET).
drop policy if exists "stand_state_select" on stand_state;
create policy "stand_state_select" on stand_state for select to anon, authenticated using (true);

-- stand_responses: leer (resultados en vivo), insertar y actualizar (cambiar la
-- respuesta). Sin DELETE.
drop policy if exists "stand_responses_select" on stand_responses;
drop policy if exists "stand_responses_insert" on stand_responses;
drop policy if exists "stand_responses_update" on stand_responses;
create policy "stand_responses_select" on stand_responses for select to anon, authenticated using (true);
create policy "stand_responses_insert" on stand_responses for insert to anon, authenticated with check (true);
create policy "stand_responses_update" on stand_responses for update to anon, authenticated using (true) with check (true);

-- stand_contacts: SOLO insertar. Sin SELECT, UPDATE ni DELETE: los contactos no
-- se pueden leer desde el navegador (se exportan con /api/stand/export).
drop policy if exists "stand_contacts_insert" on stand_contacts;
create policy "stand_contacts_insert" on stand_contacts for insert to anon, authenticated with check (true);

-- Permisos explícitos (por si el proyecto no los da por defecto a tablas nuevas).
grant select on stand_state to anon, authenticated;
grant select, insert, update on stand_responses to anon, authenticated;
grant insert on stand_contacts to anon, authenticated;
grant usage, select on sequence stand_responses_id_seq to anon, authenticated;
grant usage, select on sequence stand_contacts_id_seq to anon, authenticated;
-- TRUNCATE se salta las políticas de RLS: se le quita al público.
revoke truncate on stand_state, stand_responses, stand_contacts from anon, authenticated;

-- === 5. Tiempo real (los celulares y la pantalla siguen el paso al instante) ===
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'stand_state'
  ) then
    execute 'alter publication supabase_realtime add table public.stand_state';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'stand_responses'
  ) then
    execute 'alter publication supabase_realtime add table public.stand_responses';
  end if;
end $$;

-- === Verificación ===
-- Deben salir 5 filas: stand_contacts → INSERT; stand_responses → INSERT,
-- SELECT y UPDATE; stand_state → SELECT.
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public' and tablename like 'stand_%'
order by tablename, cmd;

-- Y la sesión GET26 en el paso 0:
select * from stand_state;
