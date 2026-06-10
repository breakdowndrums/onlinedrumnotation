export async function createAnonymousShortShareLink(payload, { origin = window.location.origin } = {}) {
  const response = await fetch("/api/share", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ payload }),
  });
  if (!response.ok) return null;
  const data = await response.json().catch(() => null);
  const id = String(data?.id || "");
  if (!id) return null;
  return {
    text: `${origin}/g/${encodeURIComponent(id)}`,
    createdNewShare: data?.created !== false,
  };
}

export const SHARE_LINK_PURPOSE = {
  TEMPORARY_SHARE: "temporary_share",
  PUBLIC_BEAT: "public_beat",
  PUBLIC_ARRANGEMENT: "public_arrangement",
  PERSONAL_LIBRARY_STATE: "personal_library_state",
};

export async function createSupabaseShortShareLink({
  supabase,
  ownerUserId,
  mode = "beat",
  payload,
  origin = window.location.origin,
  ensureShortShareQuotaAvailable,
  buildSharePayloadFingerprint,
  getSharePayloadFingerprint,
  getShareLinkMeta,
  isTemporarySharePayload,
  isPublishedDefaultSharePayload,
  isPersonalLibraryStatePayload,
  withShareLinkMeta,
  makeShortShareId,
  buildTemporarySharePayload,
}) {
  if (!supabase || !ownerUserId) return null;
  const kind = mode === "arrangement" ? "arrangement" : "beat";
  const fingerprint = await buildSharePayloadFingerprint(mode, payload);
  const { data: existingRows, error: existingError } = await supabase
    .from("share_links")
    .select("id,purpose,payload")
    .eq("owner_user_id", ownerUserId)
    .eq("kind", kind)
    .limit(500);

  if (!existingError) {
    const matchedRow = (Array.isArray(existingRows) ? existingRows : []).find((row) => {
      const rowPayload = row?.payload;
      if (!isTemporarySharePayload(rowPayload)) return false;
      if (isPublishedDefaultSharePayload(rowPayload) || isPersonalLibraryStatePayload(rowPayload)) return false;
      const existingFingerprint = getSharePayloadFingerprint(rowPayload);
      return existingFingerprint && existingFingerprint === fingerprint;
    });
    if (matchedRow?.id) {
      return {
        text: `${origin}/g/${encodeURIComponent(String(matchedRow.id || ""))}`,
        createdNewShare: false,
      };
    }
  }

  if (!existingError && Array.isArray(existingRows)) {
    for (const row of existingRows) {
      const rowPayload = row?.payload;
      if (!isTemporarySharePayload(rowPayload)) continue;
      if (isPublishedDefaultSharePayload(rowPayload) || isPersonalLibraryStatePayload(rowPayload)) continue;
      const existingFingerprint =
        getSharePayloadFingerprint(rowPayload) ||
        await buildSharePayloadFingerprint(mode, rowPayload);
      if (existingFingerprint !== fingerprint) continue;
      if (!getSharePayloadFingerprint(rowPayload)) {
        void supabase
          .from("share_links")
          .update({
            payload: withShareLinkMeta(rowPayload, {
              ...(getShareLinkMeta(rowPayload) || {}),
              temporary: true,
              fingerprint,
            }),
          })
          .eq("id", String(row.id || ""));
      }
      return {
        text: `${origin}/g/${encodeURIComponent(String(row.id || ""))}`,
        createdNewShare: false,
      };
    }
  }

  await ensureShortShareQuotaAvailable();
  for (let i = 0; i < 6; i++) {
    const id = makeShortShareId();
    const { error } = await supabase.from("share_links").insert({
      id,
      kind,
      purpose: SHARE_LINK_PURPOSE.TEMPORARY_SHARE,
      owner_user_id: ownerUserId,
      payload: buildTemporarySharePayload(payload, fingerprint),
    });
    if (!error) {
      return {
        text: `${origin}/g/${encodeURIComponent(id)}`,
        createdNewShare: true,
      };
    }
  }
  return null;
}

export async function fetchOwnedShareLinkRows({ supabase, ownerUserId, excludeId = "" }) {
  if (!supabase || !ownerUserId) return [];
  let query = supabase
    .from("share_links")
    .select("id,kind,purpose,payload,created_at,updated_at")
    .eq("owner_user_id", ownerUserId);
  const normalizedExcludeId = String(excludeId || "").trim();
  if (normalizedExcludeId) query = query.neq("id", normalizedExcludeId);
  const { data, error } = await query;
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function fetchShareLinkRowById({ supabase, shareId }) {
  const normalizedShareId = String(shareId || "").trim();
  if (!supabase || !normalizedShareId) return null;
  const { data, error } = await supabase
    .from("share_links")
    .select("id,purpose,payload")
    .eq("id", normalizedShareId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function deleteOwnedShareLink({ supabase, ownerUserId, shareId }) {
  const normalizedShareId = String(shareId || "").trim();
  if (!supabase || !ownerUserId || !normalizedShareId) return false;
  const { error } = await supabase
    .from("share_links")
    .delete()
    .eq("id", normalizedShareId)
    .eq("owner_user_id", ownerUserId);
  if (error) throw error;
  return true;
}

export async function touchTemporaryShareLinkAccess({
  supabase,
  shareId,
  payload,
  isTemporarySharePayload,
  buildTouchedSharePayload,
}) {
  const normalizedShareId = String(shareId || "").trim();
  if (!supabase || !normalizedShareId) return false;
  if (!isTemporarySharePayload(payload)) return false;
  const nextPayload = buildTouchedSharePayload(payload);
  if (nextPayload === payload) return false;
  const { error } = await supabase
    .from("share_links")
    .update({ payload: nextPayload })
    .eq("id", normalizedShareId);
  if (error) throw error;
  return true;
}

export async function deleteOwnedShareLinksByIds({ supabase, ownerUserId, shareIds = [] }) {
  if (!supabase || !ownerUserId) return 0;
  const ids = Array.from(new Set(
    (Array.isArray(shareIds) ? shareIds : [])
      .map((id) => String(id || "").trim())
      .filter(Boolean)
  ));
  if (!ids.length) return 0;
  const { error } = await supabase
    .from("share_links")
    .delete()
    .eq("owner_user_id", ownerUserId)
    .in("id", ids);
  if (error) throw error;
  return ids.length;
}
