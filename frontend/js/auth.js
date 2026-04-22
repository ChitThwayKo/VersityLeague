import { API_BASE_URL } from "./config.js";

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

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "PATCH",
    headers,
    body: formData,
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
