-- USMAN YOBE TALK SHOW: audit current forum_posts privacy setup
-- READ-ONLY: this script does not change any table, policy, or data.
select
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'forum_posts'
order by ordinal_position;

select
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'forum_posts'
order by policyname;
