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

export function formatApiErrors(data) {
  if (!data || typeof data !== "object") return "Something went wrong.";
  if (typeof data.message === "string" && data.message && !data.errors) return data.message;
  const errs = data.errors;
  if (errs && typeof errs === "object") {
    return Object.values(errs)
      .flat()
      .filter(Boolean)
      .join(" ");
  }
  return "Request failed.";
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
