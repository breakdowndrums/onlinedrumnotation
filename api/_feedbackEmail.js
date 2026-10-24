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
    subject: "Arne replied to your Drum Grid feedback",
    text: `${greeting}\n\nYour message\n${question}\n\nArne's reply\n${answer}\n\nOpen Drum Grid: https://onlinedrumnotation.com/\n\nYou received this email because you left your address with your feedback. This is a notification; please send any follow-up through the site's feedback form.`,
    html: `<div style="font-family:Helvetica,Arial,sans-serif;max-width:600px;line-height:1.6;color:#222">
      <p>${escapeHtml(greeting)}</p>
      <h2 style="font-size:16px">Your message</h2>
      <div style="white-space:pre-wrap">${escapeHtml(question)}</div>
      <h2 style="font-size:16px">Arne's reply</h2>
      <div style="white-space:pre-wrap">${escapeHtml(answer)}</div>
      <p><a href="https://onlinedrumnotation.com/">Open Drum Grid</a></p>
      <p style="font-size:12px;color:#666">You received this email because you left your address with your feedback.</p>
      <p style="font-size:12px;color:#666">This is a notification; please send any follow-up through the site's feedback form.</p>
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
