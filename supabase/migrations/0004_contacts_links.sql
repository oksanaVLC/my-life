-- My Life · tabla de contactos y enlaces guardados (se puede ejecutar varias veces)
-- Supabase → SQL Editor → pegar todo → Run. Necesita 0001–0003 ejecutados antes.

create table if not exists public.contacts (
  id            text primary key,
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  collection_id text not null,
  date          date not null default current_date,
  company       text not null default '',
  email         text not null default '',
  phone         text not null default '',
  notes         text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

create table if not exists public.links (
  id            text primary key,
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  collection_id text not null,
  url           text not null,
  title         text not null default '',
  note          text not null default '',
  tags          text[] not null default '{}',
  link_group    text not null default '',    -- pestaña: «Webs que destacan», «Paletas»…
  favorite      boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

-- Por si se ejecutó la versión anterior de este script (columna "group").
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'links' and column_name = 'group') then
    alter table public.links rename column "group" to link_group;
  end if;
end $$;

-- La dirección: http(s), con dominio y sin espacios.
alter table public.links drop constraint if exists links_url_check;
alter table public.links add constraint links_url_check check (url ~* '^https?://[^[:space:]/]+([/?#][^[:space:]]*)?$');

-- Siempre dentro de una colección de la misma usuaria; si la colección se borra para siempre, se van con ella.
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.contacts'::regclass and conname = 'contacts_collection_same_user') then
    alter table public.contacts add constraint contacts_collection_same_user
      foreign key (user_id, collection_id) references public.collections (user_id, id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.links'::regclass and conname = 'links_collection_same_user') then
    alter table public.links add constraint links_collection_same_user
      foreign key (user_id, collection_id) references public.collections (user_id, id) on delete cascade;
  end if;
end $$;

create index if not exists contacts_user_collection_idx on public.contacts (user_id, collection_id);
create index if not exists links_user_collection_idx    on public.links (user_id, collection_id);
create index if not exists links_tags_idx               on public.links using gin (tags);

create or replace trigger contacts_updated_at before update on public.contacts
  for each row execute function public.set_updated_at();
create or replace trigger links_updated_at before update on public.links
  for each row execute function public.set_updated_at();

alter table public.contacts enable row level security;
alter table public.links    enable row level security;
drop policy if exists "own contacts" on public.contacts;
drop policy if exists "own links"    on public.links;
create policy "own contacts" on public.contacts
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own links" on public.links
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke all on public.contacts, public.links from public, anon;
grant select, insert, update, delete on public.contacts, public.links to authenticated;

-- Papelera: el mismo trabajo, ahora también con contactos y enlaces (mismo nombre = se actualiza).
select cron.schedule(
  'mylife-empty-trash',
  '15 3 * * *',
  $$
    delete from public.entries         where deleted_at < now() - interval '30 days';
    delete from public.recipes         where deleted_at < now() - interval '30 days';
    delete from public.gifts           where deleted_at < now() - interval '30 days';
    delete from public.important_dates where deleted_at < now() - interval '30 days';
    delete from public.contacts        where deleted_at < now() - interval '30 days';
    delete from public.links           where deleted_at < now() - interval '30 days';
    delete from public.collections     where deleted_at < now() - interval '30 days';
  $$
);
