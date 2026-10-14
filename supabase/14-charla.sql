-- OJO: desde 15-charla-anonima.sql la charla es ANÓNIMA. NO vuelvas a correr
-- este archivo después del 15: recrearía charla_register y charla_answer
-- volvería a exigir registro (los celulares fallarían). Si hiciera falta, corre
-- el 15 otra vez justo después.
--
-- Charla «La universidad que el primer empleo necesita» — ADITIVO e IDEMPOTENTE.
-- No toca ninguna tabla del FIEd ni del stand. Crea 3 tablas nuevas y 4 funciones:
--   charla_state      → en qué paso va la presentación (lo escribe el servidor).
--   charla_people     → quién respondió: nombre, organización, cargo y correo.
--   charla_responses  → las respuestas de cada persona.
-- El navegador NO lee ni escribe estas dos últimas tablas directo: usa las
-- funciones charla_register, charla_answer, charla_me y charla_results. Así
-- nadie puede leer los nombres, los correos ni los textos escritos: la pantalla
-- y /charla/resultados solo reciben conteos.
-- Pégalo en Supabase -> SQL Editor -> New query -> Run. Se puede correr varias veces.
-- Las opciones de cada pregunta son las de src/config/charla.ts: si cambian
-- allá, hay que cambiarlas aquí también.

-- === 1. Estado de la sesión ===
create table if not exists charla_state (
  session text primary key,
  step int not null default 0,
  updated_at timestamptz default now()
);
insert into charla_state (session, step) values ('PE26', 0)
on conflict (session) do nothing;

-- === 2. Personas (sección «Su perfil» del formulario) ===
-- pid = código aleatorio que guarda el celular de cada persona.
create table if not exists charla_people (
  id bigserial primary key,
  session text not null check (char_length(session) <= 20),
  pid text not null check (char_length(pid) between 8 and 64),
  nombre text not null check (char_length(nombre) between 2 and 150),
  organizacion text not null check (char_length(organizacion) between 1 and 200),
  cargo text not null check (char_length(cargo) between 1 and 150),
  correo text not null check (char_length(correo) between 5 and 200),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (session, pid)
);

-- === 3. Respuestas ===
-- Una fila por persona y pregunta. charla_answer hace UPSERT, así la persona
-- puede cambiar su respuesta.
create table if not exists charla_responses (
  id bigserial primary key,
  session text not null check (char_length(session) <= 20),
  pid text not null check (char_length(pid) between 8 and 64),
  question_id text not null check (char_length(question_id) <= 20),
  answer jsonb not null check (pg_column_size(answer) <= 4000),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (session, pid, question_id)
);
create index if not exists idx_charla_responses_session on charla_responses(session, question_id);

-- === 4. Funciones del navegador ===
-- Corren con los permisos del dueño (security definer): el público no toca las tablas.

-- Registra (o corrige) los datos de una persona.
create or replace function charla_register(
  p_session text,
  p_pid text,
  p_nombre text,
  p_organizacion text,
  p_cargo text,
  p_correo text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nombre text := btrim(coalesce(p_nombre, ''));
  v_org text := btrim(coalesce(p_organizacion, ''));
  v_cargo text := btrim(coalesce(p_cargo, ''));
  v_correo text := lower(btrim(coalesce(p_correo, '')));
begin
  if not exists (select 1 from charla_state where session = p_session) then
    raise exception 'charla: sesión inválida' using errcode = '22023';
  end if;
  if p_pid is null or char_length(p_pid) not between 8 and 64 then
    raise exception 'charla: código inválido' using errcode = '22023';
  end if;
  if char_length(v_nombre) not between 2 and 150
     or char_length(v_org) not between 1 and 200
     or char_length(v_cargo) not between 1 and 150
     or char_length(v_correo) not between 5 and 200
     or v_correo !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' then
    raise exception 'charla: datos inválidos' using errcode = '22023';
  end if;
  -- Tope de seguridad: una sala no pasa de unos cientos de personas.
  if not exists (select 1 from charla_people where session = p_session and pid = p_pid)
     and (select count(*) from charla_people where session = p_session) >= 3000 then
    raise exception 'charla: sesión llena' using errcode = '22023';
  end if;

  insert into charla_people (session, pid, nombre, organizacion, cargo, correo)
  values (p_session, p_pid, v_nombre, v_org, v_cargo, v_correo)
  on conflict (session, pid) do update
    set nombre = excluded.nombre,
        organizacion = excluded.organizacion,
        cargo = excluded.cargo,
        correo = excluded.correo,
        updated_at = now();
end;
$$;

-- Guarda (o cambia) la respuesta de una persona YA registrada. Solo acepta las
-- opciones que existen en cada pregunta.
--   una opción / escala : {"choice": "id"}            (+ "other": "texto" si eligió «otro»)
--   varias opciones     : {"choices": ["id", "id"]}   (+ "other": "texto" si eligió «otro»)
--   texto libre         : {"text": "..."}
create or replace function charla_answer(
  p_session text,
  p_pid text,
  p_question_id text,
  p_answer jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mode text;
  v_allowed text[];
  v_max int := 20;
  v_text_max int := 0;
  v_keys text[];
  v_choices text[];
begin
  if p_pid is null or not exists (
    select 1 from charla_people where session = p_session and pid = p_pid
  ) then
    raise exception 'charla: persona sin registrar' using errcode = '22023';
  end if;
  if p_answer is null or jsonb_typeof(p_answer) <> 'object' then
    raise exception 'charla: respuesta inválida' using errcode = '22023';
  end if;

  case p_question_id
    when 'ROL' then
      v_mode := 'single';
      v_allowed := array['junta','alta-direccion','empresaria','sector-publico','academia','otro'];
    when 'SECTOR' then
      v_mode := 'single';
      v_allowed := array['banca','servicios','comercio','salud','tecnologia','energia','turismo','educacion','gobierno','otro'];
    when 'PREP' then
      v_mode := 'single';
      v_allowed := array['1','2','3','4','5'];
    when 'PASANTIAS' then
      v_mode := 'single';
      v_allowed := array['0','1','2-a-4','5-mas','no-se'];
    when 'BARRERAS' then
      v_mode := 'multi';
      v_allowed := array['costo','tiempo','convenios','preparacion','legal','no-considerado','otro'];
    when 'CAPACIDADES' then
      v_mode := 'multi';
      v_max := 3;
      v_allowed := array['ia','criterio','comunicacion','equipo','datos','tecnico','ingles','otro'];
    when 'POSICIONES' then
      v_mode := 'text';
      v_text_max := 200;
    when 'INFO' then
      v_mode := 'multi';
      v_allowed := array['vacantes','tendencias','retos','desempeno','ninguna'];
    when 'COEXP' then
      v_mode := 'multi';
      v_allowed := array['pasantias','mentoria','codiseno','mesas','datos','junta','ninguna'];
    when 'FRASE' then
      v_mode := 'text';
      v_text_max := 500;
    when 'SEGUIR' then
      v_mode := 'multi';
      v_allowed := array['resultados','proyecto','mesa','fied2027'];
    else
      raise exception 'charla: pregunta inválida' using errcode = '22023';
  end case;

  select coalesce(array_agg(k), '{}'::text[]) into v_keys from jsonb_object_keys(p_answer) as k;

  if v_mode = 'text' then
    if v_keys <> array['text']
       or jsonb_typeof(p_answer -> 'text') is distinct from 'string'
       or char_length(btrim(p_answer ->> 'text')) not between 1 and v_text_max then
      raise exception 'charla: respuesta inválida' using errcode = '22023';
    end if;
  else
    if not (v_keys <@ array['choice', 'choices', 'other']) then
      raise exception 'charla: respuesta inválida' using errcode = '22023';
    end if;
    if v_mode = 'single' then
      if 'choices' = any (v_keys)
         or jsonb_typeof(p_answer -> 'choice') is distinct from 'string'
         or not ((p_answer ->> 'choice') = any (v_allowed)) then
        raise exception 'charla: respuesta inválida' using errcode = '22023';
      end if;
      v_choices := array[p_answer ->> 'choice'];
    else
      if 'choice' = any (v_keys)
         or jsonb_typeof(p_answer -> 'choices') is distinct from 'array'
         or jsonb_array_length(p_answer -> 'choices') not between 1 and v_max then
        raise exception 'charla: respuesta inválida' using errcode = '22023';
      end if;
      if exists (
        select 1 from jsonb_array_elements(p_answer -> 'choices') as e(v)
        where jsonb_typeof(e.v) <> 'string'
      ) then
        raise exception 'charla: respuesta inválida' using errcode = '22023';
      end if;
      select array_agg(e.v) into v_choices
      from jsonb_array_elements_text(p_answer -> 'choices') as e(v);
      -- sin opciones inventadas, sin repetir, y «ninguna» va sola
      if not (v_choices <@ v_allowed)
         or (select count(distinct x) from unnest(v_choices) as x) <> array_length(v_choices, 1)
         or ('ninguna' = any (v_choices) and array_length(v_choices, 1) > 1) then
        raise exception 'charla: respuesta inválida' using errcode = '22023';
      end if;
    end if;
    -- «other»: solo texto corto y solo si eligió «otro»
    if 'other' = any (v_keys) then
      if jsonb_typeof(p_answer -> 'other') is distinct from 'string'
         or char_length(p_answer ->> 'other') not between 1 and 150
         or not ('otro' = any (v_choices)) then
        raise exception 'charla: respuesta inválida' using errcode = '22023';
      end if;
    end if;
  end if;

  insert into charla_responses (session, pid, question_id, answer)
  values (p_session, p_pid, p_question_id, p_answer)
  on conflict (session, pid, question_id) do update
    set answer = excluded.answer, updated_at = now();
end;
$$;

-- Lo que el celular necesita recordar de UNA persona: si ya se registró y qué
-- respondió. No devuelve el nombre ni el correo. Solo quien tiene el código (su
-- celular) puede pedirlo.
create or replace function charla_me(p_session text, p_pid text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'registered', exists (
      select 1 from charla_people where session = p_session and pid = p_pid
    ),
    'answers', coalesce((
      select jsonb_object_agg(question_id, answer)
      from charla_responses
      where session = p_session and pid = p_pid
    ), '{}'::jsonb)
  );
$$;

-- Resultados para la pantalla y /charla/resultados: SOLO conteos. Nunca salen
-- nombres, correos, códigos ni textos escritos (ni el texto de «Otros»).
--   people   → personas registradas
--   answered → cuántas personas respondieron cada pregunta
--   counts   → cuántas veces se eligió cada opción de cada pregunta (sin SEGUIR)
create or replace function charla_results(p_session text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'people', (select count(*) from charla_people where session = p_session),
    'answered', coalesce((
      select jsonb_object_agg(t.question_id, t.n)
      from (
        select question_id, count(*) as n
        from charla_responses
        where session = p_session
        group by question_id
      ) t
    ), '{}'::jsonb),
    'counts', coalesce((
      select jsonb_object_agg(z.question_id, z.c)
      from (
        select y.question_id, jsonb_object_agg(y.opt, y.n) as c
        from (
          select x.question_id, x.opt, count(*) as n
          from (
            select question_id, answer ->> 'choice' as opt
            from charla_responses
            where session = p_session and jsonb_typeof(answer -> 'choice') = 'string'
            union all
            select r.question_id, e.v as opt
            from charla_responses r
            cross join lateral jsonb_array_elements_text(
              case when jsonb_typeof(r.answer -> 'choices') = 'array' then r.answer -> 'choices' else '[]'::jsonb end
            ) as e(v)
            -- SEGUIR (cómo quiere seguir en contacto) no es un resultado: no se publica.
            where r.session = p_session and r.question_id <> 'SEGUIR'
          ) x
          where x.opt is not null
          group by x.question_id, x.opt
        ) y
        group by y.question_id
      ) z
    ), '{}'::jsonb)
  );
$$;

revoke all on function charla_register(text, text, text, text, text, text) from public;
revoke all on function charla_answer(text, text, text, jsonb) from public;
revoke all on function charla_me(text, text) from public;
revoke all on function charla_results(text) from public;
grant execute on function charla_register(text, text, text, text, text, text) to anon, authenticated;
grant execute on function charla_answer(text, text, text, jsonb) to anon, authenticated;
grant execute on function charla_me(text, text) to anon, authenticated;
grant execute on function charla_results(text) to anon, authenticated;

-- === 5. Seguridad (RLS y permisos) ===
alter table charla_state enable row level security;
alter table charla_people enable row level security;
alter table charla_responses enable row level security;

-- charla_state: el público SOLO lee. El paso lo cambia el servidor con service
-- role (POST /api/charla/step, protegido con la clave).
drop policy if exists "charla_state_select" on charla_state;
create policy "charla_state_select" on charla_state for select to anon, authenticated using (true);

-- charla_people y charla_responses: SIN políticas para el público (ni leer, ni
-- insertar, ni cambiar, ni borrar). Todo pasa por las funciones de arriba; el
-- archivo con nombres se descarga en /charla/exportar con la clave.
revoke all on charla_state from anon, authenticated;
revoke all on charla_people from anon, authenticated;
revoke all on charla_responses from anon, authenticated;
revoke all on sequence charla_people_id_seq from anon, authenticated;
revoke all on sequence charla_responses_id_seq from anon, authenticated;
grant select on charla_state to anon, authenticated;

-- === 6. Tiempo real (los celulares y la pantalla siguen el paso al instante) ===
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'charla_state'
  ) then
    execute 'alter publication supabase_realtime add table public.charla_state';
  end if;
end $$;

-- === Verificación ===
-- Deben salir 6 filas:
--   función  · charla_answer, charla_me, charla_register, charla_results
--   política · charla_state · SELECT
--   sesión   · PE26 · paso 0
select 'función' as tipo, p.proname::text as detalle
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('charla_register', 'charla_answer', 'charla_me', 'charla_results')
union all
select 'política', tablename::text || ' · ' || cmd
from pg_policies
where schemaname = 'public' and tablename in ('charla_state', 'charla_people', 'charla_responses')
union all
select 'sesión', session || ' · paso ' || step
from charla_state
order by 1, 2;

-- =====================================================================
-- === REINICIO: correr DESPUÉS del último ensayo y ANTES de la charla ===
-- Los ensayos escriben en la misma sesión PE26. Si no se borran, el conteo de
-- la sala, las barras, /charla/resultados y el archivo de /charla/exportar
-- incluirían a las personas de prueba. Está comentado para que volver a correr
-- este archivo nunca borre datos reales. Para usarlo: selecciona SOLO estas
-- líneas, quítales el "-- " del inicio y dale Run (o usa reinicio-charla.sql,
-- que es lo mismo en una sola instrucción y dice cuánto borró).
--
-- delete from charla_responses where session = 'PE26';
-- delete from charla_people where session = 'PE26';
-- update charla_state set step = 0, updated_at = now() where session = 'PE26';
--
-- Si alguna fila pudiera ser real, primero descarga el archivo en /charla/exportar.
-- No lo corras el día de la charla una vez que la sala empezó a entrar.
-- =====================================================================
