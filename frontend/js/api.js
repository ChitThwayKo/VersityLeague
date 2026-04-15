/**
 * Versity League — API client (Day 1).
 * Day 2+: attach Authorization header / cookies per auth strategy.
 */

const DEFAULT_BASE = "http://127.0.0.1:8000/api";

function normalizeBase(url) {
  const trimmed = (url || DEFAULT_BASE).replace(/\/+$/, "");
  return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
}

export function createApiClient(baseUrl) {
  const base = normalizeBase(baseUrl);

  async function request(path, options = {}) {
    const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
    const headers = {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...options.headers,
    };
    const res = await fetch(url, { ...options, headers });
    const text = await res.text();
    let body;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status}`);
      err.status = res.status;
      err.body = body;
      throw err;
    }
    return body;
  }

  return {
    base,
    health: () => request("/health"),
    ping: () => request("/ping"),
    /** Placeholder for Day 2+ */
    setAuthToken(_token) {},
  };
}
