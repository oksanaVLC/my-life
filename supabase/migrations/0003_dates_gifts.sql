-- My Life · cumpleaños, fechas importantes y futuros regalos (se puede ejecutar varias veces)
-- Supabase → SQL Editor → pegar todo → Run. Necesita 0001 y 0002 ejecutados antes.

create table if not exists public.important_dates (
  id         text primary key,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind       text not null default 'birthday' check (kind in ('birthday','event')),
  name       text not null,
  day        smallint not null check (day between 1 and 31),
  month      smallint not null check (month between 1 and 12),
  year       smallint check (year between 1900 and 2200),
  icon       text not null default 'cake' check (icon in ('cake','fireworks','cheers','heart','star','travel','graduation')),
  plan       text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.gifts (
  id          text primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title       text not null,
  for_date_id text,                                -- para quién (un cumpleaños); vacío = sin decidir
  price       numeric(10,2) check (price >= 0),
  url         text,
  note        text not null default '',
  photo       jsonb,                               -- {publicId, url, width, height} de Cloudinary
  status      text not null default 'idea' check (status in ('idea','bought','given')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

-- El regalo solo puede ser para una fecha de la misma usuaria (la app solo ofrece cumpleaños).
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.important_dates'::regclass and conname = 'important_dates_user_id_id_unique') then
    alter table public.important_dates add constraint important_dates_user_id_id_unique unique (user_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.gifts'::regclass and conname = 'gifts_for_date_same_user') then
    alter table public.gifts add constraint gifts_for_date_same_user
      foreign key (user_id, for_date_id) references public.important_dates (user_id, id)
      on delete set null (for_date_id);
  end if;
end $$;

-- El día tiene que existir en ese mes (29 de febrero solo si el año es bisiesto o no se sabe).
alter table public.important_dates drop constraint if exists important_dates_valid_day;
alter table public.important_dates add constraint important_dates_valid_day check (
  day <= case
    when month = 2 then case when year is null or year % 400 = 0 or (year % 4 = 0 and year % 100 <> 0) then 29 else 28 end
    when month in (4, 6, 9, 11) then 30
    else 31
  end
);

create index if not exists important_dates_user_idx on public.important_dates (user_id);
create index if not exists gifts_user_idx           on public.gifts (user_id);
create index if not exists gifts_user_for_date_idx  on public.gifts (user_id, for_date_id);

create or replace trigger important_dates_updated_at before update on public.important_dates
  for each row execute function public.set_updated_at();
create or replace trigger gifts_updated_at before update on public.gifts
  for each row execute function public.set_updated_at();

alter table public.important_dates enable row level security;
alter table public.gifts           enable row level security;
drop policy if exists "own dates" on public.important_dates;
drop policy if exists "own gifts" on public.gifts;
create policy "own dates" on public.important_dates
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own gifts" on public.gifts
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke all on public.important_dates, public.gifts from public, anon;
grant select, insert, update, delete on public.important_dates, public.gifts to authenticated;

-- Papelera: el mismo trabajo, ahora también con fechas y regalos (mismo nombre = se actualiza).
select cron.schedule(
  'mylife-empty-trash',
  '15 3 * * *',
  $$
    delete from public.entries         where deleted_at < now() - interval '30 days';
    delete from public.recipes         where deleted_at < now() - interval '30 days';
    delete from public.gifts           where deleted_at < now() - interval '30 days';
    delete from public.important_dates where deleted_at < now() - interval '30 days';
    delete from public.collections     where deleted_at < now() - interval '30 days';
  $$
);
