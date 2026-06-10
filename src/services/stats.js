export async function fetchAdminStats({ range = "day", accessToken = "" } = {}) {
  const headers = {};
  const token = String(accessToken || "").trim();
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(
    `/api/admin-stats?${new URLSearchParams({ range }).toString()}`,
    { headers }
  );
  let data = null;
  try {
    data = await response.json();
  } catch (_) {
    data = null;
  }
  if (!response.ok) {
    throw new Error(data?.error || "Failed to load stats.");
  }
  return data || {};
}

