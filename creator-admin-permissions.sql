-- USMAN YOBE Creator Admin Permissions
-- Run in Supabase SQL Editor after creator-monetization-setup.sql.
-- Uses the existing public.is_admin() security check.

drop policy if exists "Admins manage creator applications" on public.creator_applications;
create policy "Admins manage creator applications"
  on public.creator_applications for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins manage creator earnings" on public.creator_earnings;
create policy "Admins manage creator earnings"
  on public.creator_earnings for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Ordinary creators retain SELECT-only access to their own earnings.
-- Never grant members direct write access to earnings.
