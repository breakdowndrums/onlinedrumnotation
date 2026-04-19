create table if not exists public.feedback_items (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid null references auth.users(id) on delete set null,
  author_kind text not null check (author_kind in ('registered', 'anonymous')),
  author_label text null,
  body text not null check (char_length(body) between 3 and 2000),
  status text not null default 'pending' check (status in ('pending', 'public', 'hidden', 'archived')),
  is_public boolean not null default false,
  vote_score integer not null default 0,
  vote_count integer not null default 0,
  fingerprint text null,
  admin_note text null
);

create index if not exists feedback_items_created_at_idx
  on public.feedback_items (created_at desc);

create index if not exists feedback_items_public_idx
  on public.feedback_items (is_public, status, created_at desc);

create table if not exists public.feedback_votes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  feedback_id uuid not null references public.feedback_items(id) on delete cascade,
  user_id uuid null references auth.users(id) on delete cascade,
  fingerprint text null,
  vote smallint not null check (vote in (-1, 1)),
  constraint feedback_votes_identity_check check (
    user_id is not null or fingerprint is not null
  )
);

create unique index if not exists feedback_votes_feedback_user_uidx
  on public.feedback_votes (feedback_id, user_id)
  where user_id is not null;

create unique index if not exists feedback_votes_feedback_fingerprint_uidx
  on public.feedback_votes (feedback_id, fingerprint)
  where fingerprint is not null;

alter table public.feedback_items enable row level security;
alter table public.feedback_votes enable row level security;

create policy "feedback_items_public_read"
on public.feedback_items
for select
using (is_public = true and status = 'public');

create policy "feedback_items_insert_any"
on public.feedback_items
for insert
with check (true);

create policy "feedback_votes_public_read"
on public.feedback_votes
for select
using (true);

create policy "feedback_votes_insert_any"
on public.feedback_votes
for insert
with check (true);

create policy "feedback_votes_update_any"
on public.feedback_votes
for update
using (true)
with check (true);

create policy "feedback_votes_delete_any"
on public.feedback_votes
for delete
using (true);

-- Admin moderation policies:
-- Replace 'admin@example.com' with your admin email or adapt to your own role model.
create policy "feedback_items_admin_all"
on public.feedback_items
for all
using (
  exists (
    select 1
    from auth.users
    where auth.users.id = auth.uid()
      and lower(auth.users.email) = lower('admin@example.com')
  )
)
with check (
  exists (
    select 1
    from auth.users
    where auth.users.id = auth.uid()
      and lower(auth.users.email) = lower('admin@example.com')
  )
);
