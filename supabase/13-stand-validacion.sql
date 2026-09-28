-- 13-stand-validacion.sql · Modo stand GET Forum 2026
-- Endurece stand_answer: solo acepta opciones que existen en cada pregunta
-- (las mismas de src/config/stand.ts) y en P3 no deja «Ninguna» junto con otra
-- opción ni opciones repetidas. Un celular normal nunca manda esos casos; esto
-- cierra la puerta a votos armados a mano. No borra ni cambia datos.
-- Si cambian las opciones en src/config/stand.ts, hay que cambiarlas aquí también.
-- Se puede correr más de una vez.

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
  v_allowed text[];
  v_choices text[];
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

  v_allowed := case p_question_id
    when 'R1'  then array['inversion','emprendimiento','estudiante','universidad','aceleradora','empresa','gobierno','fundacion','otro']
    when 'R2'  then array['fied','senecalab','ecosistema','primera-vez']
    when 'P0'  then array['a','b','c','d','e']
    when 'P1'  then array['A','B','C','D','ya-lo-sabia','no-aplica']
    when 'P2'  then array['tal-cual','datos-pais','verificar','no-usaria']
    when 'P3'  then array['fied-pais','webinars','atenea','ruta','intelligence','ninguna']
    when 'P3b' then array['yo','influyo','otra-area']
    when 'P4'  then array['capacitacion','adopcion','soporte','integracion','medir','no-se']
    when 'P5'  then array['precio','resultados','escala','proveedor','prioridad','no-entiendo']
    else null
  end;

  select count(*) into v_keys from jsonb_object_keys(p_answer);

  if p_question_id in ('R1', 'R2', 'P0', 'P1', 'P2', 'P4', 'P5') then
    -- una opción: {"choice": "id"}
    if v_keys <> 1
       or jsonb_typeof(p_answer -> 'choice') is distinct from 'string'
       or not ((p_answer ->> 'choice') = any (v_allowed)) then
      raise exception 'stand: respuesta inválida' using errcode = '22023';
    end if;
  elsif p_question_id = 'P3b' then
    -- {"choice": "id"}, o {} cuando la persona eligió "Ninguna" en P3
    if v_keys <> 0 and (
         v_keys <> 1
         or jsonb_typeof(p_answer -> 'choice') is distinct from 'string'
         or not ((p_answer ->> 'choice') = any (v_allowed))
       ) then
      raise exception 'stand: respuesta inválida' using errcode = '22023';
    end if;
  elsif p_question_id = 'P3' then
    -- máximo 2, sin repetir, y «ninguna» sola: {"choices": ["id", "id"]}
    if v_keys <> 1
       or jsonb_typeof(p_answer -> 'choices') is distinct from 'array'
       or jsonb_array_length(p_answer -> 'choices') not between 1 and 2 then
      raise exception 'stand: respuesta inválida' using errcode = '22023';
    end if;
    if exists (
      select 1 from jsonb_array_elements(p_answer -> 'choices') as e(v)
      where jsonb_typeof(e.v) <> 'string'
    ) then
      raise exception 'stand: respuesta inválida' using errcode = '22023';
    end if;
    select array_agg(e.v) into v_choices
    from jsonb_array_elements_text(p_answer -> 'choices') as e(v);
    if not (v_choices <@ v_allowed)
       or (select count(distinct x) from unnest(v_choices) as x) <> array_length(v_choices, 1)
       or ('ninguna' = any (v_choices) and array_length(v_choices, 1) > 1) then
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

revoke all on function stand_answer(text, text, text, jsonb) from public;
grant execute on function stand_answer(text, text, text, jsonb) to anon, authenticated;

-- Comprobación: debe devolver 1 fila con «stand_answer · validación estricta».
select 'stand_answer · validación estricta' as resultado
from pg_proc
where proname = 'stand_answer'
  and prosrc like '%v_allowed%';
