-- My Life · recetas (se puede ejecutar varias veces sin romper nada)
-- Supabase → SQL Editor → pegar todo → Run. Necesita 0001_init.sql ejecutado antes.

create table if not exists public.recipes (
  id            text primary key,
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title         text not null default '',
  description   text not null default '',
  category      text not null default 'lunch' check (category in ('breakfast','lunch','dinner','dessert')),
  difficulty    text not null default 'easy' check (difficulty in ('easy','medium','hard')),
  minutes       smallint check (minutes between 0 and 6000),
  servings      smallint not null default 4 check (servings between 1 and 100),
  ingredients   jsonb not null default '[]',   -- ["250 g harina de trigo", …]
  steps         jsonb not null default '[]',   -- ["Bate los huevos…", …]
  notes         text not null default '',
  tags          text[] not null default '{}',
  source        text not null default 'own' check (source in ('own','link','capture')),
  source_url    text,
  photos        jsonb not null default '[]',   -- [{publicId, url, width, height}] de Cloudinary
  rating        smallint not null default 0 check (rating between 0 and 5),
  favorite      boolean not null default false,
  cooked        jsonb not null default '[]',   -- [{date: "2026-10-27", note: "…"}]
  collection_id text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

-- La colección de una receta tiene que ser de la misma usuaria.
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.recipes'::regclass and conname = 'recipes_collection_same_user') then
    alter table public.recipes add constraint recipes_collection_same_user
      foreign key (user_id, collection_id) references public.collections (user_id, id)
      on delete set null (collection_id);
  end if;
end $$;

create index if not exists recipes_user_idx            on public.recipes (user_id);
create index if not exists recipes_user_collection_idx on public.recipes (user_id, collection_id);
create index if not exists recipes_tags_idx            on public.recipes using gin (tags);

create or replace trigger recipes_updated_at before update on public.recipes
  for each row execute function public.set_updated_at();

alter table public.recipes enable row level security;
drop policy if exists "own recipes" on public.recipes;
create policy "own recipes" on public.recipes
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke all on public.recipes from public, anon;
grant select, insert, update, delete on public.recipes to authenticated;

-- Papelera: el mismo trabajo de 0001, ahora también con recetas (mismo nombre = se actualiza, no se duplica).
select cron.schedule(
  'mylife-empty-trash',
  '15 3 * * *',
  $$
    delete from public.entries     where deleted_at < now() - interval '30 days';
    delete from public.recipes     where deleted_at < now() - interval '30 days';
    delete from public.collections where deleted_at < now() - interval '30 days';
  $$
);
