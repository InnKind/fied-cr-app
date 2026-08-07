-- Esquema del diseño de 2 rondas (reunión 7-ago) — ADITIVO.
-- NO toca las tablas viejas (participants, responses, event_state, synthesis
-- siguen igual y la app actual sigue funcionando). Solo AGREGA lo nuevo.
-- Seguro de correr varias veces (usa "if not exists" / "drop policy if exists").
-- Pégalo en Supabase -> SQL Editor -> New query -> Run.
--
-- NOTA: los TEMAS y las MESAS siguen siendo configuración en código
-- (src/config/event.ts), no tablas. Por eso aquí el tema y la mesa se guardan
-- como valores sueltos (theme text / table_number int), igual que hoy.

-- === Columnas nuevas en participants (aditivas; las viejas se conservan) ===
-- CANÓNICAS del flujo nuevo: selected_theme + current_table. Las viejas
-- r2_topic/r2_table quedan como LEGACY (solo las escribe el demo /demo/tema) y
-- se retirarán cuando el nuevo flujo de tema/asignación esté cableado.
-- Convención: `theme` = SIEMPRE el id de config (THEMES[].id, p.ej. 'aula'),
-- nunca el título. Aplica a TODAS las tablas de abajo.
alter table participants add column if not exists selected_theme text;  -- tema elegido (id de config)
alter table participants add column if not exists current_table int;     -- mesa actual (asignada o corregida a mano)

-- === Facilitadores: credencial simple asociada a UNA mesa ===
-- (Login básico por ahora; se endurece en el paso de seguridad.)
create table if not exists facilitators (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  assigned_table int not null,
  theme text,
  created_at timestamptz not null default now()
);

-- === Los 3 momentos que el facilitador registra por mesa ===
create table if not exists selected_moments (
  id uuid primary key default gen_random_uuid(),
  table_number int not null,
  theme text,
  ord int not null check (ord between 1 and 3),   -- exactamente 1, 2, 3
  text text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_selected_moments_table on selected_moments(table_number);

-- === Cada participante elige 1 de los 3 momentos de su mesa ===
-- unique(participant_id): exactamente UNA selección por persona (evita que un
-- doble-tap descuadre el conteo en vivo). El cliente debe hacer UPSERT
-- (on conflict participant_id do update) para permitir cambiar de momento.
create table if not exists moment_selections (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid unique references participants(id) on delete cascade,
  moment_id uuid references selected_moments(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists idx_moment_selections_moment on moment_selections(moment_id);

-- === Ideas: N por sesión, con dos dimensiones (IA y Agency), ambas opcionales ===
-- moment_id es la relación fuerte (§45). theme/table_number se copian por
-- conveniencia de agregación, pero el escritor DEBE tomarlos del momento
-- referenciado para que nunca diverjan; en reportes, preferir el join por moment_id.
create table if not exists idea_submissions (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid references participants(id) on delete cascade,
  table_number int,
  theme text,
  moment_id uuid references selected_moments(id) on delete set null,
  ai_text text,
  agency_text text,
  created_at timestamptz not null default now()
);
create index if not exists idx_idea_submissions_moment on idea_submissions(moment_id);
create index if not exists idx_idea_submissions_theme on idea_submissions(theme);

-- === Fotos de post-its por mesa (el archivo vive en Storage; acá el path) ===
create table if not exists table_images (
  id uuid primary key default gen_random_uuid(),
  table_number int not null,
  theme text,                       -- para el archivo por tema (§32)
  image_path text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_table_images_table on table_images(table_number);

-- === Ronda 2: reflexión (NO depende de la mesa) ===
-- unique(participant_id): una reflexión por persona (el cliente hace UPSERT).
create table if not exists round2_responses (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid unique references participants(id) on delete cascade,
  selected_theme text,
  role_1 text,
  role_2 text,
  role_3 text,
  experience_text text,
  created_at timestamptz not null default now()
);

-- === Ítems de presentación: lo que la IA generó + qué eligió David para proyectar ===
create table if not exists presentation_items (
  id uuid primary key default gen_random_uuid(),
  theme text,
  moment_text text,
  payload jsonb,                    -- ideas generadas (IA/Agency, criterios)
  selected_for_live boolean not null default false,
  ord int,
  created_at timestamptz not null default now()
);
create index if not exists idx_presentation_items_theme on presentation_items(theme);

-- === Seguridad a nivel de fila (RLS) ===
-- Por ahora ABIERTO, igual que las tablas viejas. Se endurece en el paso de
-- seguridad (junto con SUPABASE_SERVICE_ROLE y las policies de event_state).
alter table facilitators       enable row level security;
alter table selected_moments   enable row level security;
alter table moment_selections  enable row level security;
alter table idea_submissions   enable row level security;
alter table table_images       enable row level security;
alter table round2_responses   enable row level security;
alter table presentation_items enable row level security;

-- facilitators: solo lectura desde el navegador (el login se valida en el server luego)
drop policy if exists "facilitators_read" on facilitators;
create policy "facilitators_read" on facilitators for select using (true);

-- Para las demás: leer / insertar / actualizar abierto (evento anónimo)
do $$
declare t text;
begin
  foreach t in array array[
    'selected_moments','moment_selections','idea_submissions',
    'table_images','round2_responses','presentation_items'
  ]
  loop
    execute format('drop policy if exists "%1$s_read" on %1$s', t);
    execute format('create policy "%1$s_read" on %1$s for select using (true)', t);
    execute format('drop policy if exists "%1$s_insert" on %1$s', t);
    execute format('create policy "%1$s_insert" on %1$s for insert with check (true)', t);
    execute format('drop policy if exists "%1$s_update" on %1$s', t);
    execute format('create policy "%1$s_update" on %1$s for update using (true) with check (true)', t);
  end loop;
end $$;

-- === Realtime: activar en las tablas que la app escuchará en vivo ===
do $$
declare t text;
begin
  foreach t in array array['selected_moments','moment_selections','idea_submissions']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname='supabase_realtime' and schemaname='public' and tablename=t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
