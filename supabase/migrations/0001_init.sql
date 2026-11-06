-- My Life · esquema inicial (se puede ejecutar varias veces sin romper nada)
-- Supabase → SQL Editor → pegar todo → Run.
-- Todo menos las fotos vive aquí; las fotos están en Cloudinary (solo se guarda URL y public_id).
-- App de una sola usuaria: registro desactivado y usuaria creada a mano en Authentication → Users.

create extension if not exists unaccent with schema extensions;
create extension if not exists pg_cron;

-- ================================================================== tablas
create table if not exists public.collections (
  id          text primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null,
  parent_id   text,
  kind        text not null default 'generic'
              check (kind in ('generic','special','contacts','recipes','gifts','links','birthdays','tournaments')),
  cover       jsonb not null default '{"kind":"icon","value":"folder","tint":"g"}',
  home_order  smallint check (home_order between 0 and 11),
  route       text,
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create table if not exists public.entries (
  id            text primary key,
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type          text not null check (type in ('task','idea','note','none')),
  title         text not null default '',
  body          text not null default '',
  date          date,
  time          time,
  prio          boolean not null default false,
  featured      boolean not null default false,
  done          boolean not null default false,
  steps         jsonb not null default '[]',
  tags          text[] not null default '{}',
  links         text[] not null default '{}',
  images        jsonb not null default '[]',   -- [{publicId, url, width, height}] de Cloudinary
  collection_id text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

create table if not exists public.settings (
  user_id    uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  data       jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

-- ================================================================== relaciones (siempre de la misma usuaria)
-- Una entrada solo puede estar en una colección suya, y una subcarpeta solo puede colgar de una carpeta suya.
alter table public.collections drop constraint if exists collections_parent_id_fkey;   -- versión anterior del script
alter table public.entries     drop constraint if exists entries_collection_id_fkey;   -- versión anterior del script
-- Se crean solo si faltan (no se rehacen en cada ejecución).
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.collections'::regclass and conname = 'collections_user_id_id_unique') then
    alter table public.collections add constraint collections_user_id_id_unique unique (user_id, id);
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.collections'::regclass and conname = 'collections_parent_same_user') then
    alter table public.collections add constraint collections_parent_same_user
      foreign key (user_id, parent_id) references public.collections (user_id, id)
      on delete set null (parent_id);
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.entries'::regclass and conname = 'entries_collection_same_user') then
    alter table public.entries add constraint entries_collection_same_user
      foreign key (user_id, collection_id) references public.collections (user_id, id)
      on delete set null (collection_id);
  end if;
end $$;

-- ================================================================== índices
create index if not exists collections_user_idx   on public.collections (user_id);
create index if not exists collections_user_parent_idx on public.collections (user_id, parent_id);
create index if not exists entries_user_idx       on public.entries (user_id);
create index if not exists entries_user_collection_idx on public.entries (user_id, collection_id);
create index if not exists entries_date_idx       on public.entries (date);
create index if not exists entries_tags_idx       on public.entries using gin (tags);
drop index if exists public.entries_search_idx;      -- no aceleraba la búsqueda con LIKE; la app busca en el navegador
drop index if exists public.collections_parent_idx;  -- sustituido por el índice compuesto
drop index if exists public.entries_collection_idx;  -- sustituido por el índice compuesto

-- ================================================================== updated_at automático
create or replace function public.set_updated_at() returns trigger
  language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace trigger collections_updated_at before update on public.collections
  for each row execute function public.set_updated_at();
create or replace trigger entries_updated_at before update on public.entries
  for each row execute function public.set_updated_at();
create or replace trigger settings_updated_at before update on public.settings
  for each row execute function public.set_updated_at();

-- ================================================================== seguridad (RLS)
alter table public.collections enable row level security;
alter table public.entries     enable row level security;
alter table public.settings    enable row level security;

drop policy if exists "own collections" on public.collections;
drop policy if exists "own entries"     on public.entries;
drop policy if exists "own settings"    on public.settings;

create policy "own collections" on public.collections
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own entries" on public.entries
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own settings" on public.settings
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Sin sesión no hay acceso a nada (aunque «Automatically expose new tables» esté activado).
revoke all on public.collections, public.entries, public.settings from anon;
grant select, insert, update, delete on public.collections, public.entries, public.settings to authenticated;

-- ================================================================== búsqueda sin acentos (ñ = n)
-- La app busca en el navegador; esta función queda por si algún día hay demasiadas entradas.
create or replace function public.unaccent_text(text) returns text
  language sql stable parallel safe set search_path = '' as
  $$ select extensions.unaccent('extensions.unaccent', $1) $$;

create or replace function public.search_entries(q text)
  returns setof public.entries language sql stable security invoker set search_path = '' as $$
  select * from public.entries
  where deleted_at is null
    and public.unaccent_text(lower(title || ' ' || body || ' ' || array_to_string(tags, ' ')))
        like '%' || public.unaccent_text(lower(q)) || '%'
  order by coalesce(date, created_at::date) desc
$$;

revoke all on function public.search_entries(text) from public, anon;
grant execute on function public.search_entries(text) to authenticated;
revoke all on function public.unaccent_text(text) from public, anon;
grant execute on function public.unaccent_text(text) to authenticated;
drop function if exists public.immutable_unaccent(text);   -- versión anterior del script

-- ================================================================== papelera: borrar a los 30 días
-- Todos los días a las 03:15 UTC. Con el mismo nombre, cron.schedule actualiza el trabajo, no lo duplica.
select cron.schedule(
  'mylife-empty-trash',
  '15 3 * * *',
  $$
    delete from public.entries     where deleted_at < now() - interval '30 days';
    delete from public.collections where deleted_at < now() - interval '30 days';
  $$
);