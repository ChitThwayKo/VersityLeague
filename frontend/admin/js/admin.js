import { API_BASE_URL } from "../../js/config.js";
import {
  apiDelete,
  apiGet,
  apiPatchForm,
  apiPatchJson,
  apiPostForm,
  apiPostJson,
  clearToken,
  formatApiErrors,
  getToken,
  resolveBackendPublicFileUrl,
  setToken,
} from "../../js/auth.js";
import { initPasswordToggles } from "../../js/ui.js";

if (typeof window !== "undefined") {
  window.__VERSITY_ADMIN_BOOTED = false;
}

/** @type {{ id: number; name: string; year: string; starts_on?: string | null; ends_on?: string | null; status: string }[]} */
let leaguesCache = [];
let editingLeagueId = null;
let editingUserKey = null;
let editingClubId = null;
/** @type {Record<string, unknown>[]} */
let clubsCache = [];
/** @type {Record<string, unknown>[]} */
let fixturesCache = [];
/** @type {Record<string, unknown>[]} */
let playersCache = [];
/** @type {Record<string, unknown>[]} */
let fixtureStatsRows = [];
let editingFixtureStatId = null;
/** @type {{ name: string; role: string } | null} */
let currentUser = null;

/** @type {Record<string, unknown>[]} */
let standingsRows = [];
let standingsSortKey = "rank";
let standingsSortDir = 1;

/** @type {Record<string, unknown>[]} */
let certificatesRaw = [];
let certSortKey = "title";
let certSortDir = 1;

function getPasswordRequirementIssue(password) {
  const value = String(password || "");
  if (value.length < 8) return "Password must be at least 8 characters.";
  if (!/[A-Z]/.test(value)) return "Password must include at least one capital letter.";
  if (!/[a-z]/.test(value)) return "Password must include at least one small letter.";
  if (!/[0-9]/.test(value)) return "Password must include at least one number.";
  if (!/[^A-Za-z0-9]/.test(value)) return "Password must include at least one special character.";
  return "";
}

function showGlobalAlert(message, variant = "error") {
  const el = document.getElementById("global-alert");
  if (!el) return;
  el.textContent = message;
  el.hidden = false;
  el.classList.remove("admin-alert--error", "admin-alert--success");
  el.classList.add(variant === "success" ? "admin-alert--success" : "admin-alert--error");
  if (variant === "success") {
    setTimeout(() => {
      el.hidden = true;
    }, 4000);
  }
}

function clearGlobalAlert() {
  const el = document.getElementById("global-alert");
  if (el) el.hidden = true;
}

function isAdminRole(role) {
  return role === "admin" || role === "default_admin";
}

function isDashboardOnlyMode() {
  return typeof window !== "undefined" && Boolean(window.VERSITY_ADMIN_DASHBOARD_ONLY);
}

function resolvePublicHomeUrl() {
  try {
    if (typeof import.meta !== "undefined" && import.meta.url) {
      const m = new URL(import.meta.url);
      const p = m.pathname.replace(/\\/g, "/");
      if (/\/frontend\/admin\/js\/admin\.js$/i.test(p)) {
        m.pathname = p.replace(/\/frontend\/admin\/js\/admin\.js$/i, "/frontend/index.html");
        m.search = "";
        m.hash = "";
        return m.toString();
      }
    }
  } catch {
    /* ignore */
  }
  return new URL("../index.html", window.location.href).toString();
}

function resolveAdminDashboardUrl() {
  try {
    if (typeof import.meta !== "undefined" && import.meta.url) {
      const m = new URL(import.meta.url);
      const p = m.pathname.replace(/\\/g, "/");
      if (/\/frontend\/admin\/js\/admin\.js$/i.test(p)) {
        m.pathname = p.replace(/\/frontend\/admin\/js\/admin\.js$/i, "/frontend/admin/adminDashboard.html");
        m.search = "";
        m.hash = "";
        return m.toString();
      }
    }
  } catch {
    /* ignore */
  }
  return new URL("index.html", window.location.href).toString();
}

async function loadMe() {
  const { ok, data } = await apiGet("/api/v1/auth/me", { auth: true });
  if (!ok || !data.user) {
    return null;
  }
  return /** @type {{ id: number; name: string; email: string; role: string } | null } */ (data.user);
}

function setPanel(name) {
  document.querySelectorAll(".admin-nav button").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.panel === name);
  });
  document.querySelectorAll(".admin-panel").forEach((p) => {
    p.classList.toggle("is-active", p.id === `panel-${name}`);
  });
}

function leagueOptionsHtml(selectedId) {
  return leaguesCache
    .map(
      (l) =>
        `<option value="${l.id}" ${String(l.id) === String(selectedId) ? "selected" : ""}>${escapeHtml(
          l.name,
        )} (${escapeHtml(l.year)})</option>`,
    )
    .join("");
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function toDateTimeText(v) {
  if (!v) return "—";
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString();
}

/** @param {string | null | undefined} iso */
function leagueDateForInput(iso) {
  if (!iso) return "";
  const s = String(iso);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

/** @param {string | null | undefined} iso */
function leagueDateDisplay(iso) {
  if (!iso) return "—";
  const s = String(iso);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

async function refreshLeagues() {
  const { ok, data, status } = await apiGet("/api/v1/admin/leagues", { auth: true });
  if (!ok) {
    showGlobalAlert(formatApiErrors(data, { status }));
    return;
  }
  leaguesCache = /** @type {typeof leaguesCache} */ (data.leagues || []);
  const tbody = document.querySelector("#table-leagues tbody");
  if (!tbody) return;
  tbody.innerHTML = leaguesCache
    .map(
      (l) => {
        const isEditing = String(editingLeagueId) === String(l.id);
        return `
      <tr data-league-id="${l.id}">
        <td>${l.id}</td>
        <td>${
          isEditing
            ? `<input type="text" class="inp-league-name" value="${escapeHtml(l.name)}" />`
            : escapeHtml(l.name)
        }</td>
        <td>${
          isEditing
            ? `<input type="text" class="inp-league-year" value="${escapeHtml(l.year)}" />`
            : escapeHtml(l.year)
        }</td>
        <td>${
          isEditing
            ? `<input type="date" class="inp-league-starts" value="${escapeHtml(leagueDateForInput(l.starts_on))}" />`
            : escapeHtml(leagueDateDisplay(l.starts_on))
        }</td>
        <td>${
          isEditing
            ? `<input type="date" class="inp-league-ends" value="${escapeHtml(leagueDateForInput(l.ends_on))}" />`
            : escapeHtml(leagueDateDisplay(l.ends_on))
        }</td>
        <td>${
          isEditing
            ? `<select class="inp-league-status">
                <option value="inactive" ${l.status === "inactive" ? "selected" : ""}>inactive</option>
                <option value="active" ${l.status === "active" ? "selected" : ""}>active</option>
              </select>`
            : escapeHtml(l.status)
        }</td>
        <td>
          ${
            isEditing
              ? `<button type="button" class="btn btn--primary btn--sm btn--icon btn-league-save" title="Save" aria-label="Save">&#128190;</button>
                 <button type="button" class="btn btn--ghost btn--sm btn-league-cancel">Cancel</button>`
              : `<button type="button" class="btn btn--primary btn--sm btn--icon btn-league-edit" title="Edit" aria-label="Edit">&#9998;</button>`
          }
          <button type="button" class="btn btn--danger btn--sm btn--icon btn-league-del" title="Delete" aria-label="Delete">
            &#128465;
          </button>
        </td>
      </tr>`;
      },
    )
    .join("");

  const fl = document.getElementById("fixture-league");
  if (fl) {
    fl.innerHTML = leaguesCache.map((l) => `<option value="${l.id}">${escapeHtml(l.name)}</option>`).join("");
  }
}

async function refreshClubs() {
  const status = document.getElementById("club-filter-status")?.value || "";
  const q = status ? `?status=${encodeURIComponent(status)}` : "";
  const { ok, data } = await apiGet(`/api/v1/admin/clubs${q}`, { auth: true });
  if (!ok) {
    showGlobalAlert(formatApiErrors(data));
    return;
  }
  clubsCache = /** @type {typeof clubsCache} */ (data.clubs || []);
  const tbody = document.querySelector("#table-clubs tbody");
  if (!tbody) return;

  tbody.innerHTML = clubsCache
    .map((c) => {
      const id = c.id;
      const leagueIdSel = String(c.league_id ?? "");
      const isEditing = editingClubId !== null && Number(editingClubId) === Number(id);
      const manager = c.manager && typeof c.manager === "object" ? /** @type {{email:string}} */ (c.manager).email : "—";
      const logoUrl = resolveBackendPublicFileUrl(typeof c.club_photo_url === "string" ? c.club_photo_url : "");
      const photo = logoUrl
        ? `<img class="thumb" src="${escapeHtml(logoUrl)}" alt="${escapeHtml(String(c.club_name ?? "Club"))} logo" loading="lazy" />`
        : `<span class="admin-muted">—</span>`;

      const nameCell = isEditing
        ? `<input type="text" class="inp-club-name" value="${escapeHtml(String(c.club_name ?? ""))}" />`
        : escapeHtml(String(c.club_name ?? ""));

      const statusCell = isEditing
        ? `<select class="inp-club-status">
            <option value="pending" ${c.status === "pending" ? "selected" : ""}>pending</option>
            <option value="approved" ${c.status === "approved" ? "selected" : ""}>approved</option>
            <option value="rejected" ${c.status === "rejected" ? "selected" : ""}>rejected</option>
          </select>`
        : escapeHtml(String(c.status ?? ""));

      let actionsHtml = "";
      if (isEditing) {
        actionsHtml = `<select class="inp-club-league"><option value="">— none —</option>${leagueOptionsHtml(
          leagueIdSel,
        )}</select>
          <button type="button" class="btn btn--primary btn--sm btn--icon btn-club-save" title="Save" aria-label="Save">&#128190;</button>
          <button type="button" class="btn btn--ghost btn--sm btn-club-cancel">Cancel</button>`;
      } else {
        if (c.status === "pending") {
          actionsHtml += `<select class="club-pick-league"><option value="">Select league…</option>${leagueOptionsHtml(
            leagueIdSel,
          )}</select>
            <button type="button" class="btn btn--primary btn--sm btn-club-approve">Approve</button>
            <button type="button" class="btn btn--danger btn--sm btn-club-reject">Reject</button>`;
        }
        actionsHtml += `<button type="button" class="btn btn--primary btn--sm btn--icon btn-club-edit" title="Edit" aria-label="Edit">&#9998;</button>
          <button type="button" class="btn btn--danger btn--sm btn--icon btn-club-del" title="Delete" aria-label="Delete">&#128465;</button>`;
      }

      return `<tr data-club-id="${id}">
        <td>${id}</td>
        <td>${photo}</td>
        <td>${nameCell}</td>
        <td>${statusCell}</td>
        <td>${escapeHtml(manager)}</td>
        <td>${c.players_count ?? "—"}</td>
        <td>${actionsHtml}</td>
      </tr>`;
    })
    .join("");

  populateFixtureClubSelectors();
  playersCache = clubsCache.flatMap((c) =>
    Array.isArray(c.players) ? c.players : [],
  );
  renderPlayersTableFromCache();
  syncFixtureStatSelectors();
}

function approvedClubs() {
  return clubsCache.filter((c) => c.status === "approved");
}

function populateFixtureClubSelectors() {
  const home = document.getElementById("fixture-home");
  const away = document.getElementById("fixture-away");
  if (!home || !away) return;
  const opts = approvedClubs()
    .map((c) => `<option value="${c.id}">${escapeHtml(String(c.club_name))}</option>`)
    .join("");
  home.innerHTML = opts;
  away.innerHTML = opts;
}

function renderPlayersTableFromCache() {
  const tbody = document.querySelector("#table-players tbody");
  if (!tbody) return;

  const rows = [];
  for (const club of clubsCache) {
    const players = Array.isArray(club.players) ? club.players : [];
    const seasonText =
      club.league && typeof club.league === "object"
        ? [club.league.name, club.league.year].filter(Boolean).join(" ")
        : "—";
    for (const p of players) {
      rows.push({
        id: p.id,
        full_name: p.full_name,
        student_staff_id: p.student_staff_id,
        position: p.position,
        goals_count: Number(p.goals_count ?? 0),
        assists_count: Number(p.assists_count ?? 0),
        club_name: club.club_name,
        year: seasonText,
      });
    }
  }

  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="admin-muted">No players found.</td></tr>`;
    return;
  }

  tbody.innerHTML = rows
    .map(
      (p) => `<tr>
      <td>${p.id}</td>
      <td>${escapeHtml(String(p.full_name ?? ""))}</td>
      <td>${escapeHtml(String(p.student_staff_id ?? ""))}</td>
      <td>${escapeHtml(String(p.position ?? ""))}</td>
      <td>${escapeHtml(String(p.goals_count ?? 0))}</td>
      <td>${escapeHtml(String(p.assists_count ?? 0))}</td>
      <td>${escapeHtml(String(p.club_name ?? ""))}</td>
      <td>${escapeHtml(String(p.year ?? "—"))}</td>
      <td><button type="button" class="btn btn--danger btn--sm btn--icon btn-player-del" data-id="${p.id}" title="Delete" aria-label="Delete">&#128465;</button></td>
    </tr>`,
    )
    .join("");
}

async function refreshFixtures() {
  const { ok, data } = await apiGet("/api/v1/admin/fixtures", { auth: true });
  if (!ok) {
    showGlobalAlert(formatApiErrors(data));
    return;
  }
  fixturesCache = /** @type {Record<string, unknown>[]} */ (data.fixtures || []);
  const tbody = document.querySelector("#table-fixtures tbody");
  if (!tbody) return;
  tbody.innerHTML = fixturesCache
    .map((f) => {
      const league = f.league && typeof f.league === "object" ? /** @type {{name:string}} */ (f.league).name : "";
      const h = f.home_club && typeof f.home_club === "object" ? /** @type {{club_name:string}} */ (f.home_club).club_name : "";
      const a = f.away_club && typeof f.away_club === "object" ? /** @type {{club_name:string}} */ (f.away_club).club_name : "";
      const score =
        f.home_score != null && f.away_score != null ? `${f.home_score} – ${f.away_score}` : "—";
      return `<tr>
        <td>${f.id}</td>
        <td>${escapeHtml(league)}</td>
        <td>${escapeHtml(h)} vs ${escapeHtml(a)}</td>
        <td>${escapeHtml(String(f.match_date))} ${escapeHtml(String(f.match_time)).slice(0, 5)}</td>
        <td>${escapeHtml(score)}</td>
        <td>${escapeHtml(String(f.status))}</td>
        <td><button type="button" class="btn btn--danger btn--sm btn--icon btn-fix-del" data-id="${f.id}" title="Delete" aria-label="Delete">&#128465;</button></td>
      </tr>`;
    })
    .join("");
  syncFixtureStatSelectors();
}

async function refreshPhotos() {
  const { ok, data } = await apiGet("/api/v1/admin/photos", { auth: true });
  if (!ok) {
    showGlobalAlert(formatApiErrors(data));
    return;
  }
  const photos = /** @type {Record<string, unknown>[]} */ (data.photos || []);
  const max = typeof data.max_photos === "number" ? data.max_photos : 5;
  const tbody = document.querySelector("#table-photos tbody");
  if (!tbody) return;
  tbody.innerHTML = photos
    .map(
      (p) => `
      <tr data-photo-id="${p.id}">
        <td>${p.id}</td>
        <td><img class="thumb" src="${escapeHtml(resolveBackendPublicFileUrl(String(p.image_url)))}" alt="" /></td>
        <td>
          <input type="file" class="inp-photo-replace" accept="image/*" />
          <button type="button" class="btn btn--primary btn--sm btn-photo-replace">Replace</button>
        </td>
        <td><button type="button" class="btn btn--danger btn--sm btn--icon btn-photo-del" title="Delete" aria-label="Delete">&#128465;</button></td>
      </tr>`,
    )
    .join("");
  const hint = document.querySelector("#panel-photos .admin-muted");
  if (hint) hint.textContent = `Maximum of ${max} images (${photos.length} in use).`;
}

async function refreshUsers() {
  const { ok, data } = await apiGet("/api/v1/admin/users", { auth: true });
  if (!ok) {
    if (/** @type {any} */ (data).message) showGlobalAlert(formatApiErrors(data));
    return;
  }
  const adminUsers = /** @type {Record<string, unknown>[]} */ (data.admin_users || []);
  const clientUsers = /** @type {Record<string, unknown>[]} */ (data.client_users || []);
  const adminBody = document.querySelector("#table-users-admin tbody");
  const clientBody = document.querySelector("#table-users-client tbody");
  if (adminBody) {
    adminBody.innerHTML = adminUsers
      .map((u) => {
        const rowKey = `admin-${u.id}`;
        const isEditing = editingUserKey === rowKey;
        return `<tr data-user-row-key="${rowKey}">
      <td>${u.id}</td>
      <td>${
        isEditing
          ? `<input type="text" class="inp-user-name" value="${escapeHtml(String(u.name ?? ""))}" />`
          : escapeHtml(String(u.name ?? ""))
      }</td>
      <td>${
        isEditing
          ? `<input type="email" class="inp-user-email" value="${escapeHtml(String(u.email ?? ""))}" />`
          : escapeHtml(String(u.email ?? ""))
      }</td>
      <td>${
        isEditing
          ? `<input type="text" class="inp-user-ssid" value="${escapeHtml(String(u.student_staff_id ?? ""))}" />`
          : escapeHtml(String(u.student_staff_id ?? ""))
      }</td>
      <td>${escapeHtml(String(u.role ?? ""))}</td>
      <td>${escapeHtml(toDateTimeText(u.created_at))}</td>
      <td>
        ${
          isEditing
            ? `<button type="button" class="btn btn--primary btn--sm btn--icon btn-user-save" data-user-id="${u.id}" title="Save" aria-label="Save">&#128190;</button>
               <button type="button" class="btn btn--ghost btn--sm btn-user-cancel">Cancel</button>`
            : `<button type="button" class="btn btn--primary btn--sm btn--icon btn-user-edit" data-user-id="${u.id}" data-user-key="${rowKey}" title="Edit" aria-label="Edit">&#9998;</button>`
        }
        <button type="button" class="btn btn--danger btn--sm btn--icon btn-user-del" data-user-id="${u.id}" title="Delete" aria-label="Delete">&#128465;</button>
      </td>
    </tr>`;
      })
      .join("");
  }
  if (clientBody) {
    clientBody.innerHTML = clientUsers
      .map((u) => {
        const rowKey = `client-${u.id}`;
        const isEditing = editingUserKey === rowKey;
        return `<tr data-user-row-key="${rowKey}">
      <td>${u.id}</td>
      <td>${
        isEditing
          ? `<input type="text" class="inp-user-name" value="${escapeHtml(String(u.name ?? ""))}" />`
          : escapeHtml(String(u.name ?? ""))
      }</td>
      <td>${
        isEditing
          ? `<input type="email" class="inp-user-email" value="${escapeHtml(String(u.email ?? ""))}" />`
          : escapeHtml(String(u.email ?? ""))
      }</td>
      <td>${
        isEditing
          ? `<input type="text" class="inp-user-ssid" value="${escapeHtml(String(u.student_staff_id ?? ""))}" />`
          : escapeHtml(String(u.student_staff_id ?? ""))
      }</td>
      <td>${escapeHtml(String(u.linked_club ?? "—"))}</td>
      <td>${escapeHtml(toDateTimeText(u.created_at))}</td>
      <td>
        ${
          isEditing
            ? `<button type="button" class="btn btn--primary btn--sm btn--icon btn-user-save" data-user-id="${u.id}" title="Save" aria-label="Save">&#128190;</button>
               <button type="button" class="btn btn--ghost btn--sm btn-user-cancel">Cancel</button>`
            : `<button type="button" class="btn btn--primary btn--sm btn--icon btn-user-edit" data-user-id="${u.id}" data-user-key="${rowKey}" title="Edit" aria-label="Edit">&#9998;</button>`
        }
        <button type="button" class="btn btn--danger btn--sm btn--icon btn-user-del" data-user-id="${u.id}" title="Delete" aria-label="Delete">&#128465;</button>
      </td>
    </tr>`;
      })
      .join("");
  }
}

async function refreshAll() {
  clearGlobalAlert();
  if (!currentUser) return;
  await refreshLeagues();
  await refreshClubs();
  await refreshFixtures();
  await refreshPhotos();
  if (currentUser.role === "default_admin") {
    await refreshUsers();
  }
  syncStandingsLeagueSelect();
  if (document.getElementById("panel-standings")?.classList.contains("is-active")) {
    await loadStandingsData();
  }
  if (document.getElementById("panel-certificates")?.classList.contains("is-active")) {
    await loadCertificatesData();
  }
}

function syncStandingsLeagueSelect() {
  const sel = document.getElementById("standings-league-select");
  if (!sel) return;
  const prev = sel.value;
  sel.innerHTML = leaguesCache
    .map((l) => `<option value="${l.id}">${escapeHtml(l.name)} (${escapeHtml(l.year)})</option>`)
    .join("");
  const active = leaguesCache.find((l) => l.status === "active");
  if (prev && leaguesCache.some((l) => String(l.id) === prev)) {
    sel.value = prev;
  } else if (active) {
    sel.value = String(active.id);
  } else if (leaguesCache[0]) {
    sel.value = String(leaguesCache[0].id);
  }
}

async function loadStandingsData() {
  const sel = document.getElementById("standings-league-select");
  const leagueId = sel?.value || "";
  const q = leagueId ? `?league_id=${encodeURIComponent(leagueId)}` : "";
  const { ok, data, status } = await apiGet(`/api/v1/admin/standings${q}`, { auth: true });
  if (!ok) {
    standingsRows = [];
    showGlobalAlert(formatApiErrors(data, { status }));
    renderStandingsTable();
    return;
  }
  standingsRows = /** @type {Record<string, unknown>[]} */ (data.standings || []);
  renderStandingsTable();
}

function numSort(a, b, key, dir) {
  const va = Number(a[key]);
  const vb = Number(b[key]);
  if (Number.isNaN(va) && Number.isNaN(vb)) {
    return 0;
  }
  if (Number.isNaN(va)) return 1;
  if (Number.isNaN(vb)) return -1;
  return (va - vb) * dir;
}

function renderStandingsTable() {
  const tbody = document.querySelector("#table-standings tbody");
  if (!tbody) return;
  const q = (document.getElementById("standings-search")?.value || "").trim().toLowerCase();
  let rows = standingsRows.slice();
  if (q) rows = rows.filter((r) => String(r.club_name || "").toLowerCase().includes(q));
  const key = standingsSortKey;
  const dir = standingsSortDir;
  const isNum = ["rank", "played", "won", "drawn", "lost", "goals_for", "goals_against", "goal_difference", "points"].includes(key);
  rows = [...rows].sort((a, b) => {
    if (isNum) return numSort(a, b, key, dir);
    return String(a[key] ?? "").localeCompare(String(b[key] ?? ""), undefined, { sensitivity: "base" }) * dir;
  });
  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" class="admin-muted">No standings for this season or no match for search.</td></tr>`;
    return;
  }
  tbody.innerHTML = rows
    .map(
      (r, i) => `<tr>
      <td>${i + 1}</td>
      <td>${escapeHtml(String(r.club_name ?? "—"))}</td>
      <td>${escapeHtml(String(r.played ?? "—"))}</td>
      <td>${escapeHtml(String(r.won ?? "—"))}</td>
      <td>${escapeHtml(String(r.drawn ?? "—"))}</td>
      <td>${escapeHtml(String(r.lost ?? "—"))}</td>
      <td>${escapeHtml(String(r.goals_for ?? "—"))}</td>
      <td>${escapeHtml(String(r.goals_against ?? "—"))}</td>
      <td>${escapeHtml(String(r.goal_difference ?? "—"))}</td>
      <td><strong>${escapeHtml(String(r.points ?? "—"))}</strong></td>
    </tr>`,
    )
    .join("");
}

async function refreshStandingsPanel() {
  syncStandingsLeagueSelect();
  await loadStandingsData();
}

async function loadCertificatesData() {
  const { ok, data, status } = await apiGet("/api/v1/admin/certificates", { auth: true });
  if (!ok) {
    certificatesRaw = [];
    showGlobalAlert(formatApiErrors(data, { status }));
    renderCertificatesTable();
    return;
  }
  certificatesRaw = /** @type {Record<string, unknown>[]} */ (data.certificates || []);
  renderCertificatesTable();
}

function renderCertificatesTable() {
  const tbody = document.querySelector("#table-certificates tbody");
  if (!tbody) return;
  const q = (document.getElementById("certificates-search")?.value || "").trim().toLowerCase();
  let rows = [...certificatesRaw];
  if (q) {
    rows = rows.filter((c) => {
      const blob = [
        c.title,
        c.user_name,
        c.student_staff_id,
        c.user_email,
        c.positions_played,
        c.type,
      ]
        .map((x) => String(x ?? "").toLowerCase())
        .join(" ");
      return blob.includes(q);
    });
  }
  const key = certSortKey;
  const dir = certSortDir;
  const numKeys = ["scored", "assisted", "participate_year_start"];
  rows.sort((a, b) => {
    if (numKeys.includes(key)) return numSort(a, b, key, dir);
    return String(a[key] ?? "").localeCompare(String(b[key] ?? ""), undefined, { sensitivity: "base" }) * dir;
  });
  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="admin-muted">No certificates or no match for search.</td></tr>`;
    return;
  }
  tbody.innerHTML = rows
    .map((c) => {
      const yr = `${c.participate_year_start ?? "—"}-${c.participate_year_end ?? "—"}`;
      return `<tr>
        <td>${escapeHtml(String(c.title ?? "—"))}</td>
        <td>${escapeHtml(String(c.student_staff_id ?? "—"))}</td>
        <td>${escapeHtml(String(c.user_name ?? "—"))}</td>
        <td>${escapeHtml(yr)}</td>
        <td>${escapeHtml(String(c.positions_played ?? "—"))}</td>
        <td>${escapeHtml(String(c.scored ?? "—"))}</td>
        <td>${escapeHtml(String(c.assisted ?? "—"))}</td>
        <td><button type="button" class="btn btn--primary btn--sm btn-cert-pdf" data-cert-id="${c.id}">PDF</button></td>
      </tr>`;
    })
    .join("");
}

async function refreshCertificatesPanel() {
  await loadCertificatesData();
}

function wireStandingsPanel() {
  document.getElementById("standings-league-select")?.addEventListener("change", () => {
    void loadStandingsData();
  });
  document.getElementById("btn-standings-refresh")?.addEventListener("click", () => {
    void refreshStandingsPanel();
  });
  document.getElementById("standings-search")?.addEventListener("input", () => {
    renderStandingsTable();
  });
  document.querySelector("#table-standings thead")?.addEventListener("click", (e) => {
    const th = /** @type {HTMLElement} */ (e.target).closest("th[data-sort]");
    if (!th) return;
    const key = th.getAttribute("data-sort");
    if (!key) return;
    if (standingsSortKey === key) standingsSortDir *= -1;
    else {
      standingsSortKey = key;
      standingsSortDir = key === "club_name" ? 1 : -1;
    }
    renderStandingsTable();
  });
}

function wireCertificatesPanel() {
  document.getElementById("certificates-search")?.addEventListener("input", () => {
    renderCertificatesTable();
  });
  document.getElementById("btn-certificates-refresh")?.addEventListener("click", () => {
    void refreshCertificatesPanel();
  });
  document.querySelector("#table-certificates thead")?.addEventListener("click", (e) => {
    const th = /** @type {HTMLElement} */ (e.target).closest("th[data-cert-sort]");
    if (!th) return;
    const key = th.getAttribute("data-cert-sort");
    if (!key) return;
    if (certSortKey === key) certSortDir *= -1;
    else {
      certSortKey = key;
      certSortDir = 1;
    }
    renderCertificatesTable();
  });
  document.querySelector("#table-certificates")?.addEventListener("click", async (e) => {
    const btn = /** @type {HTMLElement} */ (e.target).closest(".btn-cert-pdf");
    if (!btn) return;
    const id = btn.getAttribute("data-cert-id");
    if (!id || !getToken()) return;
    const res = await fetch(`${API_BASE_URL}/api/v1/admin/certificates/${id}/pdf`, {
      headers: { Authorization: `Bearer ${getToken()}`, Accept: "application/pdf" },
    });
    if (!res.ok) {
      showGlobalAlert("Could not download certificate PDF.");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `certificate-${id}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  });
}

async function logoutToPublicSite() {
  try {
    if (getToken()) {
      await apiPostJson("/api/v1/auth/logout", {}, { auth: true });
    }
  } catch {
    /* still clear local session */
  }
  clearToken();
  currentUser = null;
  window.location.replace(resolvePublicHomeUrl());
}

function wireNav() {
  document.getElementById("admin-nav")?.addEventListener("click", async (e) => {
    if (/** @type {HTMLElement} */ (e.target).closest("#btn-nav-logout")) {
      e.preventDefault();
      await logoutToPublicSite();
      return;
    }
    const btn = /** @type {HTMLElement} */ (e.target).closest("button[data-panel]");
    if (!btn) return;
    const name = btn.dataset.panel || "leagues";
    setPanel(name);
    if (name === "standings") await refreshStandingsPanel();
    if (name === "certificates") await refreshCertificatesPanel();
  });
}

function wireLeagueTable() {
  document.querySelector("#table-leagues")?.addEventListener("click", async (e) => {
    const t = /** @type {HTMLElement} */ (e.target);
    const tr = t.closest("tr[data-league-id]");
    if (!tr) return;
    const id = tr.getAttribute("data-league-id");
    if (!id) return;
    if (t.classList.contains("btn-league-del")) {
      if (!confirm("Delete this season? This cannot be undone if the API allows it.")) return;
      const { ok, data, status } = await apiDelete(`/api/v1/admin/leagues/${id}`, { auth: true });
      if (!ok) showGlobalAlert(formatApiErrors(data, { status }));
      else {
        showGlobalAlert("Season deleted.", "success");
        await refreshAll();
      }
      return;
    }
    if (t.classList.contains("btn-league-edit")) {
      editingLeagueId = id;
      await refreshLeagues();
      return;
    }
    if (t.classList.contains("btn-league-cancel")) {
      editingLeagueId = null;
      await refreshLeagues();
      return;
    }
    if (t.classList.contains("btn-league-edit")) {
      return;
    }
    if (t.classList.contains("btn-league-save")) {
      const name = tr.querySelector(".inp-league-name")?.value?.trim();
      const year = tr.querySelector(".inp-league-year")?.value?.trim();
      const starts_on = tr.querySelector(".inp-league-starts")?.value?.trim();
      const ends_on = tr.querySelector(".inp-league-ends")?.value?.trim();
      const status = tr.querySelector(".inp-league-status")?.value;
      if (!name || !year || !status) {
        showGlobalAlert("Season name, year, and status are required.");
        return;
      }
      if (!starts_on || !ends_on) {
        showGlobalAlert("Start date and end date are required.");
        return;
      }
      const { ok, data } = await apiPatchJson(
        `/api/v1/admin/leagues/${id}`,
        { name, year, starts_on, ends_on, status },
        { auth: true },
      );
      if (!ok) showGlobalAlert(formatApiErrors(data));
      else {
        editingLeagueId = null;
        showGlobalAlert("Season updated.", "success");
        await refreshAll();
      }
    }
  });
}

function wireLeagueCreate() {
  document.getElementById("form-league-create")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = /** @type {HTMLFormElement} */ (e.target);
    const fd = new FormData(form);
    const starts_on = String(fd.get("starts_on") || "").trim();
    const ends_on = String(fd.get("ends_on") || "").trim();
    const body = {
      name: fd.get("name"),
      year: fd.get("year"),
      starts_on,
      ends_on,
      status: fd.get("status"),
    };
    if (!starts_on || !ends_on) {
      showGlobalAlert("Start date and end date are required.");
      return;
    }
    const { ok, data } = await apiPostJson("/api/v1/admin/leagues", body, { auth: true });
    if (!ok) showGlobalAlert(formatApiErrors(data));
    else {
      showGlobalAlert("Season created.", "success");
      form.reset();
      await refreshAll();
    }
  });
}

function wireClubTable() {
  document.getElementById("club-filter-status")?.addEventListener("change", () => refreshClubs());
  document.getElementById("btn-clubs-refresh")?.addEventListener("click", () => refreshClubs());

  document.querySelector("#table-clubs")?.addEventListener("click", async (e) => {
    const btn = /** @type {HTMLElement | null} */ (e.target instanceof Element ? e.target.closest("button") : null);
    const tr = /** @type {HTMLElement | null} */ (e.target instanceof Element ? e.target.closest("tr[data-club-id]") : null);
    if (!tr) return;
    const id = tr.getAttribute("data-club-id");
    if (!id) return;

    if (btn?.classList.contains("btn-club-edit")) {
      editingClubId = Number(id);
      await refreshClubs();
      return;
    }
    if (btn?.classList.contains("btn-club-cancel")) {
      editingClubId = null;
      await refreshClubs();
      return;
    }
    if (btn?.classList.contains("btn-club-save")) {
      const nameInp = tr.querySelector(".inp-club-name");
      const statusSel = tr.querySelector(".inp-club-status");
      const leagueSel = tr.querySelector(".inp-club-league");
      const name = /** @type {HTMLInputElement | null} */ (nameInp)?.value?.trim();
      const status = /** @type {HTMLSelectElement | null} */ (statusSel)?.value;
      if (!name) {
        showGlobalAlert("Club name is required.");
        return;
      }
      if (!status) {
        showGlobalAlert("Status is required.");
        return;
      }
      /** @type {{ club_name: string; status: string; league_id: number | null }} */
      const body = { club_name: name, status, league_id: null };
      if (status === "approved") {
        const v = /** @type {HTMLSelectElement | null} */ (leagueSel)?.value;
        if (!v) {
          showGlobalAlert("Approved clubs must be assigned to a league.");
          return;
        }
        body.league_id = Number(v);
      } else {
        const v = /** @type {HTMLSelectElement | null} */ (leagueSel)?.value;
        body.league_id = v ? Number(v) : null;
      }
      const { ok, data } = await apiPatchJson(`/api/v1/admin/clubs/${id}`, body, { auth: true });
      if (!ok) showGlobalAlert(formatApiErrors(data));
      else {
        editingClubId = null;
        showGlobalAlert("Club updated.", "success");
        await refreshAll();
      }
      return;
    }
    if (btn?.classList.contains("btn-club-del")) {
      if (!confirm("Delete this club? This removes linked players and fixtures.")) return;
      const { ok, data } = await apiDelete(`/api/v1/admin/clubs/${id}`, { auth: true });
      if (!ok) showGlobalAlert(formatApiErrors(data));
      else {
        if (editingClubId !== null && Number(editingClubId) === Number(id)) editingClubId = null;
        showGlobalAlert("Club deleted.", "success");
        await refreshAll();
      }
      return;
    }
    if (btn?.classList.contains("btn-club-approve")) {
      const sel = tr.querySelector(".club-pick-league");
      const leagueId = /** @type {HTMLSelectElement | null} */ (sel)?.value;
      if (!leagueId) {
        showGlobalAlert("Choose a league before approving.");
        return;
      }
      const { ok, data } = await apiPatchJson(
        `/api/v1/admin/clubs/${id}`,
        { status: "approved", league_id: Number(leagueId) },
        { auth: true },
      );
      if (!ok) showGlobalAlert(formatApiErrors(data));
      else {
        showGlobalAlert("Club approved.", "success");
        await refreshAll();
      }
      return;
    }
    if (btn?.classList.contains("btn-club-reject")) {
      const { ok, data } = await apiPatchJson(`/api/v1/admin/clubs/${id}`, { status: "rejected" }, { auth: true });
      if (!ok) showGlobalAlert(formatApiErrors(data));
      else {
        showGlobalAlert("Club rejected.", "success");
        await refreshAll();
      }
    }
  });
}

function wirePlayers() {
  document.querySelector("#table-players")?.addEventListener("click", async (e) => {
    const t = /** @type {HTMLElement} */ (e.target);
    if (!t.classList.contains("btn-player-del")) return;
    const id = t.getAttribute("data-id");
    if (!id || !confirm("Delete this player?")) return;
    const { ok, data } = await apiDelete(`/api/v1/admin/players/${id}`, { auth: true });
    if (!ok) showGlobalAlert(formatApiErrors(data));
    else {
      showGlobalAlert("Player removed.", "success");
      await refreshAll();
    }
  });
}

function wireFixtures() {
  document.getElementById("form-fixture-create")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = /** @type {HTMLFormElement} */ (e.target);
    const fd = new FormData(form);
    const body = {
      league_id: Number(fd.get("league_id")),
      home_club_id: Number(fd.get("home_club_id")),
      away_club_id: Number(fd.get("away_club_id")),
      match_date: fd.get("match_date"),
      match_time: fd.get("match_time"),
      venue: fd.get("venue"),
      status: fd.get("status"),
    };
    if (fd.get("home_score") !== "") body.home_score = Number(fd.get("home_score"));
    if (fd.get("away_score") !== "") body.away_score = Number(fd.get("away_score"));
    const { ok, data } = await apiPostJson("/api/v1/admin/fixtures", body, { auth: true });
    if (!ok) showGlobalAlert(formatApiErrors(data));
    else {
      showGlobalAlert("Fixture created.", "success");
      form.reset();
      await refreshAll();
    }
  });

  document.querySelector("#table-fixtures")?.addEventListener("click", async (e) => {
    const t = /** @type {HTMLElement} */ (e.target);
    if (!t.classList.contains("btn-fix-del")) return;
    const id = t.getAttribute("data-id");
    if (!id || !confirm("Delete fixture?")) return;
    const { ok, data } = await apiDelete(`/api/v1/admin/fixtures/${id}`, { auth: true });
    if (!ok) showGlobalAlert(formatApiErrors(data));
    else {
      showGlobalAlert("Fixture deleted.", "success");
      await refreshAll();
    }
  });
}

function fixtureClubPlayerOptions(fixtureId) {
  const fixture = fixturesCache.find((f) => String(f.id) === String(fixtureId));
  if (!fixture) return [];
  const allowedClubIds = [String(fixture.home_club_id), String(fixture.away_club_id)];
  const rows = [];
  for (const club of clubsCache) {
    if (!allowedClubIds.includes(String(club.id))) continue;
    const players = Array.isArray(club.players) ? club.players : [];
    for (const p of players) {
      rows.push({
        id: p.id,
        label: `${p.full_name} (${club.club_name})`,
      });
    }
  }
  return rows;
}

function syncFixtureStatSelectors() {
  const fixtureSel = document.getElementById("fixture-stats-fixture");
  const playerSel = document.getElementById("fixture-stats-player");
  if (!fixtureSel || !playerSel) return;

  const prevFixtureId = fixtureSel.value;
  fixtureSel.innerHTML = fixturesCache
    .map((f) => `<option value="${f.id}">#${f.id} ${escapeHtml(String(f.home_club?.club_name || ""))} vs ${escapeHtml(String(f.away_club?.club_name || ""))}</option>`)
    .join("");
  if (prevFixtureId && fixturesCache.some((f) => String(f.id) === String(prevFixtureId))) {
    fixtureSel.value = prevFixtureId;
  }

  const options = fixtureClubPlayerOptions(fixtureSel.value);
  playerSel.innerHTML = options
    .map((o) => `<option value="${o.id}">${escapeHtml(o.label)}</option>`)
    .join("");
}

async function loadFixtureStats() {
  const fixtureSel = document.getElementById("fixture-stats-fixture");
  const fixtureId = fixtureSel?.value;
  if (!fixtureId) return;

  const { ok, data, status } = await apiGet(`/api/v1/admin/fixtures/${fixtureId}/player-stats`, { auth: true });
  if (!ok) {
    showGlobalAlert(formatApiErrors(data, { status }));
    return;
  }
  fixtureStatsRows = /** @type {Record<string, unknown>[]} */ (data.stats || []);
  renderFixtureStatsTable();
}

function renderFixtureStatsTable() {
  const tbody = document.querySelector("#table-fixture-stats tbody");
  if (!tbody) return;
  if (fixtureStatsRows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="admin-muted">No fixture stats found.</td></tr>`;
    return;
  }
  tbody.innerHTML = fixtureStatsRows
    .map(
      (r) => {
        const rowId = String(r.id ?? "");
        const isEditing = editingFixtureStatId !== null && String(editingFixtureStatId) === rowId;
        const qty = Number(r.quantity ?? 1);
        const qtyCell = isEditing
          ? `<input type="number" class="inp-fixture-stat-qty" value="${escapeHtml(String(qty || 1))}" min="1" max="100" />`
          : escapeHtml(String(qty || 1));
        const editCell = isEditing
          ? `<button type="button" class="btn btn--primary btn--sm btn--icon btn-fixture-stat-save" data-stat-id="${escapeHtml(rowId)}" title="Save" aria-label="Save">&#128190;</button>
             <button type="button" class="btn btn--ghost btn--sm btn-fixture-stat-cancel">Cancel</button>`
          : `<button type="button" class="btn btn--primary btn--sm btn--icon btn-fixture-stat-edit" data-stat-id="${escapeHtml(rowId)}" title="Edit" aria-label="Edit">&#9998;</button>`;
        return `<tr data-stat-id="${escapeHtml(rowId)}">
      <td>${r.id}</td>
      <td>${escapeHtml(String(r.stat_type || ""))}</td>
      <td>${escapeHtml(String(r.player_name || ""))}</td>
      <td>${escapeHtml(String(r.club_name || ""))}</td>
      <td>${qtyCell}</td>
      <td>${editCell}</td>
      <td><button type="button" class="btn btn--danger btn--sm btn--icon btn-fixture-stat-del" data-stat-id="${escapeHtml(rowId)}" title="Delete" aria-label="Delete">&#128465;</button></td>
    </tr>`;
      },
    )
    .join("");
}

function wireFixtureStats() {
  const statTypeSelect = document.getElementById("fixture-stats-type");
  const statCountInput = document.getElementById("fixture-stats-count");
  const syncStatCountInput = () => {
    if (!(statTypeSelect instanceof HTMLSelectElement) || !(statCountInput instanceof HTMLInputElement)) return;
    const isCountable = statTypeSelect.value === "goal" || statTypeSelect.value === "assist";
    statCountInput.disabled = !isCountable;
    if (!isCountable) {
      statCountInput.value = "1";
    }
  };
  statTypeSelect?.addEventListener("change", syncStatCountInput);
  syncStatCountInput();

  document.getElementById("fixture-stats-fixture")?.addEventListener("change", () => {
    editingFixtureStatId = null;
    syncFixtureStatSelectors();
    void loadFixtureStats();
  });
  document.getElementById("btn-fixture-stat-load")?.addEventListener("click", () => {
    void loadFixtureStats();
  });
  document.getElementById("btn-fixture-stat-add")?.addEventListener("click", async () => {
    const fixtureId = document.getElementById("fixture-stats-fixture")?.value;
    const playerId = document.getElementById("fixture-stats-player")?.value;
    const statType = document.getElementById("fixture-stats-type")?.value;
    const quantityRaw = document.getElementById("fixture-stats-count")?.value;
    const quantity = Number(quantityRaw || 1);
    if (!fixtureId || !playerId || !statType) {
      showGlobalAlert("Select fixture, player, and stat type.");
      return;
    }
    if ((statType === "goal" || statType === "assist") && (!Number.isInteger(quantity) || quantity < 1 || quantity > 100)) {
      showGlobalAlert("No. of goal/assist must be a whole number from 1 to 100.");
      return;
    }
    const { ok, data, status } = await apiPostJson(
      `/api/v1/admin/fixtures/${fixtureId}/player-stats`,
      { player_id: Number(playerId), stat_type: statType, quantity: statType === "participant" ? 1 : quantity },
      { auth: true },
    );
    if (!ok) {
      showGlobalAlert(formatApiErrors(data, { status }));
      return;
    }
    editingFixtureStatId = null;
    showGlobalAlert("Fixture stat saved.", "success");
    await refreshClubs();
    await loadFixtureStats();
  });
  document.querySelector("#table-fixture-stats")?.addEventListener("click", async (e) => {
    const editBtn = /** @type {HTMLElement} */ (e.target).closest(".btn-fixture-stat-edit");
    if (editBtn) {
      const id = editBtn.getAttribute("data-stat-id");
      if (!id) return;
      editingFixtureStatId = id;
      renderFixtureStatsTable();
      return;
    }

    const cancelBtn = /** @type {HTMLElement} */ (e.target).closest(".btn-fixture-stat-cancel");
    if (cancelBtn) {
      editingFixtureStatId = null;
      renderFixtureStatsTable();
      return;
    }

    const saveBtn = /** @type {HTMLElement} */ (e.target).closest(".btn-fixture-stat-save");
    if (saveBtn) {
      const id = saveBtn.getAttribute("data-stat-id");
      if (!id) return;
      const tr = saveBtn.closest("tr[data-stat-id]");
      if (!tr) return;
      const nextQty = Number((/** @type {HTMLInputElement|null} */ (tr.querySelector(".inp-fixture-stat-qty"))?.value || "").trim());
      if (!Number.isInteger(nextQty) || nextQty < 1 || nextQty > 100) {
        showGlobalAlert("No. of goal/assist must be a whole number from 1 to 100.");
        return;
      }
      const { ok, data, status } = await apiPatchJson(
        `/api/v1/admin/fixture-player-stats/${id}`,
        { quantity: nextQty },
        { auth: true },
      );
      if (!ok) {
        showGlobalAlert(formatApiErrors(data, { status }));
        return;
      }
      editingFixtureStatId = null;
      showGlobalAlert("Fixture stat updated.", "success");
      await refreshClubs();
      await loadFixtureStats();
      return;
    }

    const btn = /** @type {HTMLElement} */ (e.target).closest(".btn-fixture-stat-del");
    if (!btn) return;
    const id = btn.getAttribute("data-stat-id");
    if (!id || !confirm("Delete this fixture stat entry?")) return;
    const { ok, data, status } = await apiDelete(`/api/v1/admin/fixture-player-stats/${id}`, { auth: true });
    if (!ok) {
      showGlobalAlert(formatApiErrors(data, { status }));
      return;
    }
    if (editingFixtureStatId !== null && String(editingFixtureStatId) === String(id)) {
      editingFixtureStatId = null;
    }
    showGlobalAlert("Fixture stat deleted.", "success");
    await refreshClubs();
    await loadFixtureStats();
  });
}

function wirePhotos() {
  document.querySelector('#form-photo-upload input[name="image"]')?.addEventListener("change", (e) => {
    const input = /** @type {HTMLInputElement} */ (e.target);
    const file = input.files?.[0];
    const wrap = document.getElementById("photo-upload-preview-wrap");
    const img = document.getElementById("photo-upload-preview");
    if (!wrap || !img) return;
    if (!file) {
      wrap.hidden = true;
      return;
    }
    const url = URL.createObjectURL(file);
    img.src = url;
    wrap.hidden = false;
  });

  document.getElementById("form-photo-upload")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = /** @type {HTMLFormElement} */ (e.target);
    const fd = new FormData(form);
    const { ok, data } = await apiPostForm("/api/v1/admin/photos", fd);
    if (!ok) showGlobalAlert(formatApiErrors(data));
    else {
      showGlobalAlert("Photo uploaded.", "success");
      form.reset();
      const wrap = document.getElementById("photo-upload-preview-wrap");
      if (wrap) wrap.hidden = true;
      await refreshAll();
    }
  });

  document.querySelector("#table-photos")?.addEventListener("click", async (e) => {
    const t = /** @type {HTMLElement} */ (e.target);
    const tr = t.closest("tr[data-photo-id]");
    if (!tr) return;
    const id = tr.getAttribute("data-photo-id");
    if (!id) return;
    if (t.classList.contains("btn-photo-del")) {
      if (!confirm("Delete photo?")) return;
      const { ok, data } = await apiDelete(`/api/v1/admin/photos/${id}`, { auth: true });
      if (!ok) showGlobalAlert(formatApiErrors(data));
      else {
        showGlobalAlert("Photo removed.", "success");
        await refreshAll();
      }
    }
    if (t.classList.contains("btn-photo-replace")) {
      const inp = tr.querySelector(".inp-photo-replace");
      const file = inp?.files?.[0];
      if (!file) {
        showGlobalAlert("Choose an image file.");
        return;
      }
      const fd = new FormData();
      fd.append("image", file);
      const { ok, data } = await apiPatchForm(`/api/v1/admin/photos/${id}`, fd);
      if (!ok) showGlobalAlert(formatApiErrors(data));
      else {
        showGlobalAlert("Photo updated.", "success");
        await refreshAll();
      }
    }
  });
}

function wireUsers() {
  document.getElementById("form-admin-create")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = /** @type {HTMLFormElement} */ (e.target);
    const fd = new FormData(form);
    const body = Object.fromEntries(fd.entries());
    const password = String(body.password || "");
    const passwordConfirmation = String(body.password_confirmation || "");
    const passwordIssue = getPasswordRequirementIssue(password);
    if (passwordIssue) {
      showGlobalAlert(passwordIssue);
      return;
    }
    if (password !== passwordConfirmation) {
      showGlobalAlert("Password confirmation does not match.");
      return;
    }
    const { ok, data } = await apiPostJson("/api/v1/admin/users", body, { auth: true });
    if (!ok) showGlobalAlert(formatApiErrors(data));
    else {
      showGlobalAlert("Admin user created.", "success");
      form.reset();
      await refreshUsers();
    }
  });

  const handleUserAction = async (e) => {
    const btn = /** @type {HTMLElement} */ (e.target).closest(".btn-user-edit, .btn-user-del");
    const saveBtn = /** @type {HTMLElement} */ (e.target).closest(".btn-user-save");
    const cancelBtn = /** @type {HTMLElement} */ (e.target).closest(".btn-user-cancel");
    if (cancelBtn) {
      editingUserKey = null;
      await refreshUsers();
      return;
    }
    if (saveBtn) {
      const id = saveBtn.getAttribute("data-user-id");
      if (!id) return;
      const tr = saveBtn.closest("tr");
      if (!tr) return;
      const name = tr.querySelector(".inp-user-name")?.value?.trim();
      const email = tr.querySelector(".inp-user-email")?.value?.trim();
      const student_staff_id = tr.querySelector(".inp-user-ssid")?.value?.trim();
      if (!name || !email || !student_staff_id) {
        showGlobalAlert("Name, email, and student/staff ID are required.");
        return;
      }
      const { ok, data, status } = await apiPatchJson(
        `/api/v1/admin/users/${id}`,
        { name, email, student_staff_id },
        { auth: true },
      );
      if (!ok) {
        showGlobalAlert(formatApiErrors(data, { status }));
        return;
      }
      editingUserKey = null;
      showGlobalAlert("User updated.", "success");
      await refreshUsers();
      return;
    }
    if (!btn) return;
    const id = btn.getAttribute("data-user-id");
    if (!id) return;
    if (btn.classList.contains("btn-user-del")) {
      if (!confirm("Delete this user?")) return;
      const { ok, data, status } = await apiDelete(`/api/v1/admin/users/${id}`, { auth: true });
      if (!ok) showGlobalAlert(formatApiErrors(data, { status }));
      else {
        showGlobalAlert("User deleted.", "success");
        await refreshUsers();
      }
      return;
    }
    editingUserKey = btn.getAttribute("data-user-key");
    await refreshUsers();
  };
  document.querySelector("#table-users-admin")?.addEventListener("click", handleUserAction);
  document.querySelector("#table-users-client")?.addEventListener("click", handleUserAction);
}

async function showApp(user) {
  currentUser = user;
  const login = document.getElementById("admin-login");
  if (login) {
    login.style.display = "none";
  }
  const app = document.getElementById("admin-app");
  if (!app) return;
  app.classList.add("is-visible");
  const userLabel = document.getElementById("admin-user-label");
  if (userLabel) userLabel.textContent = `${user.name} (${user.role})`;
  const navUsers = document.getElementById("nav-users");
  if (navUsers) navUsers.hidden = user.role !== "default_admin";
  try {
    await refreshAll();
  } catch (err) {
    console.error(err);
    showGlobalAlert("Dashboard loaded but some data failed to refresh. Check the API URL and console.", "error");
  }
}

function showLogin() {
  clearToken();
  currentUser = null;
  if (isDashboardOnlyMode()) {
    window.location.replace(new URL("index.html", window.location.href).toString());
    return;
  }
  const login = document.getElementById("admin-login");
  const app = document.getElementById("admin-app");
  if (login) login.style.display = "";
  if (app) app.classList.remove("is-visible");
}

/** Remove credentials accidentally submitted as GET query params (default form method is GET). */
function stripLoginQueryFromUrl() {
  if (!window.location.search) return;
  const sp = new URLSearchParams(window.location.search);
  if (!sp.has("email") && !sp.has("password")) return;
  const path = window.location.pathname + window.location.hash;
  window.history.replaceState({}, "", path || "/");
}

async function runAdminLogin() {
  const form = document.getElementById("form-login");
  const alert = document.getElementById("login-alert");
  const submitBtn = document.getElementById("btn-admin-login");
  if (!form) return;
  if (submitBtn) submitBtn.setAttribute("disabled", "disabled");
  if (alert) {
    alert.textContent = "Signing in...";
    alert.hidden = false;
  }
  const fd = new FormData(/** @type {HTMLFormElement} */ (form));
  const body = {
    email: fd.get("email"),
    password: fd.get("password"),
    portal: "admin",
  };
  try {
    const { ok, data, status } = await apiPostJson("/api/v1/auth/login", body);
    if (!ok) {
      if (alert) {
        alert.textContent = formatApiErrors(data, { status });
        alert.hidden = false;
      }
      if (submitBtn) submitBtn.removeAttribute("disabled");
      return;
    }
    if (alert) alert.hidden = true;
    const token = /** @type {{ token?: string }} */ (data).token;
    if (!token) {
      if (alert) {
        alert.textContent = "No token returned from the server.";
        alert.hidden = false;
      }
      if (submitBtn) submitBtn.removeAttribute("disabled");
      return;
    }
    setToken(token);

    const loginUserCandidate =
      data && typeof data.user === "object"
        ? /** @type {{ id?: number; name?: string; email?: string; role?: string }} */ (data.user)
        : null;
    const loginRole = String(loginUserCandidate?.role || "");
    if (loginRole === "client") {
      window.location.replace(resolvePublicHomeUrl());
      return;
    }
    if (isAdminRole(loginRole)) {
      await showApp(
        /** @type {{ id: number; name: string; email: string; role: string }} */ ({
          id: Number(loginUserCandidate?.id || 0),
          name: String(loginUserCandidate?.name || "Admin"),
          email: String(loginUserCandidate?.email || ""),
          role: loginRole,
        }),
      );
      return;
    }

    const user = await loadMe();
    if (!user) {
      showLogin();
      if (alert) {
        alert.textContent = "Signed in, but admin profile loading failed. Please retry once.";
        alert.hidden = false;
      }
      if (submitBtn) submitBtn.removeAttribute("disabled");
      return;
    }
    if (String(user.role || "") === "client") {
      window.location.replace(resolvePublicHomeUrl());
      return;
    }
    if (isAdminRole(String(user.role || ""))) {
      await showApp(user);
      return;
    }
    showLogin();
    if (alert) {
      alert.textContent = "This account role is not allowed.";
      alert.hidden = false;
    }
    if (submitBtn) submitBtn.removeAttribute("disabled");
  } catch (err) {
    console.error(err);
    if (alert) {
      alert.textContent = `Cannot reach API at ${API_BASE_URL}. Is Laravel running (e.g. php artisan serve)? Details in console.`;
      alert.hidden = false;
    }
    if (submitBtn) submitBtn.removeAttribute("disabled");
  }
}

if (typeof window !== "undefined") {
  window.__versityAdminLogin = () => {
    void runAdminLogin();
  };
}

async function boot() {
  if (typeof window !== "undefined") {
    window.__VERSITY_ADMIN_BOOTED = true;
  }
  stripLoginQueryFromUrl();
  if (isDashboardOnlyMode() && !getToken()) {
    window.location.replace(new URL("index.html", window.location.href).toString());
    return;
  }

  document.getElementById("btn-admin-login")?.addEventListener("click", () => {
    void runAdminLogin();
  });
  document.getElementById("form-login")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void runAdminLogin();
    }
  });
  initPasswordToggles();

  wireNav();
  wireStandingsPanel();
  wireCertificatesPanel();
  wireLeagueTable();
  wireLeagueCreate();
  wireClubTable();
  wirePlayers();
  wireFixtures();
  wireFixtureStats();
  wirePhotos();
  wireUsers();

  if (!getToken()) return;
  const user = await loadMe();
  if (user) await showApp(user);
}

boot();
