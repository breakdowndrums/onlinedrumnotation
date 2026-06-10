-- Adds an explicit purpose discriminator to share_links.
--
-- This keeps the existing payload format intact while making row intent queryable:
-- - temporary_share: user-created short links / QR links
-- - public_beat: admin-published default beat entries
-- - public_arrangement: admin-published default arrangement entries
-- - personal_library_state: hidden per-user library folder/state sync row

alter table public.share_links
  add column if not exists purpose text null;

alter table public.share_links
  drop constraint if exists share_links_purpose_check;

alter table public.share_links
  add constraint share_links_purpose_check
  check (
    purpose is null or purpose in (
      'temporary_share',
      'public_beat',
      'public_arrangement',
      'personal_library_state'
    )
  );

update public.share_links
set purpose = case
  when payload->>'kind' = 'personal-library-state' then 'personal_library_state'
  when payload->>'publishedDefault' = 'true' and kind = 'beat' then 'public_beat'
  when payload->>'publishedDefault' = 'true' and kind = 'arrangement' then 'public_arrangement'
  when payload->'shareMeta'->>'temporary' = 'true' then 'temporary_share'
  else purpose
end
where purpose is null;

create index if not exists share_links_purpose_created_at_idx
  on public.share_links (purpose, created_at desc);

create index if not exists share_links_owner_purpose_created_at_idx
  on public.share_links (owner_user_id, purpose, created_at desc)
  where owner_user_id is not null;
