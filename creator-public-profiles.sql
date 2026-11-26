-- USMAN YOBE TALK SHOW: Public approved Creator profiles
-- Approved Creator details are public; pending/rejected/suspended applications remain private.
grant usage on schema public to anon, authenticated;
grant select on public.creator_applications to anon, authenticated;
alter table public.creator_applications enable row level security;
drop policy if exists "Anyone can view approved creator profiles" on public.creator_applications;
create policy "Anyone can view approved creator profiles"
on public.creator_applications
for select
to anon, authenticated
using (status = 'approved');
