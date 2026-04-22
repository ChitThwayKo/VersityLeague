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
  setToken,
} from "../../js/auth.js";

/** @type {{ id: number; name: string; season: string; status: string }[]} */
let leaguesCache = [];
/** @type {Record<string, unknown>[]} */
let clubsCache = [];
/** @type {{ name: string; role: string } | null} */
let currentUser = null;

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

async function loadMe() {
  const { ok, data } = await apiGet("/api/v1/auth/me", { auth: true });
  if (!ok || !data.user || !isAdminRole(/** @type {{role:string}} */ (data.user).role)) {
    return null;
  }
  return /** @type {{ id: number; name: string; email: string; role: string }} */ (data.user);
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
        )} (${escapeHtml(l.season)})</option>`,
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

async function refreshLeagues() {
  const { ok, data } = await apiGet("/api/v1/admin/leagues", { auth: true });
  if (!ok) {
    showGlobalAlert(formatApiErrors(data));
    return;
  }
  leaguesCache = /** @type {typeof leaguesCache} */ (data.leagues || []);
  const tbody = document.querySelector("#table-leagues tbody");
  if (!tbody) return;
  tbody.innerHTML = leaguesCache
    .map(
      (l) => `
      <tr data-league-id="${l.id}">
        <td>${l.id}</td>
        <td><input type="text" class="inp-league-name" value="${escapeHtml(l.name)}" /></td>
        <td><input type="text" class="inp-league-season" value="${escapeHtml(l.season)}" /></td>
        <td>
          <select class="inp-league-status">
            <option value="inactive" ${l.status === "inactive" ? "selected" : ""}>inactive</option>
            <option value="active" ${l.status === "active" ? "selected" : ""}>active</option>
          </select>
        </td>
        <td>
          <button type="button" class="btn btn--primary btn--sm btn-league-save">Save</button>
          <button type="button" class="btn btn--danger btn--sm btn-league-del">Delete</button>
        </td>
      </tr>`,
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

  const leagueOpts = `<option value="">Select league…</option>` + leagueOptionsHtml("");

  tbody.innerHTML = clubsCache
    .map((c) => {
      const manager = c.manager && typeof c.manager === "object" ? /** @type {{email:string}} */ (c.manager).email : "—";
      const pending =
        c.status === "pending"
          ? `<select class="club-pick-league" data-club="${c.id}">${leagueOpts}</select>
             <button type="button" class="btn btn--primary btn--sm btn-club-approve" data-club="${c.id}">Approve</button>
             <button type="button" class="btn btn--danger btn--sm btn-club-reject" data-club="${c.id}">Reject</button>`
          : `<span class="admin-muted">${escapeHtml(String(c.status))}</span>`;
      const photo =
        typeof c.club_photo_url === "string"
          ? `<img class="thumb" src="${escapeHtml(c.club_photo_url)}" alt="" />`
          : "";
      return `<tr>
        <td>${c.id}</td>
        <td>${photo} ${escapeHtml(String(c.club_name))}</td>
        <td>${escapeHtml(String(c.status))}</td>
        <td>${escapeHtml(manager)}</td>
        <td>${c.players_count ?? "—"}</td>
        <td>${pending}</td>
      </tr>`;
    })
    .join("");

  const sel = document.getElementById("player-club-select");
  if (sel) {
    sel.innerHTML = clubsCache
      .map((c) => `<option value="${c.id}">${escapeHtml(String(c.club_name))} (${escapeHtml(String(c.status))})</option>`)
      .join("");
  }

  populateFixtureClubSelectors();
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

async function refreshFixtures() {
  const { ok, data } = await apiGet("/api/v1/admin/fixtures", { auth: true });
  if (!ok) {
    showGlobalAlert(formatApiErrors(data));
    return;
  }
  const fixtures = /** @type {Record<string, unknown>[]} */ (data.fixtures || []);
  const tbody = document.querySelector("#table-fixtures tbody");
  if (!tbody) return;
  tbody.innerHTML = fixtures
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
        <td><button type="button" class="btn btn--danger btn--sm btn-fix-del" data-id="${f.id}">Delete</button></td>
      </tr>`;
    })
    .join("");
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
        <td><img class="thumb" src="${escapeHtml(String(p.image_url))}" alt="" /></td>
        <td>
          <input type="file" class="inp-photo-replace" accept="image/*" />
          <button type="button" class="btn btn--primary btn--sm btn-photo-replace">Replace</button>
        </td>
        <td><button type="button" class="btn btn--danger btn--sm btn-photo-del">Delete</button></td>
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
  const users = /** @type {Record<string, unknown>[]} */ (data.users || []);
  const tbody = document.querySelector("#table-users tbody");
  if (!tbody) return;
  tbody.innerHTML = users
    .map(
      (u) => `<tr>
      <td>${u.id}</td>
      <td>${escapeHtml(String(u.name))}</td>
      <td>${escapeHtml(String(u.email))}</td>
      <td>${escapeHtml(String(u.role))}</td>
    </tr>`,
    )
    .join("");
}

async function refreshOverview() {
  const el = document.getElementById("overview-stats");
  if (!el) return;
  const [lg, cl, fx, ph] = await Promise.all([
    apiGet("/api/v1/admin/leagues", { auth: true }),
    apiGet("/api/v1/admin/clubs", { auth: true }),
    apiGet("/api/v1/admin/fixtures", { auth: true }),
    apiGet("/api/v1/admin/photos", { auth: true }),
  ]);
  const nL = lg.ok && lg.data.leagues ? /** @type {unknown[]} */ (lg.data.leagues).length : "—";
  const nC = cl.ok && cl.data.clubs ? /** @type {unknown[]} */ (cl.data.clubs).length : "—";
  const nF = fx.ok && fx.data.fixtures ? /** @type {unknown[]} */ (fx.data.fixtures).length : "—";
  const nP = ph.ok && ph.data.photos ? /** @type {unknown[]} */ (ph.data.photos).length : "—";
  el.innerHTML = `<ul style="margin:0;padding-left:1.2rem">
    <li>Leagues: <strong>${nL}</strong></li>
    <li>Clubs: <strong>${nC}</strong></li>
    <li>Fixtures: <strong>${nF}</strong></li>
    <li>Photos: <strong>${nP}</strong> / 5 max</li>
  </ul>`;
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
  await refreshOverview();
}

function wireNav() {
  document.getElementById("admin-nav")?.addEventListener("click", (e) => {
    const btn = /** @type {HTMLElement} */ (e.target).closest("button[data-panel]");
    if (!btn) return;
    setPanel(btn.dataset.panel || "overview");
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
      if (!confirm("Delete this league?")) return;
      const { ok, data } = await apiDelete(`/api/v1/admin/leagues/${id}`, { auth: true });
      if (!ok) showGlobalAlert(formatApiErrors(data));
      else {
        showGlobalAlert("League deleted.", "success");
        await refreshAll();
      }
      return;
    }
    if (t.classList.contains("btn-league-save")) {
      const name = tr.querySelector(".inp-league-name")?.value;
      const season = tr.querySelector(".inp-league-season")?.value;
      const status = tr.querySelector(".inp-league-status")?.value;
      const { ok, data } = await apiPatchJson(
        `/api/v1/admin/leagues/${id}`,
        { name, season, status },
        { auth: true },
      );
      if (!ok) showGlobalAlert(formatApiErrors(data));
      else {
        showGlobalAlert("League updated.", "success");
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
    const body = {
      name: fd.get("name"),
      season: fd.get("season"),
      status: fd.get("status"),
    };
    const { ok, data } = await apiPostJson("/api/v1/admin/leagues", body, { auth: true });
    if (!ok) showGlobalAlert(formatApiErrors(data));
    else {
      showGlobalAlert("League created.", "success");
      form.reset();
      await refreshAll();
    }
  });
}

function wireClubTable() {
  document.getElementById("club-filter-status")?.addEventListener("change", () => refreshClubs());
  document.getElementById("btn-clubs-refresh")?.addEventListener("click", () => refreshClubs());

  document.querySelector("#table-clubs")?.addEventListener("click", async (e) => {
    const t = /** @type {HTMLElement} */ (e.target);
    const id = t.getAttribute("data-club");
    if (!id) return;
    if (t.classList.contains("btn-club-approve")) {
      const sel = document.querySelector(`.club-pick-league[data-club="${id}"]`);
      const leagueId = sel?.value;
      if (!leagueId) {
        showGlobalAlert("Choose a league before approving.");
        return;
      }
      const { ok, data } = await apiPatchJson(`/api/v1/admin/clubs/${id}`, { status: "approved", league_id: Number(leagueId) }, { auth: true });
      if (!ok) showGlobalAlert(formatApiErrors(data));
      else {
        showGlobalAlert("Club approved.", "success");
        await refreshAll();
      }
    }
    if (t.classList.contains("btn-club-reject")) {
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
  document.getElementById("btn-players-load")?.addEventListener("click", async () => {
    const clubId = document.getElementById("player-club-select")?.value;
    const hidden = document.getElementById("player-form-club-id");
    if (hidden) hidden.value = clubId || "";
    if (!clubId) return;
    const { ok, data } = await apiGet(`/api/v1/admin/clubs/${clubId}/players`, { auth: true });
    const tbody = document.querySelector("#table-players tbody");
    if (!tbody) return;
    if (!ok) {
      tbody.innerHTML = "";
      showGlobalAlert(formatApiErrors(data));
      return;
    }
    const players = /** @type {Record<string, unknown>[]} */ (data.players || []);
    tbody.innerHTML = players
      .map(
        (p) => `<tr>
        <td>${p.id}</td>
        <td>${escapeHtml(String(p.full_name))}</td>
        <td>${escapeHtml(String(p.student_staff_id))}</td>
        <td>${escapeHtml(String(p.position))}</td>
        <td><button type="button" class="btn btn--danger btn--sm btn-player-del" data-id="${p.id}">Delete</button></td>
      </tr>`,
      )
      .join("");
  });

  document.getElementById("form-player-create")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = /** @type {HTMLFormElement} */ (e.target);
    const clubId = document.getElementById("player-form-club-id")?.value;
    if (!clubId) {
      showGlobalAlert("Load a club first.");
      return;
    }
    const fd = new FormData(form);
    const { ok, data } = await apiPostForm(`/api/v1/admin/clubs/${clubId}/players`, fd);
    if (!ok) showGlobalAlert(formatApiErrors(data));
    else {
      showGlobalAlert("Player added.", "success");
      form.querySelector('input[name="full_name"]')?.value = "";
      form.querySelector('input[name="student_staff_id"]')?.value = "";
      form.querySelector('input[name="position"]')?.value = "";
      form.querySelector('input[name="jersey_number"]')?.value = "";
      form.querySelector('input[name="player_photo"]')?.value = "";
      document.getElementById("btn-players-load")?.click();
    }
  });

  document.querySelector("#table-players")?.addEventListener("click", async (e) => {
    const t = /** @type {HTMLElement} */ (e.target);
    if (!t.classList.contains("btn-player-del")) return;
    const id = t.getAttribute("data-id");
    if (!id || !confirm("Delete this player?")) return;
    const { ok, data } = await apiDelete(`/api/v1/admin/players/${id}`, { auth: true });
    if (!ok) showGlobalAlert(formatApiErrors(data));
    else {
      showGlobalAlert("Player removed.", "success");
      document.getElementById("btn-players-load")?.click();
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

function wirePhotos() {
  document.getElementById("form-photo-upload")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = /** @type {HTMLFormElement} */ (e.target);
    const fd = new FormData(form);
    const { ok, data } = await apiPostForm("/api/v1/admin/photos", fd);
    if (!ok) showGlobalAlert(formatApiErrors(data));
    else {
      showGlobalAlert("Photo uploaded.", "success");
      form.reset();
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
    const { ok, data } = await apiPostJson("/api/v1/admin/users", body, { auth: true });
    if (!ok) showGlobalAlert(formatApiErrors(data));
    else {
      showGlobalAlert("Admin user created.", "success");
      form.reset();
      await refreshUsers();
    }
  });
}

async function showApp(user) {
  currentUser = user;
  document.getElementById("admin-login").style.display = "none";
  const app = document.getElementById("admin-app");
  app.classList.add("is-visible");
  document.getElementById("admin-user-label").textContent = `${user.name} (${user.role})`;
  const navUsers = document.getElementById("nav-users");
  if (navUsers) navUsers.hidden = user.role !== "default_admin";
  await refreshAll();
}

function showLogin() {
  clearToken();
  currentUser = null;
  document.getElementById("admin-login").style.display = "";
  document.getElementById("admin-app").classList.remove("is-visible");
}

async function boot() {
  wireNav();
  wireLeagueTable();
  wireLeagueCreate();
  wireClubTable();
  wirePlayers();
  wireFixtures();
  wirePhotos();
  wireUsers();

  document.getElementById("form-login")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = /** @type {HTMLFormElement} */ (e.target);
    const fd = new FormData(form);
    const body = {
      email: fd.get("email"),
      password: fd.get("password"),
      portal: "admin",
    };
    const alert = document.getElementById("login-alert");
    const { ok, data } = await apiPostJson("/api/v1/auth/login", body);
    if (!ok) {
      if (alert) {
        alert.textContent = formatApiErrors(data);
        alert.hidden = false;
      }
      return;
    }
    if (alert) alert.hidden = true;
    setToken(/** @type {{token:string}} */ (data).token);
    const user = await loadMe();
    if (!user) {
      showLogin();
      if (alert) {
        alert.textContent = "This account is not an administrator.";
        alert.hidden = false;
      }
      return;
    }
    await showApp(user);
  });

  document.getElementById("btn-logout")?.addEventListener("click", async () => {
    await apiPostJson("/api/v1/auth/logout", {}, { auth: true });
    showLogin();
    setPanel("overview");
  });

  if (!getToken()) return;
  const user = await loadMe();
  if (user) await showApp(user);
}

boot();
