-- One-time backfill for excluding admin/self usage from existing stats.
--
-- Before running, replace the values in admin_config:
-- - admin_email: the same email used by ADMIN_EMAIL / VITE_ADMIN_EMAIL
-- - admin_visitor_ids: browser visitor IDs that should be excluded even when not signed in

with admin_config as (
  select
    lower('replace-with-admin-email@example.com') as admin_email,
    array[
      'replace-with-admin-visitor-id'
    ]::text[] as admin_visitor_ids
),
admin_users as (
  select u.id
  from auth.users u
  cross join admin_config c
  where lower(u.email) = c.admin_email
)
update public.app_events e
set exclude_from_stats = true
from admin_config c
where
  e.user_id in (select id from admin_users)
  or e.visitor_id = any(c.admin_visitor_ids);
