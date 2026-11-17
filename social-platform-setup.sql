-- USMAN YOBE TALK SHOW: Social Platform foundation
-- Run this entire script in Supabase SQL Editor. Safe to run more than once.
create extension if not exists pgcrypto;

create table if not exists public.social_reels (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 title text not null check (char_length(title) between 1 and 100), video_url text not null,
 caption text default '', created_at timestamptz not null default now()
);
alter table public.social_reels enable row level security;
drop policy if exists "Reels public read" on public.social_reels;
create policy "Reels public read" on public.social_reels for select to authenticated using (true);
drop policy if exists "Users publish own reels" on public.social_reels;
create policy "Users publish own reels" on public.social_reels for insert to authenticated with check (auth.uid()=user_id);
drop policy if exists "Users delete own reels" on public.social_reels;
create policy "Users delete own reels" on public.social_reels for delete to authenticated using (auth.uid()=user_id);
grant select,insert,delete on public.social_reels to authenticated;

create table if not exists public.social_groups (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
 name text not null check (char_length(name) between 1 and 80), about text default '',
 privacy text not null default 'public' check (privacy in ('public','private')),
 created_at timestamptz not null default now()
);
alter table public.social_groups enable row level security;
-- Group visibility policy is added after the membership table is created.
drop policy if exists "Members create groups" on public.social_groups;
create policy "Members create groups" on public.social_groups for insert to authenticated with check (auth.uid()=owner_id);
drop policy if exists "Owners update groups" on public.social_groups;
create policy "Owners update groups" on public.social_groups for update to authenticated using (auth.uid()=owner_id) with check (auth.uid()=owner_id);
drop policy if exists "Owners delete groups" on public.social_groups;
create policy "Owners delete groups" on public.social_groups for delete to authenticated using (auth.uid()=owner_id);
grant select,insert,update,delete on public.social_groups to authenticated;

create table if not exists public.social_group_members (
 group_id uuid not null references public.social_groups(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null default 'member' check (role in ('admin','moderator','member')),
 joined_at timestamptz not null default now(), primary key(group_id,user_id)
);
alter table public.social_group_members enable row level security;
drop policy if exists "Group members readable" on public.social_group_members;
create policy "Group members readable" on public.social_group_members for select to authenticated using (true);
drop policy if exists "Users join groups" on public.social_group_members;
create policy "Users join groups" on public.social_group_members for insert to authenticated
with check (
 auth.uid()=user_id
 and (
   role='member'
   or exists(select 1 from public.social_groups g where g.id=group_id and g.owner_id=auth.uid() and role='admin')
 )
);
drop policy if exists "Users leave groups" on public.social_group_members;
create policy "Users leave groups" on public.social_group_members for delete to authenticated using (auth.uid()=user_id);
grant select,insert,delete on public.social_group_members to authenticated;

drop policy if exists "Public groups readable" on public.social_groups;
create policy "Public groups readable" on public.social_groups for select to authenticated using (privacy='public' or owner_id=auth.uid() or exists(select 1 from public.social_group_members m where m.group_id=id and m.user_id=auth.uid()));

create table if not exists public.social_marketplace (
 id uuid primary key default gen_random_uuid(), seller_id uuid not null references auth.users(id) on delete cascade,
 title text not null check (char_length(title) between 1 and 100), price_ngn numeric(14,2) not null check(price_ngn>=0),
 image_url text, contact text default '', description text default '',
 status text not null default 'active' check(status in ('active','sold','hidden')),
 created_at timestamptz not null default now()
);
alter table public.social_marketplace enable row level security;
drop policy if exists "Active listings readable" on public.social_marketplace;
create policy "Active listings readable" on public.social_marketplace for select to authenticated using (status='active' or seller_id=auth.uid());
drop policy if exists "Sellers create listings" on public.social_marketplace;
create policy "Sellers create listings" on public.social_marketplace for insert to authenticated with check (auth.uid()=seller_id);
drop policy if exists "Sellers update listings" on public.social_marketplace;
create policy "Sellers update listings" on public.social_marketplace for update to authenticated using (auth.uid()=seller_id) with check (auth.uid()=seller_id);
drop policy if exists "Sellers delete listings" on public.social_marketplace;
create policy "Sellers delete listings" on public.social_marketplace for delete to authenticated using (auth.uid()=seller_id);
grant select,insert,update,delete on public.social_marketplace to authenticated;

create table if not exists public.social_live_sessions (
 id uuid primary key default gen_random_uuid(), host_id uuid not null references auth.users(id) on delete cascade,
 title text not null check (char_length(title) between 1 and 100), stream_url text not null,
 starts_at timestamptz not null default now(), status text not null default 'scheduled' check(status in ('scheduled','live','ended','cancelled')),
 created_at timestamptz not null default now()
);
alter table public.social_live_sessions enable row level security;
drop policy if exists "Live sessions readable" on public.social_live_sessions;
create policy "Live sessions readable" on public.social_live_sessions for select to authenticated using (true);
drop policy if exists "Hosts create live sessions" on public.social_live_sessions;
create policy "Hosts create live sessions" on public.social_live_sessions for insert to authenticated with check (auth.uid()=host_id);
drop policy if exists "Hosts update live sessions" on public.social_live_sessions;
create policy "Hosts update live sessions" on public.social_live_sessions for update to authenticated using (auth.uid()=host_id) with check (auth.uid()=host_id);
drop policy if exists "Hosts delete live sessions" on public.social_live_sessions;
create policy "Hosts delete live sessions" on public.social_live_sessions for delete to authenticated using (auth.uid()=host_id);
grant select,insert,update,delete on public.social_live_sessions to authenticated;

create index if not exists social_reels_created_idx on public.social_reels(created_at desc);
create index if not exists social_groups_created_idx on public.social_groups(created_at desc);
create index if not exists social_marketplace_created_idx on public.social_marketplace(created_at desc);
create index if not exists social_live_starts_idx on public.social_live_sessions(starts_at);
