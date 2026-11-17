create table if not exists public.saved_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_type text not null check (item_type in ('news')),
  item_id text not null,
  created_at timestamptz not null default now(),
  unique (user_id, item_type, item_id)
);

-- Fix existing installations where item_id was mistakenly created as UUID.
alter table public.saved_items
  alter column item_id type text using item_id::text;

alter table public.saved_items enable row level security;

drop policy if exists "Members read own saved items" on public.saved_items;
create policy "Members read own saved items"
  on public.saved_items for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Members save own items" on public.saved_items;
create policy "Members save own items"
  on public.saved_items for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Members remove own saved items" on public.saved_items;
create policy "Members remove own saved items"
  on public.saved_items for delete to authenticated
  using (auth.uid() = user_id);

grant select, insert, delete on public.saved_items to authenticated;
