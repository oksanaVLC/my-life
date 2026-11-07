-- My Life · torneos (se puede ejecutar varias veces)
-- Supabase → SQL Editor → pegar todo → Run. Necesita 0001–0004 ejecutados antes.

create table if not exists public.tournaments (
  id            text primary key,
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  collection_id text not null,
  date          date not null,
  time          time,
  name          text not null,
  detail        text not null default '',
  place         text not null default '',
  city          text not null default '',
  organizer     text not null default '',
  position      smallint check (position between 1 and 999),
  trophy        boolean not null default false,
  photo         jsonb,                                  -- {publicId, url, width, height} de Cloudinary
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

-- Siempre dentro de una colección de la misma usuaria; si la colección se borra para siempre, se van con ella.
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.tournaments'::regclass and conname = 'tournaments_collection_same_user') then
    alter table public.tournaments add constraint tournaments_collection_same_user
      foreign key (user_id, collection_id) references public.collections (user_id, id) on delete cascade;
  end if;
end $$;

create index if not exists tournaments_user_collection_idx on public.tournaments (user_id, collection_id);
create index if not exists tournaments_date_idx            on public.tournaments (date);

create or replace trigger tournaments_updated_at before update on public.tournaments
  for each row execute function public.set_updated_at();

alter table public.tournaments enable row level security;
drop policy if exists "own tournaments" on public.tournaments;
create policy "own tournaments" on public.tournaments
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke all on public.tournaments from public, anon;
grant select, insert, update, delete on public.tournaments to authenticated;

-- Papelera: el mismo trabajo, ahora también con torneos (mismo nombre = se actualiza).
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
    delete from public.tournaments     where deleted_at < now() - interval '30 days';
    delete from public.collections     where deleted_at < now() - interval '30 days';
  $$
);
