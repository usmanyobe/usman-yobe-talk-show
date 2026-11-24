-- Run this once in Supabase SQL Editor for USMAN YOBE TALK SHOW.
alter table public.news_posts
add column if not exists show_on_main_news boolean not null default false;

comment on column public.news_posts.show_on_main_news is
'When true, a post from a dedicated partner page is also included in the main News feed.';
