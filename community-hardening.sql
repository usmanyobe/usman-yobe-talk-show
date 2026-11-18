-- USMAN YOBE COMMUNITY HARDENING — run after community-advanced-setup.sql
-- Makes "Friends" event visibility use accepted friend_requests and protects RSVP lists.
drop policy if exists "Events visible to members" on public.social_events;
create policy "Events visible to members" on public.social_events
for select to authenticated
using (
 visibility='public'
 or host_id=auth.uid()
 or (
   visibility='friends'
   and exists (
     select 1 from public.friend_requests fr
     where fr.status='accepted'
       and ((fr.sender_id=host_id and fr.receiver_id=auth.uid())
         or (fr.receiver_id=host_id and fr.sender_id=auth.uid()))
   )
 )
);
drop policy if exists "Event RSVP visible to members" on public.social_event_rsvps;
create policy "Event RSVP visible to members" on public.social_event_rsvps
for select to authenticated
using (
 user_id=auth.uid()
 or exists (
   select 1 from public.social_events e
   where e.id=event_id
     and (
       e.host_id=auth.uid()
       or e.visibility='public'
       or (e.visibility='friends' and exists (
         select 1 from public.friend_requests fr
         where fr.status='accepted'
           and ((fr.sender_id=e.host_id and fr.receiver_id=auth.uid())
             or (fr.receiver_id=e.host_id and fr.sender_id=auth.uid()))
       ))
     )
 )
);

-- Only the existing forum-admin check can read or moderate reports.
drop policy if exists "Forum admins read community reports" on public.community_content_reports;
create policy "Forum admins read community reports" on public.community_content_reports
for select to authenticated using (public.is_forum_admin());
drop policy if exists "Forum admins update community reports" on public.community_content_reports;
create policy "Forum admins update community reports" on public.community_content_reports
for update to authenticated using (public.is_forum_admin()) with check (public.is_forum_admin());
grant update on public.community_content_reports to authenticated;
