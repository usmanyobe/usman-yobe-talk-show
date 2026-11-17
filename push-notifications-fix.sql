-- Repair Web Push subscription RLS for authenticated members.
-- The app uses UPSERT on endpoint. If an old anonymous row exists (user_id IS NULL),
-- allow the signed-in owner of that browser subscription to claim it safely.

ALTER TABLE public.push_subscriptions
  ALTER COLUMN auth DROP NOT NULL;

DROP POLICY IF EXISTS "Allow public subscription registration" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Allow public subscription removal" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Allow public subscription updates" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can insert own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can read own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Members add own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Members read own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Members update own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Members delete own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Members insert own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Members claim unowned push subscriptions" ON public.push_subscriptions;

CREATE POLICY "Members insert own push subscriptions"
ON public.push_subscriptions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Members read own push subscriptions"
ON public.push_subscriptions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- UPSERT may encounter a legacy row created before user_id was added.
-- It may be claimed only while unowned, or updated by its current owner.
CREATE POLICY "Members claim unowned push subscriptions"
ON public.push_subscriptions
FOR UPDATE
TO authenticated
USING (user_id IS NULL OR auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Members delete own push subscriptions"
ON public.push_subscriptions
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.push_subscriptions
TO authenticated;
