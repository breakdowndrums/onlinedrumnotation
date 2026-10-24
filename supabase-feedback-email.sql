-- Run in the Supabase SQL editor before deploying the feedback email feature.
-- Contact details are never placed on the publicly readable feedback_items table.
create table if not exists public.feedback_contacts (
  feedback_id uuid primary key references public.feedback_items(id) on delete cascade,
  email text not null check (char_length(email) between 3 and 254)
);

create table if not exists public.feedback_reply_emails (
  feedback_id uuid not null references public.feedback_items(id) on delete cascade,
  reply_hash text not null,
  status text not null check (status in ('pending', 'sent', 'failed')),
  provider_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (feedback_id, reply_hash)
);

alter table public.feedback_contacts enable row level security;
alter table public.feedback_reply_emails enable row level security;
revoke all on public.feedback_contacts, public.feedback_reply_emails from public, anon, authenticated;
grant all on public.feedback_contacts, public.feedback_reply_emails to service_role;

create or replace function public.submit_feedback_with_contact(p_item jsonb, p_email text)
returns uuid
language plpgsql
set search_path = public
as $$
declare new_id uuid;
begin
  insert into public.feedback_items (
    user_id, author_kind, author_label, body, fingerprint, feedback_type, feedback_types
  ) values (
    (p_item->>'user_id')::uuid, p_item->>'author_kind', p_item->>'author_label',
    p_item->>'body', p_item->>'fingerprint', p_item->>'feedback_type',
    array(select jsonb_array_elements_text(p_item->'feedback_types'))
  ) returning id into new_id;
  if p_email is not null and p_email <> '' then
    insert into public.feedback_contacts(feedback_id, email) values (new_id, p_email);
  end if;
  return new_id;
end;
$$;

create or replace function public.claim_feedback_reply_email(p_feedback_id uuid, p_reply_hash text)
returns text
language plpgsql
set search_path = public
as $$
declare claimed boolean; existing_status text;
begin
  insert into public.feedback_reply_emails(feedback_id, reply_hash, status)
    values (p_feedback_id, p_reply_hash, 'pending')
    on conflict do nothing;
  claimed := found;
  if claimed then return 'send'; end if;
  -- Atomic claim prevents parallel retries; Resend's idempotency key covers timeouts.
  update public.feedback_reply_emails set status = 'pending', updated_at = now()
    where feedback_id = p_feedback_id and reply_hash = p_reply_hash
    and (status = 'failed' or (status = 'pending' and updated_at < now() - interval '5 minutes'))
    and created_at > now() - interval '23 hours';
  if found then return 'send'; end if;
  select case when status <> 'sent' and created_at <= now() - interval '23 hours'
    then 'expired' else status end into existing_status from public.feedback_reply_emails
    where feedback_id = p_feedback_id and reply_hash = p_reply_hash;
  return existing_status;
end;
$$;

revoke all on function public.submit_feedback_with_contact(jsonb, text) from public, anon, authenticated;
revoke all on function public.claim_feedback_reply_email(uuid, text) from public, anon, authenticated;
grant execute on function public.submit_feedback_with_contact(jsonb, text) to service_role;
grant execute on function public.claim_feedback_reply_email(uuid, text) to service_role;
notify pgrst, 'reload schema';
