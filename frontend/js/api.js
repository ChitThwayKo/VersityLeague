/**
 * Versity League — API client (Bearer token auth).
 */

const DEFAULT_BASE = "http://127.0.0.1:8000/api";
const TOKEN_KEY = "versity.auth.token";

function normalizeBase(url) {
  const trimmed = (url || DEFAULT_BASE).replace(/\/+$/, "");
  return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
}

let authToken = typeof localStorage !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;

export function getAuthToken() {
  return authToken;
}

export function setAuthToken(token) {
  authToken = token;
  if (typeof localStorage !== "undefined") {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  }
}

export function createApiClient(baseUrl) {
  const base = normalizeBase(baseUrl);

  async function request(path, options = {}) {
    const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
    const headers = {
      Accept: "application/json",
      ...options.headers,
    };
    if (
      options.body &&
      !(options.body instanceof FormData) &&
      !headers["Content-Type"]
    ) {
      headers["Content-Type"] = "application/json";
    }
    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }
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
    register: (payload) =>
      request("/auth/register", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    login: (payload) =>
      request("/auth/login", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    logout: () =>
      request("/auth/logout", {
        method: "POST",
      }),
    me: () => request("/auth/me"),
    seasonsCurrent: () => request("/seasons/current"),
    adminSeasonsList: () => request("/admin/seasons"),
    adminSeasonStore: (payload) =>
      request("/admin/seasons", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    adminSeasonUpdate: (id, payload) =>
      request(`/admin/seasons/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      }),
    clubsList: () => request("/clubs"),
    clubDetail: (id) => request(`/clubs/${id}`),
    adminClubsList: () => request("/admin/clubs"),
    adminClubShow: (id) => request(`/admin/clubs/${id}`),
    adminClubStore: (formData) =>
      request("/admin/clubs", { method: "POST", body: formData }),
    adminClubUpdate: (id, formData) =>
      request(`/admin/clubs/${id}`, { method: "PUT", body: formData }),
    adminClubDelete: (id) =>
      request(`/admin/clubs/${id}`, { method: "DELETE" }),
    adminClubMemberStore: (clubId, formData) =>
      request(`/admin/clubs/${clubId}/members`, {
        method: "POST",
        body: formData,
      }),
    adminClubMemberUpdate: (clubId, memberId, formData) =>
      request(`/admin/clubs/${clubId}/members/${memberId}`, {
        method: "PUT",
        body: formData,
      }),
    adminClubMemberDelete: (clubId, memberId) =>
      request(`/admin/clubs/${clubId}/members/${memberId}`, {
        method: "DELETE",
      }),
    fixturesList: (params) => {
      const qs =
        params && Object.keys(params).length
          ? `?${new URLSearchParams(params).toString()}`
          : "";
      return request(`/fixtures${qs}`);
    },
    adminFixturesList: (params) => {
      const qs =
        params && Object.keys(params).length
          ? `?${new URLSearchParams(params).toString()}`
          : "";
      return request(`/admin/fixtures${qs}`);
    },
    adminFixtureShow: (id) => request(`/admin/fixtures/${id}`),
    adminFixtureStore: (payload) =>
      request("/admin/fixtures", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    adminFixtureUpdate: (id, payload) =>
      request(`/admin/fixtures/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      }),
    adminFixtureDelete: (id) =>
      request(`/admin/fixtures/${id}`, { method: "DELETE" }),
    standings: () => request("/standings"),
    adminFixtureResultUpsert: (fixtureId, payload) =>
      request(`/admin/fixtures/${fixtureId}/result`, {
        method: "PUT",
        body: JSON.stringify(payload),
      }),
    adminFixtureResultDelete: (fixtureId) =>
      request(`/admin/fixtures/${fixtureId}/result`, { method: "DELETE" }),
  };
}
