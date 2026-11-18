-- USMAN YOBE TALK SHOW: Secure forum post privacy
-- Additive migration: preserves existing posts and existing permissive policies.
-- Existing posts remain Public unless their owner changes their audience.
begin;

alter table public.forum_posts
  add column if not exists audience text not null default 'public';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.forum_posts'::regclass
      and conname = 'forum_posts_audience_check'
  ) then
    alter table public.forum_posts
      add constraint forum_posts_audience_check
      check (audience in ('public','friends','private'));
  end if;
end $$;

create index if not exists forum_posts_audience_created_idx
  on public.forum_posts (audience, created_at desc);

-- SECURITY DEFINER lets the friendship check work consistently under RLS.
create or replace function public.can_view_forum_post(
  p_owner uuid,
  p_audience text
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    coalesce(public.is_forum_admin(), false)
    or p_owner = auth.uid()
    or p_audience = 'public'
    or (
      p_audience = 'friends'
      and exists (
        select 1
        from public.friend_requests fr
        where fr.status = 'accepted'
          and (
            (fr.sender_id = auth.uid() and fr.receiver_id = p_owner)
            or
            (fr.receiver_id = auth.uid() and fr.sender_id = p_owner)
          )
      )
    );
$$;

revoke all on function public.can_view_forum_post(uuid, text) from public;
grant execute on function public.can_view_forum_post(uuid, text) to anon, authenticated;

-- A RESTRICTIVE policy is intentional: it ANDs with the existing
-- "Anyone can read forum posts" policy, so that policy can no longer expose
-- Friends-only or Only-me posts to everyone.
drop policy if exists "Enforce forum post audience privacy" on public.forum_posts;
create policy "Enforce forum post audience privacy"
  on public.forum_posts
  as restrictive
  for select
  to public
  using (public.can_view_forum_post(user_id, audience));

commit;

-- Verification: expected values are public, friends, private.
select audience, count(*) as posts_count
from public.forum_posts
group by audience
order by audience;
