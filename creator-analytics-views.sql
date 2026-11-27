-- Creator analytics: unique Reel viewers. Safe additive migration.
create table if not exists public.social_reel_views (
 reel_id uuid not null references public.social_reels(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 first_viewed_at timestamptz not null default now(),
 primary key (reel_id,user_id)
);
alter table public.social_reel_views enable row level security;
drop policy if exists "Members can read reel view totals" on public.social_reel_views;
create policy "Members can read reel view totals" on public.social_reel_views
for select to authenticated using (true);
drop policy if exists "Members record own reel views" on public.social_reel_views;
create policy "Members record own reel views" on public.social_reel_views
for insert to authenticated with check (auth.uid()=user_id);
grant select,insert on public.social_reel_views to authenticated;
create index if not exists social_reel_views_reel_idx on public.social_reel_views(reel_id);
