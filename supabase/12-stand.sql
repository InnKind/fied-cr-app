-- Modo stand (GET Forum 2026, Quito) — ADITIVO e IDEMPOTENTE.
-- No toca ninguna tabla del FIEd. Solo crea 3 tablas nuevas y 3 funciones:
--   stand_state      → en qué paso va la sesión (lo escribe el servidor).
--   stand_responses  → respuestas ANÓNIMAS (sin datos personales). El navegador
--                      NO la lee ni la escribe directo: usa las funciones
--                      stand_answer, stand_my_answers y stand_results.
--   stand_contacts   → contactos de las Tres puertas (el navegador NO los puede leer).
-- Pégalo en Supabase -> SQL Editor -> New query -> Run. Se puede correr varias veces.
-- Al final hay un bloque de REINICIO (comentado) para borrar los ensayos.

-- === 1. Estado de la sesión ===
create table if not exists stand_state (
  session text primary key,
  step int not null default 0,
  updated_at timestamptz default now()
);
insert into stand_state (session, step) values ('GET26', 0)
on conflict (session) do nothing;

-- === 2. Respuestas anónimas ===
-- Una fila por persona (anon_id) y pregunta. stand_answer hace UPSERT sobre
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

-- Reglas que también valida el formulario (por si alguien se salta el navegador):
--   · puertas 1, 2 y 3: nombre, cargo, organización y país obligatorios;
--   · cada puerta necesita el consentimiento de su uso: la 0, "resultados";
--     la 1, la 2 y la 3, "contacto".
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'stand_contacts_required_fields') then
    alter table stand_contacts add constraint stand_contacts_required_fields check (
      door = '0' or (
        coalesce(btrim(name), '') <> ''
        and coalesce(btrim(role), '') <> ''
        and coalesce(btrim(org), '') <> ''
        and coalesce(btrim(country), '') <> ''
      )
    );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'stand_contacts_consent') then
    alter table stand_contacts add constraint stand_contacts_consent check (
      (door = '0' and consent_results) or (door <> '0' and consent_contact)
    );
  end if;
end $$;

-- === 4. Funciones del navegador para las respuestas ===
-- Corren con los permisos del dueño (security definer): el público no toca la
-- tabla. Así nadie puede leer los id anónimos, unir las respuestas de una
-- persona, leer los textos de la pregunta abierta ni reescribir votos ajenos.

-- Guarda (o cambia) la respuesta de una persona. Valida la forma de la respuesta.
create or replace function stand_answer(
  p_session text,
  p_anon_id text,
  p_question_id text,
  p_answer jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_keys int;
begin
  if not exists (select 1 from stand_state where session = p_session) then
    raise exception 'stand: sesión inválida' using errcode = '22023';
  end if;
  if p_anon_id is null or char_length(p_anon_id) not between 8 and 64 then
    raise exception 'stand: id anónimo inválido' using errcode = '22023';
  end if;
  if p_answer is null or jsonb_typeof(p_answer) <> 'object' then
    raise exception 'stand: respuesta inválida' using errcode = '22023';
  end if;

  select count(*) into v_keys from jsonb_object_keys(p_answer);

  if p_question_id in ('R1', 'R2', 'P0', 'P1', 'P2', 'P4', 'P5') then
    -- una opción: {"choice": "id"}
    if v_keys <> 1
       or jsonb_typeof(p_answer -> 'choice') is distinct from 'string'
       or char_length(p_answer ->> 'choice') not between 1 and 40 then
      raise exception 'stand: respuesta inválida' using errcode = '22023';
    end if;
  elsif p_question_id = 'P3b' then
    -- {"choice": "id"}, o {} cuando la persona eligió "Ninguna" en P3
    if v_keys <> 0 and (
         v_keys <> 1
         or jsonb_typeof(p_answer -> 'choice') is distinct from 'string'
         or char_length(p_answer ->> 'choice') not between 1 and 40
       ) then
      raise exception 'stand: respuesta inválida' using errcode = '22023';
    end if;
  elsif p_question_id = 'P3' then
    -- máximo 2: {"choices": ["id", "id"]}
    if v_keys <> 1
       or jsonb_typeof(p_answer -> 'choices') is distinct from 'array'
       or jsonb_array_length(p_answer -> 'choices') not between 1 and 2 then
      raise exception 'stand: respuesta inválida' using errcode = '22023';
    end if;
    if exists (
      select 1 from jsonb_array_elements(p_answer -> 'choices') as e(v)
      where jsonb_typeof(e.v) <> 'string' or char_length(e.v #>> '{}') not between 1 and 40
    ) then
      raise exception 'stand: respuesta inválida' using errcode = '22023';
    end if;
  elsif p_question_id = 'ABIERTA' then
    -- texto libre: {"text": "..."} (máximo 500)
    if v_keys <> 1
       or jsonb_typeof(p_answer -> 'text') is distinct from 'string'
       or char_length(p_answer ->> 'text') not between 1 and 500 then
      raise exception 'stand: respuesta inválida' using errcode = '22023';
    end if;
  else
    raise exception 'stand: pregunta inválida' using errcode = '22023';
  end if;

  insert into stand_responses (session, anon_id, question_id, answer)
  values (p_session, p_anon_id, p_question_id, p_answer)
  on conflict (session, anon_id, question_id) do update set answer = excluded.answer;
end;
$$;

-- Las respuestas de UNA persona (para que su celular recuerde lo que contestó).
-- Solo quien tiene el id anónimo (su celular) lo conoce.
create or replace function stand_my_answers(p_session text, p_anon_id text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_object_agg(question_id, answer), '{}'::jsonb)
  from stand_responses
  where session = p_session and anon_id = p_anon_id;
$$;

-- Resultados para la pantalla y /stand/resultados: las respuestas SIN id
-- anónimo y ordenadas por pregunta y respuesta (no se pueden unir por persona),
-- sin los textos de la pregunta abierta (solo cuántas propuestas hay) y el
-- número de personas distintas.
create or replace function stand_results(p_session text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'people', (
      select count(distinct anon_id) from stand_responses where session = p_session
    ),
    'abierta', (
      select count(*) from stand_responses
      where session = p_session
        and question_id = 'ABIERTA'
        and btrim(coalesce(answer ->> 'text', '')) <> ''
    ),
    'rows', coalesce((
      select jsonb_agg(
               jsonb_build_object('question_id', question_id, 'answer', answer)
               order by question_id, answer::text
             )
      from stand_responses
      where session = p_session and question_id <> 'ABIERTA'
    ), '[]'::jsonb)
  );
$$;

revoke all on function stand_answer(text, text, text, jsonb) from public;
revoke all on function stand_my_answers(text, text) from public;
revoke all on function stand_results(text) from public;
grant execute on function stand_answer(text, text, text, jsonb) to anon, authenticated;
grant execute on function stand_my_answers(text, text) to anon, authenticated;
grant execute on function stand_results(text) to anon, authenticated;

-- === 5. Seguridad (RLS y permisos) ===
alter table stand_state enable row level security;
alter table stand_responses enable row level security;
alter table stand_contacts enable row level security;

-- stand_state: el público SOLO lee. El paso lo cambia el servidor con service role
-- (POST /api/stand/step, protegido con la clave del stand).
drop policy if exists "stand_state_select" on stand_state;
create policy "stand_state_select" on stand_state for select to anon, authenticated using (true);

-- stand_responses: SIN políticas para el público (ni leer, ni insertar, ni
-- cambiar, ni borrar). Todo pasa por las funciones de arriba.
drop policy if exists "stand_responses_select" on stand_responses;
drop policy if exists "stand_responses_insert" on stand_responses;
drop policy if exists "stand_responses_update" on stand_responses;

-- stand_contacts: SOLO insertar, y solo en esta sesión. Sin SELECT, UPDATE ni
-- DELETE: los contactos no se pueden leer desde el navegador (se exportan en
-- /stand/exportar con la clave del stand).
drop policy if exists "stand_contacts_insert" on stand_contacts;
create policy "stand_contacts_insert" on stand_contacts for insert to anon, authenticated
  with check (session = 'GET26' and event_code = 'STAND-EC-26');

-- Permisos: Supabase da TODO al público en las tablas nuevas; se deja solo lo
-- necesario, así la protección no depende únicamente de RLS.
revoke all on stand_state from anon, authenticated;
revoke all on stand_responses from anon, authenticated;
revoke all on stand_contacts from anon, authenticated;
revoke all on sequence stand_responses_id_seq from anon, authenticated;
grant select on stand_state to anon, authenticated;
grant insert on stand_contacts to anon, authenticated;
grant usage, select on sequence stand_contacts_id_seq to anon, authenticated;

-- === 6. Tiempo real (los celulares y la pantalla siguen el paso al instante) ===
-- Solo stand_state: las respuestas no se publican (el público no puede leerlas;
-- la pantalla las consulta cada 2 s con stand_results).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'stand_state'
  ) then
    execute 'alter publication supabase_realtime add table public.stand_state';
  end if;
end $$;

-- === Verificación ===
-- Deben salir 6 filas:
--   función  · stand_answer, stand_my_answers, stand_results
--   política · stand_contacts · INSERT  y  stand_state · SELECT
--   sesión   · GET26 · paso 0
select 'función' as tipo, p.proname::text as detalle
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('stand_answer', 'stand_my_answers', 'stand_results')
union all
select 'política', tablename::text || ' · ' || cmd
from pg_policies
where schemaname = 'public' and tablename in ('stand_state', 'stand_responses', 'stand_contacts')
union all
select 'sesión', session || ' · paso ' || step
from stand_state
order by 1, 2;

-- =====================================================================
-- === REINICIO: correr DESPUÉS del último ensayo (2-oct) y ANTES del evento ===
-- Los ensayos escriben en la misma sesión GET26. Si no se borran, el conteo de
-- la sala, el reto que responde Atenea, el resumen y /stand/resultados
-- incluirían los votos de prueba. Para correrlo: selecciona SOLO estas líneas,
-- quítales el "-- " del inicio y dale Run.
--
-- delete from stand_responses where session = 'GET26';
-- update stand_state set step = 0, updated_at = now() where session = 'GET26';
--
-- Contactos de prueba: primero expórtalos en /stand/exportar y, si ninguno es
-- real, bórralos:
-- delete from stand_contacts where session = 'GET26';
--
-- En los celulares del ensayo: abran /stand en una ventana de incógnito, o
-- borren los datos del sitio fied-cr-app.vercel.app (así se olvida el
-- «¡Gracias!» de las Tres puertas y la pregunta abierta saltada).
-- No lo corras el 5-oct una vez que la sala empezó a registrarse.
-- =====================================================================
