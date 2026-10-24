import { createHash } from "node:crypto";

export function normalizeContactEmail(value) {
  const email = String(value || "").trim();
  if (!email) return "";
  if (email.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) {
    throw new Error("Please enter a valid email address, or leave it blank.");
  }
  return email;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);
}

export function buildFeedbackEmail({ name, question, answer }) {
  const greeting = name ? `Hi ${name},` : "Hi,";
  return {
    subject: "Arne replied to your feedback",
    text: `${greeting}\n\nArne's reply\n${answer}\n\nYour original message\n${question}\n\nOpen feedback section: https://onlinedrumnotation.com/#feedback\n\nSent because you left your email with your feedback. For follow-ups, please use the site's feedback form, not email replies.`,
    html: `<div style="font-family:Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px 16px;font-size:16px;line-height:1.6;color:#222;overflow-wrap:break-word">
      <p style="margin:0 0 24px">${escapeHtml(greeting)}</p>
      <h2 style="margin:0 0 8px;font-size:16px;font-weight:600">Arne's reply</h2>
      <div style="white-space:pre-wrap">${escapeHtml(answer)}</div>
      <div style="margin-top:28px;padding-left:16px;border-left:2px solid #d4d4d4;font-size:14px;color:#666">
        <h2 style="margin:0 0 8px;font-size:12px;font-weight:600">Your original message</h2>
        <div style="white-space:pre-wrap">${escapeHtml(question)}</div>
      </div>
      <p style="margin:28px 0"><a href="https://onlinedrumnotation.com/#feedback">Open feedback section</a></p>
      <p style="margin:0;padding-top:16px;border-top:1px solid #e5e5e5;font-size:12px;color:#777">Sent because you left your email with your feedback. For follow-ups, please use the site's feedback form, not email replies.</p>
    </div>`,
  };
}

export async function emailFeedbackReply(database, item, email) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.FEEDBACK_EMAIL_FROM;
  if (!apiKey || !from) {
    return { status: "failed", message: "Reply saved, but email is not configured. Set RESEND_API_KEY and FEEDBACK_EMAIL_FROM." };
  }
  const hash = createHash("sha256")
    .update(JSON.stringify([email, item.body, item.admin_reply]))
    .digest("hex");
  const { data: claim, error: claimError } = await database.rpc("claim_feedback_reply_email", {
    p_feedback_id: item.id, p_reply_hash: hash,
  });
  if (claimError) return { status: "failed", message: "Reply saved, but the email could not be queued. Check the feedback email migration." };
  if (claim === "sent") return { status: "sent", message: "This reply was already emailed." };
  if (claim === "expired") return { status: "failed", message: "Reply saved. The safe retry window has expired; check Resend's email log before contacting the sender manually." };
  if (claim !== "send") return { status: "pending", message: "Reply saved. This email is already being sent; refresh to check its status." };

  const message = buildFeedbackEmail({ name: item.author_label === "Anonymous" ? "" : item.author_label, question: item.body, answer: item.admin_reply });
  let providerId;
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `feedback/${item.id}/${hash}`,
      },
      body: JSON.stringify({ from, to: [email], ...message }),
      signal: AbortSignal.timeout(10000),
    });
    const data = await response.json();
    if (!response.ok || !data?.id) throw new Error("Email provider rejected the request.");
    providerId = data.id;
  } catch (_) {
    const { error } = await database.from("feedback_reply_emails")
      .update({ status: "failed", updated_at: new Date().toISOString() })
      .eq("feedback_id", item.id).eq("reply_hash", hash).eq("status", "pending");
    return { status: "failed", message: error
      ? "Reply saved, but email status is uncertain. Refresh before retrying."
      : "Reply saved, but the email could not be sent. Check Resend configuration, then retry." };
  }
  const { error } = await database.from("feedback_reply_emails")
    .update({ status: "sent", provider_id: providerId, updated_at: new Date().toISOString() })
    .eq("feedback_id", item.id).eq("reply_hash", hash);
  if (error) return { status: "pending", message: "Resend accepted the email, but its saved status could not be updated. Refresh before retrying." };
  return { status: "sent", message: "Reply saved and email sent." };
}
