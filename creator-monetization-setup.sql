-- USMAN YOBE TALK SHOW: Creator Monetization Foundation
-- Run this once in Supabase SQL Editor for project latxtetkscajmbqppnad.
-- This creates creator applications and a read-only earnings ledger.
-- It does NOT automatically pay creators or reward raw views/likes.

create table if not exists public.creator_applications (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 2 and 80),
  bio text not null default '' check (char_length(bio) <= 500),
  social_link text not null default '' check (char_length(social_link) <= 300),
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','suspended')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id)
);

create index if not exists creator_applications_status_created_idx
  on public.creator_applications(status, created_at desc);

alter table public.creator_applications enable row level security;

drop policy if exists "Creators can view own application" on public.creator_applications;
create policy "Creators can view own application"
  on public.creator_applications for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Members can apply as creator" on public.creator_applications;
create policy "Members can apply as creator"
  on public.creator_applications for insert
  to authenticated
  with check (auth.uid() = user_id and status = 'pending');

-- Earnings are written only by trusted server-side/admin processes.
create table if not exists public.creator_earnings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_type text not null check (source_type in ('sponsor','platform_ads','bonus','adjustment')),
  source_label text not null default '',
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null default 'NGN' check (currency = 'NGN'),
  status text not null default 'pending'
    check (status in ('pending','approved','paid','reversed')),
  reference text unique,
  note text not null default '',
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists creator_earnings_user_status_idx
  on public.creator_earnings(user_id, status, created_at desc);

alter table public.creator_earnings enable row level security;

drop policy if exists "Creators can view own earnings" on public.creator_earnings;
create policy "Creators can view own earnings"
  on public.creator_earnings for select
  to authenticated
  using (auth.uid() = user_id);

-- No INSERT/UPDATE/DELETE policy is granted to ordinary members.
-- Admin/server processes must record earnings only after real sponsor/ad revenue
-- has been received and validated. Never reward likes/views directly.
