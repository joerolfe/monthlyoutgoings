-- Run once in Supabase: Dashboard → SQL Editor → New query → paste → Run.
create table if not exists public.trackers (
  user_id    uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.trackers enable row level security;

-- Each signed-in user can only see and change their own row.
drop policy if exists "read own"   on public.trackers;
drop policy if exists "insert own" on public.trackers;
drop policy if exists "update own" on public.trackers;
drop policy if exists "delete own" on public.trackers;
create policy "read own"   on public.trackers for select using (auth.uid() = user_id);
create policy "insert own" on public.trackers for insert with check (auth.uid() = user_id);
create policy "update own" on public.trackers for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own" on public.trackers for delete using (auth.uid() = user_id);

-- Live updates between devices (phone <-> laptop).
do $$ begin
  alter publication supabase_realtime add table public.trackers;
exception when duplicate_object then null; end $$;
