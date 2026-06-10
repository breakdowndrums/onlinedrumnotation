import { SHARE_LINK_PURPOSE } from "./shareLinks";

export async function fetchPublicArrangementRows({ supabase, limit = 300 } = {}) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("share_links")
    .select("id,purpose,payload,created_at")
    .eq("kind", "arrangement")
    .order("created_at", { ascending: false })
    .limit(Math.max(1, Number(limit) || 300));
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function fetchPublicBeatRows({ supabase, limit = 500 } = {}) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("share_links")
    .select("id,purpose,payload,created_at")
    .eq("kind", "beat")
    .order("created_at", { ascending: false })
    .limit(Math.max(1, Number(limit) || 500));
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function fetchFallbackPublicBeats({ sort, category, timeSig, style } = {}) {
  const params = new URLSearchParams();
  params.set("sort", sort === "oldest" ? "oldest" : "latest");
  if (category && category !== "all") params.set("category", category);
  if (timeSig && timeSig !== "all") params.set("timeSig", timeSig);
  if (style && style !== "all") params.set("style", style);
  const response = await fetch(`/api/beats?${params.toString()}`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || "Failed to load public library");
  }
  return Array.isArray(data?.beats) ? data.beats : [];
}

export async function publishPublicBeatRow({
  supabase,
  ownerUserId,
  id,
  name,
  composer = "",
  category = "Groove",
  style = "",
  beatPayload,
}) {
  if (!supabase || !ownerUserId) return null;
  const { data, error } = await supabase
    .from("share_links")
    .insert({
      id,
      kind: "beat",
      purpose: SHARE_LINK_PURPOSE.PUBLIC_BEAT,
      owner_user_id: ownerUserId,
      payload: {
        kind: "beat-default",
        publishedDefault: true,
        name,
        composer,
        category,
        style,
        createdAt: new Date().toISOString(),
        beatPayload,
      },
    })
    .select("id,purpose,payload,created_at")
    .single();
  if (error) throw error;
  return data || null;
}

export async function publishFallbackPublicBeat({
  name,
  composer,
  category,
  style,
  timeSigCategory,
  bpm,
  payload,
}) {
  const response = await fetch("/api/beats", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name,
      title: name,
      composer: composer || undefined,
      category,
      style: style || undefined,
      timeSigCategory,
      bpm,
      payload,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || "Failed to submit beat");
  }
  return data?.beat || null;
}

export async function deleteOwnedPublicShareRow({ supabase, ownerUserId, id }) {
  const normalizedId = String(id || "").trim();
  if (!supabase || !ownerUserId || !normalizedId) return false;
  const { error } = await supabase
    .from("share_links")
    .delete()
    .eq("id", normalizedId)
    .eq("owner_user_id", ownerUserId);
  if (error) throw error;
  return true;
}

export async function publishPublicArrangementRow({
  supabase,
  ownerUserId,
  id,
  payload,
  updateExisting = false,
}) {
  if (!supabase || !ownerUserId || !id) return null;
  const query = updateExisting
    ? supabase
        .from("share_links")
        .update({
          payload,
          purpose: SHARE_LINK_PURPOSE.PUBLIC_ARRANGEMENT,
          owner_user_id: ownerUserId,
        })
        .eq("id", id)
        .select("id,purpose,payload,created_at")
        .single()
    : supabase
        .from("share_links")
        .insert({
          id,
          kind: "arrangement",
          purpose: SHARE_LINK_PURPOSE.PUBLIC_ARRANGEMENT,
          owner_user_id: ownerUserId,
          payload,
        })
        .select("id,purpose,payload,created_at")
        .single();
  const { data, error } = await query;
  if (error) throw error;
  return data || null;
}

