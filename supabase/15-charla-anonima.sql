-- 15-charla-anonima.sql · La charla «La universidad que el primer empleo necesita»
-- pasa a ser ANÓNIMA. ADITIVO e IDEMPOTENTE: no borra datos.
--
-- Qué cambia respecto de 14-charla.sql:
--   · Las respuestas ya no piden nombre: charla_answer acepta el código anónimo
--     del celular sin registro previo. Se elimina charla_register, así que nadie
--     puede volver a guardar nombres unidos a respuestas.
--   · La pregunta «¿Cómo le gustaría seguir con SénecaLab e InnKind?» deja de ser
--     una respuesta: pasa al contacto OPCIONAL del final (tabla charla_contacts),
--     que se guarda APARTE, sin el código del celular, así que un contacto no se
--     puede unir con las respuestas de esa persona.
--   · charla_results cuenta como «personas» a los celulares con al menos una respuesta.
--   · charla_people queda sin uso (solo tiene datos de ensayo): reinicio-charla.sql la vacía.
-- Pégalo en Supabase -> SQL Editor -> New query -> Run. Se puede correr varias veces.

-- === 1. Contactos opcionales (aparte de las respuestas) ===
-- Id aleatorio y solo el día, sin hora: ni el orden de llegada ni la hora
-- permiten emparejar un contacto con las respuestas de un celular.
create table if not exists charla_contacts (
  id uuid primary key default gen_random_uuid(),
  session text not null check (char_length(session) <= 20),
  opciones jsonb not null check (pg_column_size(opciones) <= 1000),
  nombre text not null check (char_length(nombre) between 2 and 150),
  organizacion text check (organizacion is null or char_length(organizacion) <= 200),
  cargo text check (cargo is null or char_length(cargo) <= 150),
  correo text not null check (char_length(correo) between 5 and 200),
  consentimiento boolean not null check (consentimiento),
  fecha date not null default ((now() at time zone 'America/Panama')::date)
);
create index if not exists idx_charla_contacts_session on charla_contacts(session);

alter table charla_contacts enable row level security;
revoke all on charla_contacts from anon, authenticated;

-- Guarda un contacto. No recibe el código del celular: no se puede unir con las respuestas.
--   p_opciones: lista de 1 a 4 opciones de «¿Cómo le gustaría seguir…?»
create or replace function charla_contact(
  p_session text,
  p_opciones jsonb,
  p_nombre text,
  p_organizacion text,
  p_cargo text,
  p_correo text,
  p_consentimiento boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nombre text := btrim(coalesce(p_nombre, ''));
  v_org text := nullif(btrim(coalesce(p_organizacion, '')), '');
  v_cargo text := nullif(btrim(coalesce(p_cargo, '')), '');
  v_correo text := lower(btrim(coalesce(p_correo, '')));
  v_ops text[];
begin
  if not exists (select 1 from charla_state where session = p_session) then
    raise exception 'charla: sesión inválida' using errcode = '22023';
  end if;
  if p_consentimiento is distinct from true then
    raise exception 'charla: falta el consentimiento' using errcode = '22023';
  end if;
  if char_length(v_nombre) not between 2 and 150
     or char_length(coalesce(v_org, '')) > 200
     or char_length(coalesce(v_cargo, '')) > 150
     or char_length(v_correo) not between 5 and 200
     or v_correo !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' then
    raise exception 'charla: datos inválidos' using errcode = '22023';
  end if;
  if p_opciones is null
     or jsonb_typeof(p_opciones) <> 'array'
     or jsonb_array_length(p_opciones) not between 1 and 4
     or exists (select 1 from jsonb_array_elements(p_opciones) as e(v) where jsonb_typeof(e.v) <> 'string') then
    raise exception 'charla: opciones inválidas' using errcode = '22023';
  end if;
  select array_agg(e.v) into v_ops from jsonb_array_elements_text(p_opciones) as e(v);
  if not (v_ops <@ array['resultados', 'proyecto', 'mesa', 'fied2027'])
     or (select count(distinct x) from unnest(v_ops) as x) <> array_length(v_ops, 1) then
    raise exception 'charla: opciones inválidas' using errcode = '22023';
  end if;
  -- Tope de seguridad: una sala no pasa de unos cientos de personas.
  if (select count(*) from charla_contacts where session = p_session) >= 3000 then
    raise exception 'charla: sesión llena' using errcode = '22023';
  end if;

  insert into charla_contacts (session, opciones, nombre, organizacion, cargo, correo, consentimiento)
  values (p_session, p_opciones, v_nombre, v_org, v_cargo, v_correo, true);
end;
$$;

-- === 2. Respuestas anónimas ===
-- Igual que en 14-charla.sql, pero sin exigir registro y sin la pregunta SEGUIR.
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
  if not exists (select 1 from charla_state where session = p_session) then
    raise exception 'charla: sesión inválida' using errcode = '22023';
  end if;
  if p_pid is null or char_length(p_pid) not between 8 and 64 then
    raise exception 'charla: código inválido' using errcode = '22023';
  end if;
  if p_answer is null or jsonb_typeof(p_answer) <> 'object' then
    raise exception 'charla: respuesta inválida' using errcode = '22023';
  end if;
  -- Tope de seguridad: celulares distintos por sesión.
  if not exists (select 1 from charla_responses where session = p_session and pid = p_pid)
     and (select count(distinct pid) from charla_responses where session = p_session) >= 3000 then
    raise exception 'charla: sesión llena' using errcode = '22023';
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
      if not (v_choices <@ v_allowed)
         or (select count(distinct x) from unnest(v_choices) as x) <> array_length(v_choices, 1)
         or ('ninguna' = any (v_choices) and array_length(v_choices, 1) > 1) then
        raise exception 'charla: respuesta inválida' using errcode = '22023';
      end if;
    end if;
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

-- Lo que el celular recuerda de sí mismo: solo sus respuestas.
create or replace function charla_me(p_session text, p_pid text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'answers', coalesce((
      select jsonb_object_agg(question_id, answer)
      from charla_responses
      where session = p_session and pid = p_pid
    ), '{}'::jsonb)
  );
$$;

-- Resultados: SOLO conteos. «people» = celulares con al menos una respuesta.
-- Las filas viejas de SEGUIR (ensayos de antes de este archivo) no cuentan en
-- nada: ni como persona, ni en answered, ni en counts.
create or replace function charla_results(p_session text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'people', (
      select count(distinct pid) from charla_responses
      where session = p_session and question_id <> 'SEGUIR'
    ),
    'answered', coalesce((
      select jsonb_object_agg(t.question_id, t.n)
      from (
        select question_id, count(*) as n
        from charla_responses
        where session = p_session and question_id <> 'SEGUIR'
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
            where r.session = p_session
          ) x
          where x.opt is not null and x.question_id <> 'SEGUIR'
          group by x.question_id, x.opt
        ) y
        group by y.question_id
      ) z
    ), '{}'::jsonb)
  );
$$;

-- === 3. Ya no se registran nombres unidos a respuestas ===
drop function if exists charla_register(text, text, text, text, text, text);

revoke all on function charla_contact(text, jsonb, text, text, text, text, boolean) from public;
revoke all on function charla_answer(text, text, text, jsonb) from public;
revoke all on function charla_me(text, text) from public;
revoke all on function charla_results(text) from public;
grant execute on function charla_contact(text, jsonb, text, text, text, text, boolean) to anon, authenticated;
grant execute on function charla_answer(text, text, text, jsonb) to anon, authenticated;
grant execute on function charla_me(text, text) to anon, authenticated;
grant execute on function charla_results(text) to anon, authenticated;

-- === Verificación ===
-- Deben salir 5 filas: función · charla_answer, charla_contact, charla_me,
-- charla_results, y tabla · charla_contacts (y NINGUNA fila de charla_register).
select 'función' as tipo, p.proname::text as detalle
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('charla_register', 'charla_answer', 'charla_contact', 'charla_me', 'charla_results')
union all
select 'tabla', tablename::text
from pg_tables
where schemaname = 'public' and tablename = 'charla_contacts'
order by 1, 2;
