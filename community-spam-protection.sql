-- USMAN YOBE COMMUNITY SPAM PROTECTION
-- Run once in Supabase SQL Editor. This protects forum_posts at database level.
create or replace function public.uy_guard_forum_post_spam()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid;
  v_recent_count integer;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'Dole sai ka shiga account kafin wallafa post.'
      using errcode = '42501';
  end if;

  -- Serialize concurrent post attempts by the same member.
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 0));

  select count(*) into v_recent_count
  from public.forum_posts p
  where p.user_id = v_uid
    and p.created_at >= now() - interval '60 seconds';

  if v_recent_count >= 5 then
    raise exception 'An dakatar da wallafa posts na dan lokaci: ka jira minti daya kafin sake wallafawa.'
      using errcode = '23514';
  end if;

  if nullif(btrim(coalesce(new.content, '')), '') is not null
     and exists (
       select 1
       from public.forum_posts p
       where p.user_id = v_uid
         and lower(btrim(coalesce(p.content, ''))) = lower(btrim(new.content))
         and p.created_at >= now() - interval '5 minutes'
     ) then
    raise exception 'Wannan rubutun ya yi kama da post din da ka wallafa kwanan nan. Ka guji maimaita post iri daya.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists uy_forum_posts_spam_guard on public.forum_posts;
create trigger uy_forum_posts_spam_guard
before insert on public.forum_posts
for each row execute function public.uy_guard_forum_post_spam();

-- Ensure authenticated members can execute the trigger function indirectly.
revoke all on function public.uy_guard_forum_post_spam() from public;
grant execute on function public.uy_guard_forum_post_spam() to authenticated;



-- Add conservative rate limiting to comments as well as posts.
create or replace function public.uy_guard_forum_comment_spam()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid;
  v_recent_count integer;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'Dole sai ka shiga account kafin yin comment.'
      using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_uid::text || ':comments', 0));

  select count(*) into v_recent_count
  from public.forum_comments c
  where c.user_id = v_uid
    and c.created_at >= now() - interval '60 seconds';

  if v_recent_count >= 10 then
    raise exception 'Ka yi comments da yawa cikin kankanin lokaci. Jira minti daya kafin sake yin comment.'
      using errcode = '23514';
  end if;

  if nullif(btrim(coalesce(new.content, '')), '') is not null
     and exists (
       select 1
       from public.forum_comments c
       where c.user_id = v_uid
         and lower(btrim(coalesce(c.content, ''))) = lower(btrim(new.content))
         and c.created_at >= now() - interval '3 minutes'
     ) then
    raise exception 'Wannan comment din ya yi kama da wanda ka aika kwanan nan.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists uy_forum_comments_spam_guard on public.forum_comments;
create trigger uy_forum_comments_spam_guard
before insert on public.forum_comments
for each row execute function public.uy_guard_forum_comment_spam();

revoke all on function public.uy_guard_forum_comment_spam() from public;
grant execute on function public.uy_guard_forum_comment_spam() to authenticated;
