function buildChangelogHeaders({ accessToken = "" } = {}) {
  const headers = {
    "Content-Type": "application/json",
  };
  const token = String(accessToken || "").trim();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

let publicChangelogPreloadPromise = null;

async function fetchChangelogApi(method, payload = null, options = {}) {
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

export function preloadPublicChangelogApi() {
  if (typeof window === "undefined") return null;
  if (!publicChangelogPreloadPromise) {
    publicChangelogPreloadPromise = fetchChangelogApi("GET").catch((error) => {
      publicChangelogPreloadPromise = null;
      throw error;
    });
  }
  return publicChangelogPreloadPromise;
}

export async function requestChangelogApi(method, payload = null, options = {}) {
  const normalizedMethod = String(method || "GET").toUpperCase();
  const hasAccessToken = Boolean(String(options?.accessToken || "").trim());
  const hasQuery = Boolean(options?.query);
  if (normalizedMethod === "GET" && !payload && !hasAccessToken && !hasQuery) {
    return preloadPublicChangelogApi() || fetchChangelogApi(normalizedMethod, payload, options);
  }
  return fetchChangelogApi(normalizedMethod, payload, options);
}

preloadPublicChangelogApi()?.catch(() => {});
