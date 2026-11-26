-- Run once in Supabase: Dashboard → SQL Editor → New query → paste → Run.
-- Sign up in the app first: read access is pinned to the first account created in this project (yours).
create table if not exists public.monzo_transactions (
  id            text primary key,          -- Monzo transaction id (tx_...)
  amount_pence  integer not null,          -- negative = money out
  currency      text not null,
  merchant_name text,
  category      text,
  description   text,
  created_at    timestamptz not null,
  settled       timestamptz,
  raw           jsonb not null
);

create index if not exists monzo_transactions_created_at on public.monzo_transactions (created_at);

-- RLS on with no insert/update/delete policies: only the service role key (server side) can write.
alter table public.monzo_transactions enable row level security;

drop policy if exists "owner can read" on public.monzo_transactions;
do $$
declare owner_id uuid;
begin
  select id into owner_id from auth.users order by created_at limit 1;
  if owner_id is null then raise exception 'No user yet: create your account in the app first'; end if;
  execute format(
    'create policy "owner can read" on public.monzo_transactions for select to authenticated using (auth.uid() = %L::uuid)',
    owner_id);
end $$;

-- Live updates in the tracker when a new transaction lands.
do $$ begin
  alter publication supabase_realtime add table public.monzo_transactions;
exception when duplicate_object then null; end $$;
