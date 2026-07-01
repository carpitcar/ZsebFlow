create table if not exists public.payment_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  system_key text,
  icon text,
  color text,
  is_active boolean not null default true,
  use_for_income boolean not null default true,
  use_for_expense boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_sources_name_not_blank check (length(btrim(name)) > 0),
  constraint payment_sources_system_key_check check (
    system_key is null or system_key ~ '^[a-z0-9_]+$'
  )
);

create unique index if not exists payment_sources_user_id_lower_name_idx
  on public.payment_sources (user_id, lower(btrim(name)));

create index if not exists payment_sources_user_id_idx
  on public.payment_sources (user_id);

create index if not exists payment_sources_user_id_is_active_idx
  on public.payment_sources (user_id, is_active);

create index if not exists payment_sources_user_id_sort_order_idx
  on public.payment_sources (user_id, sort_order);

create unique index if not exists payment_sources_user_id_system_key_idx
  on public.payment_sources (user_id, system_key)
  where system_key is not null;

alter table public.payment_sources enable row level security;

drop policy if exists "Users can select own payment sources" on public.payment_sources;
create policy "Users can select own payment sources"
  on public.payment_sources
  for select
  using (user_id = auth.uid());

drop policy if exists "Users can insert own payment sources" on public.payment_sources;
create policy "Users can insert own payment sources"
  on public.payment_sources
  for insert
  with check (user_id = auth.uid());

drop policy if exists "Users can update own payment sources" on public.payment_sources;
create policy "Users can update own payment sources"
  on public.payment_sources
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users can delete own payment sources" on public.payment_sources;
create policy "Users can delete own payment sources"
  on public.payment_sources
  for delete
  using (user_id = auth.uid());

drop trigger if exists payment_sources_set_updated_at on public.payment_sources;
create trigger payment_sources_set_updated_at
  before update on public.payment_sources
  for each row
  execute function public.set_updated_at();

alter table public.transactions
add column if not exists payment_source_id uuid references public.payment_sources(id);

create index if not exists transactions_payment_source_id_idx
  on public.transactions (payment_source_id);

insert into public.payment_sources (
  user_id,
  name,
  system_key,
  icon,
  color,
  sort_order
)
select profile_defaults.user_id,
       profile_defaults.name,
       profile_defaults.system_key,
       profile_defaults.icon,
       profile_defaults.color,
       profile_defaults.sort_order
from (
  select profiles.id as user_id,
         defaults.name,
         defaults.system_key,
         defaults.icon,
         defaults.color,
         defaults.sort_order
  from public.profiles
  cross join (
    values
      ('Bankszámla', 'bank_transfer', '🏦', '#2563eb', 10),
      ('Bankkártya', 'card', '💳', '#7c3aed', 20),
      ('Készpénz', 'cash', '💵', '#16a34a', 30),
      ('Revolut', 'revolut', 'R', '#06b6d4', 40),
      ('SZÉP-kártya', 'szep_card', '✚', '#f59e0b', 50),
      ('Egészségpénztár', 'health_fund', '+', '#dc2626', 60)
  ) as defaults(name, system_key, icon, color, sort_order)
) as profile_defaults
on conflict (user_id, (lower(btrim(name)))) do nothing;
