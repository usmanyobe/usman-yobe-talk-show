-- USMAN YOBE COMMUNITY: Advanced features migration (additive; preserves existing data)
create extension if not exists pgcrypto;

-- Saved posts/reels/listings: IDs are text so existing UUID or numeric post IDs are supported.
create table if not exists public.community_saved_items (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 item_type text not null check(item_type in ('post','reel','marketplace','event')),
 item_id text not null,
 created_at timestamptz not null default now(),
 unique(user_id,item_type,item_id)
);
alter table public.community_saved_items enable row level security;
drop policy if exists "Users read own saved items" on public.community_saved_items;
create policy "Users read own saved items" on public.community_saved_items for select to authenticated using(auth.uid()=user_id);
drop policy if exists "Users save own items" on public.community_saved_items;
create policy "Users save own items" on public.community_saved_items for insert to authenticated with check(auth.uid()=user_id);
drop policy if exists "Users unsave own items" on public.community_saved_items;
create policy "Users unsave own items" on public.community_saved_items for delete to authenticated using(auth.uid()=user_id);
grant select,insert,delete on public.community_saved_items to authenticated;

create table if not exists public.social_events (
 id uuid primary key default gen_random_uuid(),
 host_id uuid not null references auth.users(id) on delete cascade,
 title text not null check(char_length(title) between 1 and 120),
 description text not null default '',
 venue text not null default '',
 starts_at timestamptz not null,
 cover_url text,
 visibility text not null default 'public' check(visibility in ('public','friends','private')),
 created_at timestamptz not null default now()
);
alter table public.social_events enable row level security;
drop policy if exists "Events visible to members" on public.social_events;
create policy "Events visible to members" on public.social_events for select to authenticated using(visibility='public' or host_id=auth.uid());
drop policy if exists "Members create events" on public.social_events;
create policy "Members create events" on public.social_events for insert to authenticated with check(auth.uid()=host_id);
drop policy if exists "Hosts edit events" on public.social_events;
create policy "Hosts edit events" on public.social_events for update to authenticated using(auth.uid()=host_id) with check(auth.uid()=host_id);
drop policy if exists "Hosts delete events" on public.social_events;
create policy "Hosts delete events" on public.social_events for delete to authenticated using(auth.uid()=host_id);
grant select,insert,update,delete on public.social_events to authenticated;

create table if not exists public.social_event_rsvps (
 event_id uuid not null references public.social_events(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 response text not null default 'going' check(response in ('going','interested','not_going')),
 created_at timestamptz not null default now(),
 primary key(event_id,user_id)
);
alter table public.social_event_rsvps enable row level security;
drop policy if exists "Event RSVP visible to members" on public.social_event_rsvps;
create policy "Event RSVP visible to members" on public.social_event_rsvps for select to authenticated using(true);
drop policy if exists "Members manage own RSVP" on public.social_event_rsvps;
create policy "Members manage own RSVP" on public.social_event_rsvps for insert to authenticated with check(auth.uid()=user_id);
drop policy if exists "Members update own RSVP" on public.social_event_rsvps;
create policy "Members update own RSVP" on public.social_event_rsvps for update to authenticated using(auth.uid()=user_id) with check(auth.uid()=user_id);
drop policy if exists "Members remove own RSVP" on public.social_event_rsvps;
create policy "Members remove own RSVP" on public.social_event_rsvps for delete to authenticated using(auth.uid()=user_id);
grant select,insert,update,delete on public.social_event_rsvps to authenticated;

create table if not exists public.community_content_reports (
 id uuid primary key default gen_random_uuid(),
 reporter_id uuid not null references auth.users(id) on delete cascade,
 target_type text not null check(target_type in ('post','reel','profile','marketplace','event')),
 target_id text not null,
 reason text not null check(reason in ('spam','fake_account','harassment','scam','inappropriate','other')),
 details text not null default '',
 status text not null default 'pending' check(status in ('pending','reviewing','resolved','dismissed')),
 created_at timestamptz not null default now(),
 unique(reporter_id,target_type,target_id)
);
alter table public.community_content_reports enable row level security;
drop policy if exists "Reporters create reports" on public.community_content_reports;
create policy "Reporters create reports" on public.community_content_reports for insert to authenticated with check(auth.uid()=reporter_id);
drop policy if exists "Reporters read own reports" on public.community_content_reports;
create policy "Reporters read own reports" on public.community_content_reports for select to authenticated using(auth.uid()=reporter_id);
grant select,insert on public.community_content_reports to authenticated;

create table if not exists public.community_privacy_settings (
 user_id uuid primary key references auth.users(id) on delete cascade,
 default_post_audience text not null default 'public' check(default_post_audience in ('public','friends','private')),
 show_online boolean not null default true,
 allow_friend_requests boolean not null default true,
 updated_at timestamptz not null default now()
);
alter table public.community_privacy_settings enable row level security;
drop policy if exists "Users manage own privacy settings" on public.community_privacy_settings;
create policy "Users manage own privacy settings" on public.community_privacy_settings for all to authenticated using(auth.uid()=user_id) with check(auth.uid()=user_id);
grant select,insert,update,delete on public.community_privacy_settings to authenticated;

create index if not exists community_saved_items_user_idx on public.community_saved_items(user_id,created_at desc);
create index if not exists social_events_starts_idx on public.social_events(starts_at);
create index if not exists social_event_rsvps_user_idx on public.social_event_rsvps(user_id);
create index if not exists community_reports_status_idx on public.community_content_reports(status,created_at desc);

-- Note: true camera-based live broadcasting needs a streaming/signalling provider;
-- this migration intentionally does not pretend that a scheduled external stream is in-app broadcasting.
