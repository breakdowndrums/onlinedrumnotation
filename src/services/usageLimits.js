import { getDrumGridVisitorId } from "../utils/visitorId";

export async function fetchUsageLimits({ accessToken = "" } = {}) {
  const headers = {
    "x-dg-visitor-id": getDrumGridVisitorId(),
  };
  const token = String(accessToken || "").trim();
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch("/api/usage-limits", { headers });
  let data = null;
  try {
    data = await response.json();
  } catch (_) {
    data = null;
  }
  if (!response.ok) {
    throw new Error(data?.error || "Failed to load usage limits.");
  }
  return data || {};
}
