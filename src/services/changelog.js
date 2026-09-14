function buildChangelogHeaders({ accessToken = "" } = {}) {
  const headers = {
    "Content-Type": "application/json",
  };
  const token = String(accessToken || "").trim();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export async function requestChangelogApi(method, payload = null, options = {}) {
  const query = options.query ? `?${new URLSearchParams(options.query).toString()}` : "";
  const response = await fetch(`/api/changelog${query}`, {
    method,
    headers: buildChangelogHeaders(options),
    body: payload ? JSON.stringify(payload) : undefined,
  });
  let data = null;
  try {
    data = await response.json();
  } catch (_) {
    data = null;
  }
  if (!response.ok) {
    throw new Error(data?.error || "Changelog request failed.");
  }
  return data || {};
}
