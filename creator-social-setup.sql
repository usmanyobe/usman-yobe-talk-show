-- USMAN YOBE TALK SHOW: Reels likes and comments
-- Additive migration. Does not alter or delete existing users, posts, or reels.
create extension if not exists pgcrypto;

create table if not exists public.social_reel_likes (
  reel_id uuid not null references public.social_reels(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (reel_id,user_id)
);
alter table public.social_reel_likes enable row level security;
drop policy if exists "Reel likes readable by members" on public.social_reel_likes;
create policy "Reel likes readable by members" on public.social_reel_likes
for select to authenticated using (true);
drop policy if exists "Members like reels as themselves" on public.social_reel_likes;
create policy "Members like reels as themselves" on public.social_reel_likes
for insert to authenticated with check (auth.uid()=user_id);
drop policy if exists "Members remove own reel likes" on public.social_reel_likes;
create policy "Members remove own reel likes" on public.social_reel_likes
for delete to authenticated using (auth.uid()=user_id);
grant select,insert,delete on public.social_reel_likes to authenticated;

create table if not exists public.social_reel_comments (
  id uuid primary key default gen_random_uuid(),
  reel_id uuid not null references public.social_reels(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(trim(content)) between 1 and 800),
  created_at timestamptz not null default now()
);
alter table public.social_reel_comments enable row level security;
drop policy if exists "Reel comments readable by members" on public.social_reel_comments;
create policy "Reel comments readable by members" on public.social_reel_comments
for select to authenticated using (true);
drop policy if exists "Members comment as themselves" on public.social_reel_comments;
create policy "Members comment as themselves" on public.social_reel_comments
for insert to authenticated with check (auth.uid()=user_id);
drop policy if exists "Members delete own reel comments" on public.social_reel_comments;
create policy "Members delete own reel comments" on public.social_reel_comments
for delete to authenticated using (auth.uid()=user_id);
grant select,insert,delete on public.social_reel_comments to authenticated;

create index if not exists social_reel_likes_reel_idx on public.social_reel_likes(reel_id);
create index if not exists social_reel_comments_reel_created_idx on public.social_reel_comments(reel_id,created_at);
