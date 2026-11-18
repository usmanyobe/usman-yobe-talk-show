-- USMAN YOBE TALK SHOW: Ads, reports, contact, notification preferences and analytics
create extension if not exists pgcrypto;

create table if not exists public.app_advertisements (
 id uuid primary key default gen_random_uuid(),
 title text not null check(char_length(title) between 2 and 160),
 description text not null default '',
 image_url text,
 target_url text,
 placement text not null default 'home' check(placement in ('home','more','all')),
 status text not null default 'draft' check(status in ('draft','active','paused')),
 starts_at timestamptz,
 ends_at timestamptz,
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now()
);
alter table public.app_advertisements enable row level security;
drop policy if exists "Public read active advertisements" on public.app_advertisements;
create policy "Public read active advertisements" on public.app_advertisements for select to anon,authenticated using(status='active' and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>=now()));
drop policy if exists "Admins manage advertisements" on public.app_advertisements;
create policy "Admins manage advertisements" on public.app_advertisements for all to authenticated using(public.is_admin()) with check(public.is_admin());
grant select on public.app_advertisements to anon,authenticated;
grant insert,update,delete on public.app_advertisements to authenticated;

create table if not exists public.news_corrections (
 id uuid primary key default gen_random_uuid(),
 reporter_id uuid references auth.users(id) on delete set null,
 news_id text,
 news_title text not null,
 report_type text not null default 'correction' check(report_type in ('correction','complaint','fact_check','other')),
 details text not null check(char_length(details) between 5 and 4000),
 contact text,
 status text not null default 'pending' check(status in ('pending','reviewing','resolved','dismissed')),
 created_at timestamptz not null default now()
);
alter table public.news_corrections enable row level security;
drop policy if exists "Members submit news corrections" on public.news_corrections;
create policy "Members submit news corrections" on public.news_corrections for insert to authenticated with check(reporter_id=auth.uid());
drop policy if exists "Admins review news corrections" on public.news_corrections;
create policy "Admins review news corrections" on public.news_corrections for select to authenticated using(public.is_admin());
grant insert,select on public.news_corrections to authenticated;

create table if not exists public.contact_messages (
 id uuid primary key default gen_random_uuid(),
 user_id uuid references auth.users(id) on delete set null,
 name text not null,
 email text,
 subject text not null,
 message text not null check(char_length(message) between 5 and 4000),
 status text not null default 'new' check(status in ('new','read','replied','closed')),
 created_at timestamptz not null default now()
);
alter table public.contact_messages enable row level security;
drop policy if exists "Members send contact messages" on public.contact_messages;
create policy "Members send contact messages" on public.contact_messages for insert to authenticated with check(user_id=auth.uid());
drop policy if exists "Admins read contact messages" on public.contact_messages;
create policy "Admins read contact messages" on public.contact_messages for select to authenticated using(public.is_admin());
grant insert,select on public.contact_messages to authenticated;

create table if not exists public.notification_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 breaking_news boolean not null default true,
 latest_news boolean not null default true,
 community_activity boolean not null default true,
 messages boolean not null default true,
 events boolean not null default true,
 opportunities boolean not null default true,
 push_enabled boolean not null default false,
 updated_at timestamptz not null default now()
);
alter table public.notification_preferences enable row level security;
drop policy if exists "Users manage own notification preferences" on public.notification_preferences;
create policy "Users manage own notification preferences" on public.notification_preferences for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
grant select,insert,update on public.notification_preferences to authenticated;

create table if not exists public.app_analytics_events (
 id bigint generated always as identity primary key,
 user_id uuid references auth.users(id) on delete set null,
 event_type text not null check(event_type in ('page_view','ad_click','ad_impression','news_report','contact_message')),
 page_name text,
 item_id text,
 created_at timestamptz not null default now()
);
alter table public.app_analytics_events enable row level security;
drop policy if exists "Members record own analytics events" on public.app_analytics_events;
create policy "Members record own analytics events" on public.app_analytics_events for insert to authenticated with check(user_id=auth.uid());
drop policy if exists "Admins read analytics events" on public.app_analytics_events;
create policy "Admins read analytics events" on public.app_analytics_events for select to authenticated using(public.is_admin());
grant insert,select on public.app_analytics_events to authenticated;
create index if not exists app_analytics_created_idx on public.app_analytics_events(created_at desc);
create index if not exists app_ads_status_idx on public.app_advertisements(status,created_at desc);
create index if not exists news_corrections_status_idx on public.news_corrections(status,created_at desc);
create index if not exists contact_messages_status_idx on public.contact_messages(status,created_at desc);

create or replace function public.get_app_admin_analytics()
returns jsonb
language plpgsql
security definer
set search_path=public,auth
as $$
declare result jsonb;
begin
 if not public.is_admin() then raise exception 'Admin access required'; end if;
 select jsonb_build_object(
  'total_users',(select count(*) from auth.users),
  'news_total',(select count(*) from public.news_posts),
  'news_published',(select count(*) from public.news_posts where status='published'),
  'ads_active',(select count(*) from public.app_advertisements where status='active'),
  'reports_pending',(select count(*) from public.news_corrections where status='pending'),
  'messages_new',(select count(*) from public.contact_messages where status='new'),
  'views_7d',(select count(*) from public.app_analytics_events where event_type='page_view' and created_at>=now()-interval '7 days'),
  'ad_clicks_7d',(select count(*) from public.app_analytics_events where event_type='ad_click' and created_at>=now()-interval '7 days'),
  'reports_total',(select count(*) from public.news_corrections),
  'contacts_total',(select count(*) from public.contact_messages)
 ) into result;
 return result;
end $$;
revoke all on function public.get_app_admin_analytics() from public;
grant execute on function public.get_app_admin_analytics() to authenticated;
