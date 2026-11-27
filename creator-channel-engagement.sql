-- USMAN YOBE TALK SHOW: Creator Channel post engagement
-- Additive migration; preserves all existing posts, reels, likes and comments.
create extension if not exists pgcrypto;

create table if not exists public.social_post_likes (
  post_id uuid not null references public.forum_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table public.social_post_likes enable row level security;
drop policy if exists "Post likes readable by members" on public.social_post_likes;
create policy "Post likes readable by members" on public.social_post_likes
for select to authenticated using (true);
drop policy if exists "Members like posts as themselves" on public.social_post_likes;
create policy "Members like posts as themselves" on public.social_post_likes
for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Members remove own post likes" on public.social_post_likes;
create policy "Members remove own post likes" on public.social_post_likes
for delete to authenticated using (auth.uid() = user_id);
grant select, insert, delete on public.social_post_likes to authenticated;

create table if not exists public.social_post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.forum_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(trim(content)) between 1 and 800),
  created_at timestamptz not null default now()
);
alter table public.social_post_comments enable row level security;
drop policy if exists "Post comments readable by members" on public.social_post_comments;
create policy "Post comments readable by members" on public.social_post_comments
for select to authenticated using (true);
drop policy if exists "Members comment on posts as themselves" on public.social_post_comments;
create policy "Members comment on posts as themselves" on public.social_post_comments
for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Members delete own post comments" on public.social_post_comments;
create policy "Members delete own post comments" on public.social_post_comments
for delete to authenticated using (auth.uid() = user_id);
grant select, insert, delete on public.social_post_comments to authenticated;

create index if not exists social_post_likes_post_idx on public.social_post_likes(post_id);
create index if not exists social_post_comments_post_created_idx on public.social_post_comments(post_id, created_at);
