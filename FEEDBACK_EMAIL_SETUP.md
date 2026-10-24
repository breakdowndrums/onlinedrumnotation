# Feedback email setup

## Deploy

1. Run `supabase-feedback-email.sql` in the same Supabase project's SQL editor.
2. Set these server-only environment variables in Vercel:
   - `RESEND_API_KEY`: your existing Resend API key with sending access.
   - `FEEDBACK_EMAIL_FROM`: a sender on your verified domain, e.g. `Arne <notifications@your-domain.com>`.
3. Redeploy after setting environment variables. No new npm package is needed.

Never prefix these settings with `VITE_` or commit their values. Existing Supabase
service-role and admin authentication settings are still required. Visitors do not
need to log in; moderation and sending remain admin-only.

## Behavior

- Optional name/email fields are hidden under a disclosure below the message.
- Names may appear on published feedback; email addresses never do.
- Contacts and email status live in separate RLS-protected tables with access
  revoked from anonymous and signed-in clients. Only the backend service role can access them.
- `Save & email reply` saves your reply and sends the original message plus the
  full answer. Visibility/status edits do not send emails.
- The admin sees sending status and explicit failure messages. `sent` means Resend
  accepted the message, not proof of inbox delivery; check Resend logs for bounces.
- Identical replies to the same recipient are not resent. Parallel sends are
  claimed atomically and retries reuse a Resend idempotency key. Uncertain/failed
  attempts older than 23 hours require manual checking to avoid duplicates after
  Resend's 24-hour idempotency window.
- If sending fails, the reply stays saved. Fix the configuration and click the
  button again. Refresh after a pending send; abandoned attempts can retry after
  five minutes. Email edits/configuration are never taken from a visitor request.
- Deleting feedback also deletes its stored contact and notification records.
- Email is notification-only: follow-ups go through the site's feedback form.

## Verify

Run `node --experimental-vm-modules --test tests/feedback-email.test.mjs`.
After deploying, submit private feedback with an address you control, then reply
as admin. Verify the name, question and answer in the received email. Click save
again with the unchanged reply and confirm only one email exists in Resend.
Check that the public `/api/feedback` response contains no contact details.

Resend API reference: https://resend.com/docs/api-reference/emails/send-email
Idempotency reference: https://resend.com/docs/dashboard/emails/idempotency-keys
