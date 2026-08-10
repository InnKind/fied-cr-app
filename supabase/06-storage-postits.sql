-- Almacenamiento (Supabase Storage) para las fotos de post-its del facilitador.
-- Pégalo en Supabase -> SQL Editor -> New query -> Run. Es idempotente.

-- 1) Bucket 'postits' (público, para poder consultar las fotos después del evento).
insert into storage.buckets (id, name, public)
values ('postits', 'postits', true)
on conflict (id) do nothing;

-- 2) Permitir SUBIR y LEER desde el navegador (evento anónimo; se endurece luego,
--    junto con el resto de la seguridad).
drop policy if exists "postits_insert" on storage.objects;
create policy "postits_insert" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'postits');

drop policy if exists "postits_read" on storage.objects;
create policy "postits_read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'postits');
