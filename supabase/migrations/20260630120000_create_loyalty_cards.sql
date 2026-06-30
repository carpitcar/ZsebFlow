create table if not exists public.loyalty_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  provider text,
  card_number text,
  barcode_value text,
  barcode_format text,
  front_image_path text,
  back_image_path text,
  color text,
  icon text,
  notes text,
  is_favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists loyalty_cards_user_id_is_favorite_idx
  on public.loyalty_cards (user_id, is_favorite);

create index if not exists loyalty_cards_user_id_name_idx
  on public.loyalty_cards (user_id, name);

create index if not exists loyalty_cards_user_id_created_at_idx
  on public.loyalty_cards (user_id, created_at);

drop trigger if exists loyalty_cards_set_updated_at on public.loyalty_cards;
create trigger loyalty_cards_set_updated_at
  before update on public.loyalty_cards
  for each row
  execute function public.set_updated_at();

alter table public.loyalty_cards enable row level security;

drop policy if exists "Users can select own loyalty cards" on public.loyalty_cards;
create policy "Users can select own loyalty cards"
  on public.loyalty_cards
  for select
  using (user_id = auth.uid());

drop policy if exists "Users can insert own loyalty cards" on public.loyalty_cards;
create policy "Users can insert own loyalty cards"
  on public.loyalty_cards
  for insert
  with check (user_id = auth.uid());

drop policy if exists "Users can update own loyalty cards" on public.loyalty_cards;
create policy "Users can update own loyalty cards"
  on public.loyalty_cards
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users can delete own loyalty cards" on public.loyalty_cards;
create policy "Users can delete own loyalty cards"
  on public.loyalty_cards
  for delete
  using (user_id = auth.uid());

insert into storage.buckets (id, name, public)
values ('loyalty-cards', 'loyalty-cards', false)
on conflict (id) do update set public = false;

drop policy if exists "Users can read own loyalty card images" on storage.objects;
create policy "Users can read own loyalty card images"
  on storage.objects
  for select
  using (
    bucket_id = 'loyalty-cards'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can upload own loyalty card images" on storage.objects;
create policy "Users can upload own loyalty card images"
  on storage.objects
  for insert
  with check (
    bucket_id = 'loyalty-cards'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can update own loyalty card images" on storage.objects;
create policy "Users can update own loyalty card images"
  on storage.objects
  for update
  using (
    bucket_id = 'loyalty-cards'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'loyalty-cards'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can delete own loyalty card images" on storage.objects;
create policy "Users can delete own loyalty card images"
  on storage.objects
  for delete
  using (
    bucket_id = 'loyalty-cards'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
