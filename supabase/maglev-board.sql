-- 在 Supabase 的 SQL Editor 整段執行一次。
-- 三年級磁浮列車計分：老師頁和大螢幕共用這一列成績。

create table if not exists public.maglev_meet (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.maglev_meet replica identity full;

create or replace function public.touch_maglev_meet()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists maglev_meet_touch on public.maglev_meet;
create trigger maglev_meet_touch
  before update on public.maglev_meet
  for each row execute function public.touch_maglev_meet();

alter table public.maglev_meet enable row level security;

drop policy if exists "maglev read" on public.maglev_meet;
drop policy if exists "maglev insert" on public.maglev_meet;
drop policy if exists "maglev update" on public.maglev_meet;

create policy "maglev read" on public.maglev_meet for select using (true);
create policy "maglev insert" on public.maglev_meet for insert with check (true);
create policy "maglev update" on public.maglev_meet for update using (true);

grant select, insert, update on public.maglev_meet to anon, authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'maglev_meet'
  ) then
    alter publication supabase_realtime add table public.maglev_meet;
  end if;
end $$;
