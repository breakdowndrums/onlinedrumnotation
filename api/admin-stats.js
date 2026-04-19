import { getRequestUser, hasSupabaseAdmin, supabaseAdmin } from "./_supabaseAdmin.js";

function readRange(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "day" || normalized === "week") return normalized;
  return "all";
}

function getSinceForRange(range) {
  if (range === "day") return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  if (range === "week") return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  return "";
}

async function countEvents({ eventType, shareKind = "", since = "", distinct = false }) {
  let query = supabaseAdmin
    .from("app_events")
    .select(distinct ? "visitor_id,user_id" : "id", { count: "exact", head: !distinct });
  query = query.eq("event_type", eventType);
  if (shareKind) query = query.eq("share_kind", shareKind);
  if (since) query = query.gte("created_at", since);
  const { data, count, error } = await query;
  if (error) throw error;
  if (!distinct) return Math.max(0, Number(count) || 0);
  const rows = Array.isArray(data) ? data : [];
  const ids = new Set(
    rows
      .map((row) => String(row?.user_id || row?.visitor_id || "").trim())
      .filter(Boolean)
  );
  return ids.size;
}

async function countAuthUsers(since = "") {
  let page = 1;
  const perPage = 1000;
  let total = 0;
  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error) throw error;
    const users = Array.isArray(data?.users) ? data.users : [];
    total += since
      ? users.filter((user) => {
          const createdAt = String(user?.created_at || "").trim();
          return createdAt && createdAt >= since;
        }).length
      : users.length;
    if (users.length < perPage) break;
    page += 1;
  }
  return total;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!hasSupabaseAdmin || !supabaseAdmin) {
    return res.status(503).json({ error: "Stats backend not configured." });
  }
  const { isAdmin } = await getRequestUser(req);
  if (!isAdmin) return res.status(403).json({ error: "Admin required." });

  try {
    const range = readRange(req.query.range);
    const since = getSinceForRange(range);
    const [
      users,
      signedUpUsers,
      siteVisits,
      beatShareCreates,
      arrangementShareCreates,
      beatShareOpens,
      arrangementShareOpens,
    ] = await Promise.all([
      countEvents({ eventType: "site_visit", since, distinct: true }),
      countAuthUsers(since),
      countEvents({ eventType: "site_visit", since }),
      countEvents({ eventType: "share_create", shareKind: "beat", since }),
      countEvents({ eventType: "share_create", shareKind: "arrangement", since }),
      countEvents({ eventType: "share_open", shareKind: "beat", since }),
      countEvents({ eventType: "share_open", shareKind: "arrangement", since }),
    ]);

    return res.status(200).json({
      range,
      stats: {
        users,
        signedUpUsers,
        siteVisits,
        beatShareCreates,
        arrangementShareCreates,
        beatShareOpens,
        arrangementShareOpens,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: error?.message || "Failed to load stats." });
  }
}
