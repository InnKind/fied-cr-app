-- Esquema v1 — App FIEd Costa Rica
-- Pegá TODO esto en: Supabase -> SQL Editor -> New query -> Run.
-- Es seguro correrlo más de una vez (usa "if not exists").

-- 1) Estado del evento (una sola fila; el administrador controla la ronda/fase)
create table if not exists event_state (
  id int primary key default 1,
  current_round int not null default 0,   -- 0 = bienvenida, 1/2/3 = rondas
  phase text not null default 'welcome',  -- 'welcome' | 'answering' | 'results'
  updated_at timestamptz not null default now(),
  constraint event_state_singleton check (id = 1)
);
insert into event_state (id) values (1) on conflict (id) do nothing;

-- 2) Participantes (anónimos: sin nombre ni correo)
create table if not exists participants (
  id uuid primary key default gen_random_uuid(),
  role text not null,                 -- id del rol elegido (ver src/config/event.ts)
  base_table int,                     -- mesa de la Ronda 1
  r2_topic text,                      -- tema elegido en la Ronda 2
  r2_table int,                       -- mesa reasignada en la Ronda 2
  is_facilitator boolean not null default false,
  created_at timestamptz not null default now()
);

-- 3) Respuestas (una respuesta individual por persona por pregunta)
create table if not exists responses (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid references participants(id) on delete cascade,
  round int not null,
  question_id text not null,
  topic_id text,                      -- solo Ronda 2
  answer text not null,
  created_at timestamptz not null default now()
);

-- 4) Seguridad a nivel de fila (RLS).
-- Para este evento anónimo permitimos lo mínimo desde el navegador.
-- (El control del administrador sobre event_state se hará luego desde el
--  servidor con una clave secreta, no desde el navegador.)
alter table event_state enable row level security;
alter table participants enable row level security;
alter table responses enable row level security;

-- event_state: todos pueden LEER (para saber en qué ronda va). Nadie lo cambia desde el navegador.
drop policy if exists "event_state_read" on event_state;
create policy "event_state_read" on event_state for select using (true);

-- participants: cualquiera crea su registro, lo lee y lo actualiza (datos anónimos)
drop policy if exists "participants_insert" on participants;
create policy "participants_insert" on participants for insert with check (true);
drop policy if exists "participants_read" on participants;
create policy "participants_read" on participants for select using (true);
drop policy if exists "participants_update" on participants;
create policy "participants_update" on participants for update using (true) with check (true);

-- responses: cualquiera inserta su respuesta y puede leer (para la agregación)
drop policy if exists "responses_insert" on responses;
create policy "responses_insert" on responses for insert with check (true);
drop policy if exists "responses_read" on responses;
create policy "responses_read" on responses for select using (true);
