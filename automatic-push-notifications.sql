-- USMAN YOBE TALK SHOW: AUTOMATIC PUSH NOTIFICATIONS
-- Run after deploying the updated send-push-notification Edge Function.
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;
create extension if not exists supabase_vault with schema vault;

create table if not exists public.push_notification_queue (
 id bigint generated always as identity primary key,
 recipient_id uuid not null references auth.users(id) on delete cascade,
 title text not null, body text not null, url text not null default './',
 preference_key text not null default 'community_activity'
  check(preference_key in ('breaking_news','latest_news','community_activity','messages','events','opportunities')),
 created_at timestamptz not null default now(), processed_at timestamptz, delivery_result jsonb
);
create index if not exists push_notification_queue_pending_idx on public.push_notification_queue(created_at) where processed_at is null;
alter table public.push_notification_queue enable row level security;
revoke all on public.push_notification_queue from anon,authenticated;
grant all on public.push_notification_queue to service_role;

create or replace function public.queue_automatic_push(p_recipient uuid,p_title text,p_body text,p_url text default './',p_preference text default 'community_activity')
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if p_recipient is null then return; end if;
 insert into public.push_notification_queue(recipient_id,title,body,url,preference_key)
 values(p_recipient,left(coalesce(p_title,'USMAN YOBE TALK SHOW'),80),left(coalesce(p_body,'Akwai sabon abu a tasharmu.'),220),coalesce(p_url,'./'),coalesce(p_preference,'community_activity'));
end $$;
revoke all on function public.queue_automatic_push(uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.queue_automatic_push(uuid,text,text,text,text) to service_role;

create or replace function public.push_after_forum_post()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform public.queue_automatic_push(f.follower_id,'Sabon post a Community',coalesce(nullif(new.author_name,''),'A member')||' ya wallafa sabon post.','./?communityPost='||new.id,'community_activity')
 from public.member_follows f where f.following_id=new.user_id and f.follower_id<>new.user_id;
 return new;
end $$;

create or replace function public.push_after_forum_like()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_owner uuid;
begin
 select user_id into v_owner from public.forum_posts where id=new.post_id;
 if v_owner is not null and v_owner<>new.user_id then
  perform public.queue_automatic_push(v_owner,'An yi Like a post ɗinka','Wani ya yi Like a post ɗinka.','./?communityPost='||new.post_id,'community_activity');
 end if;
 return new;
end $$;

create or replace function public.push_after_forum_comment()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_owner uuid; v_parent_owner uuid;
begin
 select user_id into v_owner from public.forum_posts where id=new.post_id;
 if v_owner is not null and v_owner<>new.user_id then
  perform public.queue_automatic_push(v_owner,'Sabon comment a post ɗinka',coalesce(nullif(new.author_name,''),'Wani member')||' ya yi comment a post ɗinka.','./?communityPost='||new.post_id,'community_activity');
 end if;
 if new.parent_comment_id is not null then
  select user_id into v_parent_owner from public.forum_comments where id=new.parent_comment_id;
  if v_parent_owner is not null and v_parent_owner<>new.user_id and v_parent_owner is distinct from v_owner then
   perform public.queue_automatic_push(v_parent_owner,'An yi reply ga comment ɗinka',coalesce(nullif(new.author_name,''),'Wani member')||' ya amsa comment ɗinka.','./?communityPost='||new.post_id,'community_activity');
  end if;
 end if;
 return new;
end $$;

create or replace function public.push_after_community_message()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.receiver_id is not null and new.receiver_id<>new.sender_id then
  perform public.queue_automatic_push(new.receiver_id,'Sabon saƙo',left(coalesce(new.body,'An turo maka da sabon saƙo.'),180),'./','messages');
 end if;
 return new;
end $$;

create or replace function public.push_after_friend_request()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.status='pending' and new.sender_id is distinct from new.receiver_id then
  perform public.queue_automatic_push(new.receiver_id,'Sabuwar Friend Request','Wani member ya aiko maka da buƙatar zama aboki.','./','community_activity');
 end if;
 return new;
end $$;

create or replace function public.push_after_news_published()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_pref text;
begin
 if new.status='published' and (tg_op='INSERT' or old.status is distinct from 'published') then
  v_pref := case when lower(coalesce(new.category,'')) like '%breaking%' then 'breaking_news' else 'latest_news' end;
  insert into public.push_notification_queue(recipient_id,title,body,url,preference_key)
  select distinct ps.user_id,left(coalesce(nullif(new.title,''),'Sabon labari'),80),
   left(coalesce(nullif(new.excerpt,''),'An wallafa sabon labari a USMAN YOBE TALK SHOW.'),220),
   './?news='||new.id,v_pref
  from public.push_subscriptions ps where ps.user_id is not null;
 end if;
 return new;
end $$;

do $$
begin
 if to_regclass('public.forum_posts') is not null then
  execute 'drop trigger if exists trg_push_forum_post on public.forum_posts';
  execute 'create trigger trg_push_forum_post after insert on public.forum_posts for each row execute function public.push_after_forum_post()';
 end if;
 if to_regclass('public.forum_likes') is not null then
  execute 'drop trigger if exists trg_push_forum_like on public.forum_likes';
  execute 'create trigger trg_push_forum_like after insert on public.forum_likes for each row execute function public.push_after_forum_like()';
 end if;
 if to_regclass('public.forum_comments') is not null then
  execute 'drop trigger if exists trg_push_forum_comment on public.forum_comments';
  execute 'create trigger trg_push_forum_comment after insert on public.forum_comments for each row execute function public.push_after_forum_comment()';
 end if;
 if to_regclass('public.community_messages') is not null then
  execute 'drop trigger if exists trg_push_community_message on public.community_messages';
  execute 'create trigger trg_push_community_message after insert on public.community_messages for each row execute function public.push_after_community_message()';
 end if;
 if to_regclass('public.friend_requests') is not null then
  execute 'drop trigger if exists trg_push_friend_request on public.friend_requests';
  execute 'create trigger trg_push_friend_request after insert on public.friend_requests for each row execute function public.push_after_friend_request()';
 end if;
 if to_regclass('public.news_posts') is not null then
  execute 'drop trigger if exists trg_push_news_published on public.news_posts';
  execute 'create trigger trg_push_news_published after insert or update of status on public.news_posts for each row execute function public.push_after_news_published()';
 end if;
end $$;

-- Add TWO secrets in Dashboard > Database > Vault:
-- push_project_url = https://latxtetkscajmbqppnad.supabase.co
-- push_service_role_key = your project's service_role key. Never share or publish it.
-- Then rerun this file to activate the one-minute automatic worker.
do $$
declare v_url text; v_key text;
begin
 select decrypted_secret into v_url from vault.decrypted_secrets where name='push_project_url' limit 1;
 select decrypted_secret into v_key from vault.decrypted_secrets where name='push_service_role_key' limit 1;
 if v_url is not null and v_key is not null then
  perform cron.unschedule(jobid) from cron.job where jobname='usman-yobe-automatic-push';
  perform cron.schedule('usman-yobe-automatic-push','* * * * *',
   format($job$select net.http_post(url := %L,headers := jsonb_build_object('Content-Type','application/json','Authorization',%L),body := '{"mode":"process_queue"}'::jsonb);$job$,
    rtrim(v_url,'/')||'/functions/v1/send-push-notification','Bearer '||v_key));
 else
  raise notice 'Database triggers installed. Add both Vault secrets, then rerun this SQL file to start the worker.';
 end if;
end $$;
