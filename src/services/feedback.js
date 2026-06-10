function buildFeedbackHeaders({ anonymousFingerprint = "", accessToken = "" } = {}) {
  const headers = {
    "Content-Type": "application/json",
  };
  const fingerprint = String(anonymousFingerprint || "").trim();
  const token = String(accessToken || "").trim();
  if (fingerprint) headers["x-feedback-fingerprint"] = fingerprint;
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export async function requestFeedbackApi(method, payload = null, options = {}) {
  const query = options.query ? `?${new URLSearchParams(options.query).toString()}` : "";
  const response = await fetch(`/api/feedback${query}`, {
    method,
    headers: buildFeedbackHeaders(options),
    body: payload ? JSON.stringify(payload) : undefined,
  });
  let data = null;
  try {
    data = await response.json();
  } catch (_) {
    data = null;
  }
  if (!response.ok) {
    throw new Error(data?.error || "Feedback request failed.");
  }
  return data || {};
}

