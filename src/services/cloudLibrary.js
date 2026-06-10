import { SHARE_LINK_PURPOSE } from "./shareLinks";

export async function fetchCloudBeatRows({ supabase, userId }) {
  if (!supabase || !userId) return [];
  const { data, error } = await supabase
    .from("beats")
    .select("id,name,payload,created_at,updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function fetchCloudArrangementRows({ supabase, userId }) {
  if (!supabase || !userId) return [];
  const { data, error } = await supabase
    .from("arrangements")
    .select("id,name,title_line_1,title_line_2,author,rows,created_at,updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function fetchCloudLibraryStatePayload({ supabase, userId, stateId, shareKind }) {
  if (!supabase || !userId || !stateId) return null;
  const { data, error } = await supabase
    .from("share_links")
    .select("payload")
    .eq("id", stateId)
    .eq("kind", shareKind)
    .eq("owner_user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data?.payload && typeof data.payload === "object" ? data.payload : null;
}

export async function saveCloudLibraryStatePayload({
  supabase,
  userId,
  stateId,
  shareKind,
  payloadKind,
  beatLibraryContainers,
}) {
  if (!supabase || !userId || !stateId) return false;
  const { error } = await supabase.from("share_links").upsert(
    {
      id: stateId,
      kind: shareKind,
      purpose: SHARE_LINK_PURPOSE.PERSONAL_LIBRARY_STATE,
      owner_user_id: userId,
      payload: {
        kind: payloadKind,
        beatLibraryContainers,
        updatedAt: new Date().toISOString(),
      },
    },
    { onConflict: "id" }
  );
  if (error) throw error;
  return true;
}

export async function countCloudLibraryRows({ supabase, userId }) {
  if (!supabase || !userId) return null;
  const [{ count: beatsCount, error: beatsError }, { count: arrangementsCount, error: arrangementsError }] =
    await Promise.all([
      supabase
        .from("beats")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
      supabase
        .from("arrangements")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
    ]);
  if (beatsError || arrangementsError) throw beatsError || arrangementsError;
  return {
    beats: Math.max(0, Number(beatsCount) || 0),
    arrangements: Math.max(0, Number(arrangementsCount) || 0),
  };
}

export async function insertCloudBeatRow({ supabase, row }) {
  if (!supabase || !row) return false;
  const { error } = await supabase.from("beats").insert(row);
  if (error) throw error;
  return true;
}

export async function createCloudBeatRow({ supabase, row }) {
  if (!supabase || !row) return null;
  const { data, error } = await supabase
    .from("beats")
    .insert(row)
    .select("id,name,payload,created_at,updated_at")
    .single();
  if (error) throw error;
  return data || null;
}

export async function updateCloudBeatRow({ supabase, userId, beatId, patch, select = false }) {
  if (!supabase || !userId || !beatId || !patch) return null;
  const query = supabase
    .from("beats")
    .update(patch)
    .eq("id", beatId)
    .eq("user_id", userId);
  const { data, error } = select
    ? await query.select("id,name,payload,created_at,updated_at").single()
    : await query;
  if (error) throw error;
  return data || null;
}

export async function updateCloudBeatRows({ supabase, userId, updates }) {
  if (!supabase || !userId || !Array.isArray(updates) || !updates.length) return true;
  const results = await Promise.all(
    updates
      .filter((entry) => entry?.beatId && entry?.patch)
      .map((entry) =>
        supabase
          .from("beats")
          .update(entry.patch)
          .eq("id", String(entry.beatId))
          .eq("user_id", userId)
      )
  );
  const failed = results.find((result) => result.error);
  if (failed?.error) throw failed.error;
  return true;
}

export async function deleteCloudBeatRow({ supabase, userId, beatId }) {
  if (!supabase || !userId || !beatId) return true;
  const { error } = await supabase
    .from("beats")
    .delete()
    .eq("id", beatId)
    .eq("user_id", userId);
  if (error) throw error;
  return true;
}

export async function deleteCloudBeatRows({ supabase, userId, beatIds }) {
  if (!supabase || !userId || !Array.isArray(beatIds) || !beatIds.length) return true;
  const results = await Promise.all(
    beatIds.map((beatId) =>
      supabase
        .from("beats")
        .delete()
        .eq("id", String(beatId))
        .eq("user_id", userId)
    )
  );
  const failed = results.find((result) => result.error);
  if (failed?.error) throw failed.error;
  return true;
}

export async function insertCloudArrangementRow({ supabase, row }) {
  if (!supabase || !row) return null;
  const { data, error } = await supabase
    .from("arrangements")
    .insert(row)
    .select("id,name,title_line_1,title_line_2,author,rows,created_at,updated_at")
    .single();
  if (error) throw error;
  return data || null;
}

export async function updateCloudArrangementRow({ supabase, userId, arrangementId, patch, select = false }) {
  if (!supabase || !userId || !arrangementId || !patch) return null;
  const query = supabase
    .from("arrangements")
    .update(patch)
    .eq("id", arrangementId)
    .eq("user_id", userId);
  const { data, error } = select
    ? await query.select("id,name,title_line_1,title_line_2,author,rows,created_at,updated_at").single()
    : await query;
  if (error) throw error;
  return data || null;
}

export async function updateCloudArrangementRows({ supabase, userId, updates }) {
  if (!supabase || !userId || !Array.isArray(updates) || !updates.length) return true;
  const results = await Promise.all(
    updates
      .filter((entry) => entry?.arrangementId && entry?.patch)
      .map((entry) =>
        supabase
          .from("arrangements")
          .update(entry.patch)
          .eq("id", String(entry.arrangementId))
          .eq("user_id", userId)
      )
  );
  const failed = results.find((result) => result.error);
  if (failed?.error) throw failed.error;
  return true;
}

export async function deleteCloudArrangementRow({ supabase, userId, arrangementId }) {
  if (!supabase || !userId || !arrangementId) return true;
  const { error } = await supabase
    .from("arrangements")
    .delete()
    .eq("id", arrangementId)
    .eq("user_id", userId);
  if (error) throw error;
  return true;
}

export async function deleteCloudArrangementRows({ supabase, userId, arrangementIds }) {
  if (!supabase || !userId || !Array.isArray(arrangementIds) || !arrangementIds.length) return true;
  const results = await Promise.all(
    arrangementIds.map((arrangementId) =>
      supabase
        .from("arrangements")
        .delete()
        .eq("id", String(arrangementId))
        .eq("user_id", userId)
    )
  );
  const failed = results.find((result) => result.error);
  if (failed?.error) throw failed.error;
  return true;
}
