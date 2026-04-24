/**
 * API base URL for the Laravel backend.
 *
 * Resolution order:
 * 1. `window.VERSITY_API_BASE_URL`
 * 2. `<meta name="versity-api-base" content="...">`
 * 3. **`import.meta.url`** when this file is `…/frontend/js/config.js`
 * 4. Page path contains **`/frontend`** on localhost → sibling `…/backend/public`
 * 5. Localhost + **static dev port** (5500, 5173, …) → Apache on **`VERSITY_LOCAL_APACHE_PORT` (default 8080)**
 * 6. Localhost + **8080** and URL looks like this project → **keep :8080** (same XAMPP vhost)
 * 7. Localhost + **8080** otherwise → **:8000** (`php artisan serve`)
 * 8. Fallback `http://127.0.0.1:8000`
 *
 * **Windows:** port 80 is often IIS, not XAMPP. Apache is commonly **8080** — default below targets that.
 * Set `window.VERSITY_LOCAL_APACHE_PORT = "80"` before modules if Laravel is on plain `http://localhost/...`.
 */
const STATIC_DEV_PORTS = new Set(["5173", "5500", "3000", "4173", "8888"]);

/** Default folder under Apache for this repo (override with meta or `VERSITY_API_BASE_URL`). */
const VERSITY_DEFAULT_HTDOCS_SEG = "/VersityLeague_V4_D9";

function looksLikeXamppProjectPath(pathname) {
  const p = String(pathname || "")
    .toLowerCase()
    .replace(/\\/g, "/");
  return p.includes("versityleague") || p.includes("/frontend") || p.includes("/backend/public");
}

/** Origin for Laravel when the browser is on localhost and we leave a static dev server / another port. */
function localApacheOrigin(protocol, hostname) {
  try {
    const w = typeof window !== "undefined" ? window.VERSITY_LOCAL_APACHE_PORT : undefined;
    if (w !== undefined && w !== null && String(w).trim() !== "") {
      const port = String(w).trim();
      if (port === "80" || port === "443") return `${protocol}//${hostname}`;
      return `${protocol}//${hostname}:${port}`;
    }
  } catch {
    /* ignore */
  }
  return `${protocol}//${hostname}:8080`;
}

/**
 * Map page origin to the origin where Laravel usually runs (same machine).
 * @param {string} pathname page or module path for :8080 disambiguation
 */
function originForApiFromLocalPage(protocol, hostname, port, pathname) {
  const p = String(port || "");
  if (!p || p === "80" || p === "443") return `${protocol}//${hostname}`;
  if (p === "8080") {
    return looksLikeXamppProjectPath(pathname) ? `${protocol}//${hostname}:8080` : `${protocol}//${hostname}`;
  }
  if (STATIC_DEV_PORTS.has(p)) return localApacheOrigin(protocol, hostname);
  return `${protocol}//${hostname}:${p}`;
}

function inferPort8080Pair() {
  try {
    const loc = window.location;
    if ((loc.hostname === "localhost" || loc.hostname === "127.0.0.1") && loc.port === "8080") {
      if (looksLikeXamppProjectPath(loc.pathname)) return null;
      return `${loc.protocol}//${loc.hostname}:8000`;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function inferSameOriginXamppApi() {
  try {
    const loc = window.location;
    if (loc.hostname !== "localhost" && loc.hostname !== "127.0.0.1") return null;
    const p = loc.pathname;
    if (!p.toLowerCase().includes("/frontend")) return null;
    const basePath = p.replace(/\/frontend\/.*$/i, "").replace(/\/frontend$/i, "");
    if (!basePath) return null;
    const origin = originForApiFromLocalPage(loc.protocol, loc.hostname, loc.port, loc.pathname);
    return `${origin}${basePath}/backend/public`.replace(/\/$/, "");
  } catch {
    return null;
  }
}

/**
 * Resolves API base from where `config.js` is served (ES module URL).
 */
function inferApiFromModuleUrl() {
  try {
    if (typeof import.meta === "undefined" || !import.meta.url) return null;
    const u = new URL(import.meta.url);
    if (u.protocol === "file:") return null;
    const host = u.hostname;
    if (host !== "localhost" && host !== "127.0.0.1") return null;
    const p = u.pathname.replace(/\\/g, "/");
    const match = p.match(/^(.+)\/frontend\/js\/config\.js$/i);
    if (!match) return null;
    const prefix = match[1];
    const origin = originForApiFromLocalPage(u.protocol, u.hostname, u.port, u.pathname);
    return `${origin}${prefix}/backend/public`.replace(/\/$/, "");
  } catch {
    return null;
  }
}

/** Live Server / Vite on a static dev port; Laravel on Apache (default :8080 on Windows). */
function inferLocalApacheVersityBackend() {
  try {
    const loc = window.location;
    if (loc.hostname !== "localhost" && loc.hostname !== "127.0.0.1") return null;
    const port = String(loc.port || "");
    if (!STATIC_DEV_PORTS.has(port)) return null;
    const origin = localApacheOrigin(loc.protocol, loc.hostname);
    return `${origin}${VERSITY_DEFAULT_HTDOCS_SEG}/backend/public`.replace(/\/$/, "");
  } catch {
    return null;
  }
}

function resolveApiBaseUrl() {
  if (typeof window !== "undefined" && window.VERSITY_API_BASE_URL) {
    return String(window.VERSITY_API_BASE_URL).replace(/\/$/, "");
  }
  try {
    const meta = document?.querySelector?.('meta[name="versity-api-base"]')?.getAttribute("content");
    if (meta && meta.trim()) return meta.trim().replace(/\/$/, "");
  } catch {
    /* ignore */
  }
  const fromModule = inferApiFromModuleUrl();
  if (fromModule) return fromModule;
  const xampp = inferSameOriginXamppApi();
  if (xampp) return xampp;
  const apacheGuess = inferLocalApacheVersityBackend();
  if (apacheGuess) return apacheGuess;
  const p8080 = inferPort8080Pair();
  if (p8080) return p8080;
  return "http://127.0.0.1:8000";
}

export const API_BASE_URL = resolveApiBaseUrl();

if (typeof console !== "undefined" && console.info) {
  console.info("[Versity League] API_BASE_URL =", API_BASE_URL);
}
