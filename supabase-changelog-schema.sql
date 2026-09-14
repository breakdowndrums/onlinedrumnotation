create extension if not exists pgcrypto;

create table if not exists public.changelog_entries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz null,
  user_id uuid null references auth.users(id) on delete set null,
  title text not null check (char_length(title) between 2 and 120),
  body text not null check (char_length(body) between 3 and 2000),
  status text not null default 'published' check (status in ('draft', 'published', 'archived'))
);

create index if not exists changelog_entries_public_idx
  on public.changelog_entries (status, published_at desc, created_at desc);

grant usage on schema public to anon, authenticated, service_role;
grant select on table public.changelog_entries to anon, authenticated;
grant all privileges on table public.changelog_entries to service_role;

create or replace function public.set_changelog_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists changelog_entries_set_updated_at on public.changelog_entries;
create trigger changelog_entries_set_updated_at
before update on public.changelog_entries
for each row execute function public.set_changelog_updated_at();

alter table public.changelog_entries enable row level security;

drop policy if exists "changelog_entries_public_read" on public.changelog_entries;
create policy "changelog_entries_public_read"
on public.changelog_entries
for select
using (status = 'published' and published_at is not null);

drop policy if exists "changelog_entries_insert_any" on public.changelog_entries;
drop policy if exists "changelog_entries_update_any" on public.changelog_entries;
drop policy if exists "changelog_entries_delete_any" on public.changelog_entries;
drop policy if exists "changelog_entries_admin_all" on public.changelog_entries;

comment on table public.changelog_entries is
  'Public changelog entries are read by visitors and created by admin through the backend API.';

notify pgrst, 'reload schema';
