import { API_BASE_URL } from "./config.js";

/**
 * Rewrites Laravel `public` disk URLs so assets load from the same host/path as `API_BASE_URL`.
 * Laravel builds `Storage::url()` using `APP_URL` + `/storage`, which is often `http://127.0.0.1:8000/...`
 * while the browser uses XAMPP on `:8080` — the browser then gets `ERR_CONNECTION_REFUSED`.
 * Only rewrites URLs whose host is `localhost` / `127.0.0.1` or port `8000`, so production CDN URLs stay untouched.
 *
 * @param {unknown} rawUrl
 * @returns {string}
 */
export function resolveBackendPublicFileUrl(rawUrl) {
  if (typeof rawUrl !== "string") return "";
  const input = rawUrl.trim();
  if (!input) return "";

  try {
    const api = new URL(API_BASE_URL);
    const publicRoot = `${api.origin}${api.pathname.replace(/\/$/, "")}`;

    const underPublic = (/** @type {string} */ path) => {
      const p = path.startsWith("/") ? path : `/${path}`;
      return `${publicRoot}${p}`;
    };

    if (input.startsWith("//")) {
      return resolveBackendPublicFileUrl(`${api.protocol}${input}`);
    }

    if (/^https?:\/\//i.test(input)) {
      const u = new URL(input);
      const p = u.pathname.replace(/\\/g, "/");
      const localLike =
        u.hostname === "localhost" || u.hostname === "127.0.0.1" || u.port === "8000";

      const storageIdx = p.indexOf("/storage/");
      if (storageIdx !== -1) {
        const candidate = underPublic(p.slice(storageIdx));
        if (candidate !== input) {
          if (!localLike) return input;
          return candidate;
        }
      }

      const apiIdx = p.indexOf("/api/");
      if (apiIdx !== -1 && localLike) {
        const candidate = `${publicRoot}${p.slice(apiIdx)}${u.search || ""}`;
        if (candidate !== input) return candidate;
      }

      return input;
    }

    if (input.startsWith("/storage/") || input === "/storage") {
      return underPublic(input === "/storage" ? "/storage/" : input);
    }

    // Path-only "/api/v1/..." resolves against /frontend/admin/ and misses .../backend/public → 404.
    if (input.startsWith("/api/")) {
      return `${publicRoot}${input}`;
    }

    return input;
  } catch {
    return typeof rawUrl === "string" ? rawUrl : "";
  }
}

const TOKEN_KEY = "versity_auth_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function jsonHeaders(includeAuth) {
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (includeAuth) {
    const t = getToken();
    if (t) headers.Authorization = `Bearer ${t}`;
  }
  return headers;
}

/**
 * @returns {Promise<{ ok: boolean, status: number, data: Record<string, unknown> }>}
 */
export async function apiPostJson(path, body, { auth = false } = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: jsonHeaders(auth),
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

/**
 * @returns {Promise<{ ok: boolean, status: number, data: Record<string, unknown> }>}
 */
export async function apiGet(path, { auth = false } = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "GET",
    headers: jsonHeaders(auth),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

/**
 * @returns {Promise<{ ok: boolean, status: number, data: Record<string, unknown> }>}
 */
export async function apiPatchJson(path, body, { auth = false } = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "PATCH",
    headers: jsonHeaders(auth),
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

/**
 * @returns {Promise<{ ok: boolean, status: number, data: Record<string, unknown> }>}
 */
export async function apiDelete(path, { auth = false } = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "DELETE",
    headers: jsonHeaders(auth),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

/**
 * @returns {Promise<{ ok: boolean, status: number, data: Record<string, unknown> }>}
 */
export async function apiPostForm(path, formData) {
  const headers = { Accept: "application/json" };
  const t = getToken();
  if (t) headers.Authorization = `Bearer ${t}`;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers,
    body: formData,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

/**
 * @returns {Promise<{ ok: boolean, status: number, data: Record<string, unknown> }>}
 */
export async function apiPatchForm(path, formData) {
  const headers = { Accept: "application/json" };
  const t = getToken();
  if (t) headers.Authorization = `Bearer ${t}`;
  const body = new FormData();
  for (const [key, value] of formData.entries()) {
    body.append(key, value);
  }
  // Laravel/PHP reliably handles file uploads via POST multipart with method spoofing.
  if (!body.has("_method")) body.append("_method", "PATCH");

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers,
    body,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

/**
 * @param {Record<string, unknown>} data
 * @param {{ status?: number }} [opts]
 */
export function formatApiErrors(data, opts = {}) {
  const status = opts.status;
  if (status === 401) return "Your session has expired. Please sign in again.";
  if (status === 403) return "You do not have permission to do that.";
  if (status === 404) return "That item could not be found.";
  if (typeof status === "number" && status >= 500) {
    return "The server had a problem. Please try again in a moment.";
  }

  if (!data || typeof data !== "object") {
    return status ? `Request failed (${status}).` : "Something went wrong.";
  }

  const msg = typeof data.message === "string" ? data.message.trim() : "";
  const errs = data.errors;
  const fieldMsgs =
    errs && typeof errs === "object"
      ? Object.values(errs)
          .flat()
          .filter(Boolean)
          .join(" ")
      : "";

  if (fieldMsgs) {
    if (msg && msg !== "The given data was invalid." && !fieldMsgs.includes(msg)) {
      return `${msg} ${fieldMsgs}`.trim();
    }
    return fieldMsgs;
  }

  if (msg) return msg;
  return status ? `Request failed (${status}).` : "Request failed.";
}

export function setFormFeedback(form, message, variant = "error") {
  const el = form.querySelector(".form-feedback");
  if (!el) return;
  el.textContent = message;
  el.hidden = false;
  el.classList.remove("form-feedback--error", "form-feedback--success");
  el.classList.add(variant === "success" ? "form-feedback--success" : "form-feedback--error");
}

export function clearFormFeedback(form) {
  const el = form.querySelector(".form-feedback");
  if (!el) return;
  el.textContent = "";
  el.hidden = true;
  el.classList.remove("form-feedback--error", "form-feedback--success");
}
