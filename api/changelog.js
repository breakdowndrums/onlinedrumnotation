import { getRequestUser, hasSupabaseAdmin, supabaseAdmin } from "./_supabaseAdmin.js";

const MAX_CHANGELOG_TITLE_LENGTH = 120;
const MAX_CHANGELOG_BODY_LENGTH = 2000;

async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch (_) {
      return null;
    }
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  if (!chunks.length) return null;
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch (_) {
    return null;
  }
}

async function listChangelog(req, res) {
  const { isAdmin } = await getRequestUser(req);
  let query = supabaseAdmin
    .from("changelog_entries")
    .select("id,created_at,updated_at,published_at,title,body,status")
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(50);

  if (!isAdmin) {
    query = query.eq("status", "published").not("published_at", "is", null);
  }

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message || "Failed to load changelog." });
  return res.status(200).json({ items: Array.isArray(data) ? data : [], isAdmin });
}

async function createChangelogEntry(req, res, body) {
  const { user, isAdmin } = await getRequestUser(req);
  if (!isAdmin) return res.status(403).json({ error: "Admin required." });
  const title = String(body?.title || "").trim();
  const text = String(body?.body || "").trim();
  if (title.length < 2) return res.status(400).json({ error: "Title is too short." });
  if (title.length > MAX_CHANGELOG_TITLE_LENGTH) return res.status(400).json({ error: "Title is too long." });
  if (text.length < 3) return res.status(400).json({ error: "Update text is too short." });
  if (text.length > MAX_CHANGELOG_BODY_LENGTH) return res.status(400).json({ error: "Update text is too long." });

  const now = new Date().toISOString();
  const { error } = await supabaseAdmin.from("changelog_entries").insert({
    user_id: user?.id || null,
    title,
    body: text,
    status: "published",
    published_at: now,
  });
  if (error) return res.status(500).json({ error: error.message || "Failed to post changelog." });
  return res.status(200).json({ ok: true });
}

async function deleteChangelogEntry(req, res, body) {
  const { isAdmin } = await getRequestUser(req);
  if (!isAdmin) return res.status(403).json({ error: "Admin required." });
  const changelogId = String(body?.changelogId || "").trim();
  if (!changelogId) return res.status(400).json({ error: "Missing changelog id." });
  const { error } = await supabaseAdmin.from("changelog_entries").delete().eq("id", changelogId);
  if (error) return res.status(500).json({ error: error.message || "Failed to delete changelog." });
  return res.status(200).json({ ok: true });
}

export default async function handler(req, res) {
  if (!hasSupabaseAdmin || !supabaseAdmin) {
    return res.status(503).json({ error: "Changelog backend not configured." });
  }
  if (req.method === "GET") return listChangelog(req, res);
  if (req.method === "POST") {
    const body = await readJsonBody(req);
    const action = String(body?.action || "").trim().toLowerCase();
    if (action === "create") return createChangelogEntry(req, res, body);
    if (action === "delete") return deleteChangelogEntry(req, res, body);
    return res.status(400).json({ error: "Unknown changelog action." });
  }
  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}
