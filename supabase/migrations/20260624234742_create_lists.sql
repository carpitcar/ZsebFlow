create table if not exists public.lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  list_type text not null default 'custom',
  icon text,
  color text,
  due_date date,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lists_list_type_check check (
    list_type in ('shopping', 'tasks', 'reminder', 'custom')
  )
);

create table if not exists public.list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists(id) on delete cascade,
  title text not null,
  notes text,
  quantity numeric,
  unit text,
  due_at timestamptz,
  priority text not null default 'normal',
  is_completed boolean not null default false,
  completed_at timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint list_items_priority_check check (
    priority in ('low', 'normal', 'high')
  )
);

create index if not exists lists_user_id_is_archived_idx
  on public.lists (user_id, is_archived);

create index if not exists lists_user_id_created_at_idx
  on public.lists (user_id, created_at);

create index if not exists list_items_list_id_sort_order_idx
  on public.list_items (list_id, sort_order);

create index if not exists list_items_list_id_is_completed_idx
  on public.list_items (list_id, is_completed);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists lists_set_updated_at on public.lists;
create trigger lists_set_updated_at
  before update on public.lists
  for each row
  execute function public.set_updated_at();

drop trigger if exists list_items_set_updated_at on public.list_items;
create trigger list_items_set_updated_at
  before update on public.list_items
  for each row
  execute function public.set_updated_at();

alter table public.lists enable row level security;
alter table public.list_items enable row level security;

drop policy if exists "Users can select own lists" on public.lists;
create policy "Users can select own lists"
  on public.lists
  for select
  using (user_id = auth.uid());

drop policy if exists "Users can insert own lists" on public.lists;
create policy "Users can insert own lists"
  on public.lists
  for insert
  with check (user_id = auth.uid());

drop policy if exists "Users can update own lists" on public.lists;
create policy "Users can update own lists"
  on public.lists
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users can delete own lists" on public.lists;
create policy "Users can delete own lists"
  on public.lists
  for delete
  using (user_id = auth.uid());

drop policy if exists "Users can select own list items" on public.list_items;
create policy "Users can select own list items"
  on public.list_items
  for select
  using (
    exists (
      select 1
      from public.lists
      where lists.id = list_items.list_id
        and lists.user_id = auth.uid()
    )
  );

drop policy if exists "Users can insert own list items" on public.list_items;
create policy "Users can insert own list items"
  on public.list_items
  for insert
  with check (
    exists (
      select 1
      from public.lists
      where lists.id = list_items.list_id
        and lists.user_id = auth.uid()
    )
  );

drop policy if exists "Users can update own list items" on public.list_items;
create policy "Users can update own list items"
  on public.list_items
  for update
  using (
    exists (
      select 1
      from public.lists
      where lists.id = list_items.list_id
        and lists.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.lists
      where lists.id = list_items.list_id
        and lists.user_id = auth.uid()
    )
  );

drop policy if exists "Users can delete own list items" on public.list_items;
create policy "Users can delete own list items"
  on public.list_items
  for delete
  using (
    exists (
      select 1
      from public.lists
      where lists.id = list_items.list_id
        and lists.user_id = auth.uid()
    )
  );
