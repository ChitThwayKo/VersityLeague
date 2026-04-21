import { createApiClient, setAuthToken, getAuthToken } from "./api.js";

const output = document.getElementById("api-output");
const baseInput = document.getElementById("api-base-input");

function show(data) {
  output.textContent =
    typeof data === "string" ? data : JSON.stringify(data, null, 2);
}

function client() {
  return createApiClient(baseInput.value.trim());
}

function recaptchaSiteKey() {
  return (
    document
      .querySelector('meta[name="recaptcha-site-key"]')
      ?.getAttribute("content")
      ?.trim() || ""
  );
}

let recaptchaScriptPromise = null;
let widgetSignin = null;
let widgetSignup = null;

function loadRecaptchaScript() {
  if (window.grecaptcha) {
    return Promise.resolve();
  }
  if (recaptchaScriptPromise) {
    return recaptchaScriptPromise;
  }
  recaptchaScriptPromise = new Promise((resolve, reject) => {
    const cb = `__grecaptcha_${Date.now()}`;
    window[cb] = () => {
      resolve();
      delete window[cb];
    };
    const s = document.createElement("script");
    s.src = `https://www.google.com/recaptcha/api.js?onload=${cb}&render=explicit`;
    s.async = true;
    s.defer = true;
    s.onerror = () => reject(new Error("reCAPTCHA script failed to load"));
    document.head.appendChild(s);
  });
  return recaptchaScriptPromise;
}

async function ensureRecaptchaRendered(which) {
  const key = recaptchaSiteKey();
  if (!key) {
    return null;
  }
  await loadRecaptchaScript();
  if (which === "signin" && widgetSignin == null) {
    widgetSignin = window.grecaptcha.render("recaptcha-signin", {
      sitekey: key,
      theme: "light",
    });
  }
  if (which === "signup" && widgetSignup == null) {
    widgetSignup = window.grecaptcha.render("recaptcha-signup", {
      sitekey: key,
      theme: "light",
    });
  }
  return which === "signin" ? widgetSignin : widgetSignup;
}

function recaptchaTokenForWidget(which) {
  const key = recaptchaSiteKey();
  if (!key) {
    return "local-dev-placeholder";
  }
  const id = which === "signin" ? widgetSignin : widgetSignup;
  if (id == null) {
    return null;
  }
  const response = window.grecaptcha.getResponse(id);
  return response || null;
}

function resetWidget(which) {
  const id = which === "signin" ? widgetSignin : widgetSignup;
  if (id != null && window.grecaptcha) {
    try {
      window.grecaptcha.reset(id);
    } catch {
      /* ignore */
    }
  }
}

// ——— API demo buttons ———
document.getElementById("btn-health").addEventListener("click", async () => {
  try {
    show(await client().health());
  } catch (e) {
    show(`Error: ${e.message}\n${e.body != null ? JSON.stringify(e.body, null, 2) : ""}`);
  }
});

document.getElementById("btn-ping").addEventListener("click", async () => {
  try {
    show(await client().ping());
  } catch (e) {
    show(`Error: ${e.message}\n${e.body != null ? JSON.stringify(e.body, null, 2) : ""}`);
  }
});

document.getElementById("btn-me").addEventListener("click", async () => {
  try {
    show(await client().me());
  } catch (e) {
    show(`Error: ${e.message}\n${e.body != null ? JSON.stringify(e.body, null, 2) : ""}`);
  }
});

// ——— Session UI ———
const btnLogout = document.getElementById("btn-logout");
const btnOpenSignin = document.getElementById("btn-open-signin");
const btnOpenSignup = document.getElementById("btn-open-signup");
const sessionLabel = document.getElementById("session-label");

/** @type {null | { id: number, username: string, name: string, email: string, role: string }} */
let currentUser = null;

function setSession(user) {
  currentUser = user;
  if (user) {
    btnLogout.classList.remove("hidden");
    btnOpenSignin.classList.add("hidden");
    btnOpenSignup.classList.add("hidden");
    sessionLabel.classList.remove("hidden");
    sessionLabel.textContent = `${user.name} (${user.username}) · ${user.role}`;
  } else {
    btnLogout.classList.add("hidden");
    btnOpenSignin.classList.remove("hidden");
    btnOpenSignup.classList.remove("hidden");
    sessionLabel.classList.add("hidden");
    sessionLabel.textContent = "";
  }
  updateAdminPanel(user);
  loadSeasonCurrent();
}

async function refreshSession() {
  if (!getAuthToken()) {
    setSession(null);
    return;
  }
  try {
    const data = await client().me();
    setSession(data.user);
  } catch {
    setAuthToken(null);
    setSession(null);
  }
}

btnLogout.addEventListener("click", async () => {
  try {
    await client().logout();
  } catch {
    /* still clear local session */
  }
  setAuthToken(null);
  setSession(null);
  show("Signed out.");
});

// ——— Season + registration gating + admin season form ———

function isoToDatetimeLocal(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function datetimeLocalToIso(localVal) {
  if (!localVal) return null;
  const d = new Date(localVal);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function formatLocaleDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

async function loadSeasonCurrent() {
  const msgEl = document.getElementById("gating-message");
  if (!msgEl) return;
  try {
    const data = await client().seasonsCurrent();
    renderRegistrationGating(data);
  } catch (e) {
    msgEl.textContent = `Could not load season: ${e.message}`;
  }
}

function renderRegistrationGating(data) {
  const { active_season, gating } = data;
  const msgEl = document.getElementById("gating-message");
  const signHint = document.getElementById("gating-signin-hint");
  const btn = document.getElementById("btn-register-cta");
  const note = document.getElementById("register-cta-note");
  const labelLine = document.getElementById("season-label-line");
  if (!msgEl || !labelLine) return;

  labelLine.textContent = active_season
    ? `Active season: ${active_season.label}`
    : "No active season configured.";

  const messages = {
    no_active_season:
      "There is no active season yet. Please check back later.",
    league_started:
      "The season has already started. Club registration is closed until a new season is announced.",
    before_registration_window: `Registration opens on ${formatLocaleDateTime(active_season?.registration_opens_at)}.`,
    registration_window_closed:
      "The registration window for this season has closed.",
    registration_open:
      "Registration is open. Sign in to register your club for this season.",
  };

  msgEl.textContent = messages[gating.phase] || JSON.stringify(gating);

  if (signHint) {
    signHint.classList.add("hidden");
    signHint.textContent = "";
    if (gating.registration_allowed && !currentUser) {
      signHint.textContent =
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nunc nec lorem quis tortor imperdiet tincidunt.";
      signHint.classList.remove("hidden");
    }
  }

  if (btn) {
    btn.classList.toggle("hidden", !gating.registration_allowed);
    btn.disabled = !gating.registration_allowed || !currentUser;
    btn.onclick = () => {
      window.alert(
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia curae."
      );
    };
  }

  if (note) {
    note.textContent =
      gating.registration_allowed && currentUser
        ? "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Maecenas sed diam eget risus varius blandit."
        : "";
  }
}

function updateAdminPanel(user) {
  const ok =
    user && (user.role === "admin" || user.role === "main_admin");
  document
    .getElementById("admin-season-panel")
    ?.classList.toggle("hidden", !ok);
  document
    .getElementById("admin-clubs-panel")
    ?.classList.toggle("hidden", !ok);
  document
    .getElementById("admin-fixtures-panel")
    ?.classList.toggle("hidden", !ok);
  document
    .getElementById("admin-results-panel")
    ?.classList.toggle("hidden", !ok);
  if (ok) {
    loadAdminSeasonForm();
    refreshAdminClubsUi();
    refreshAdminFixturesUi();
    refreshAdminResultsUi();
  }
}

async function loadAdminSeasonForm() {
  const panel = document.getElementById("admin-season-panel");
  if (!panel || panel.classList.contains("hidden")) return;
  try {
    const { seasons } = await client().adminSeasonsList();
    const active = seasons.find((s) => s.is_active) || seasons[0];
    const idEl = document.getElementById("admin-season-id");
    if (!active) {
      if (idEl) idEl.value = "";
      document.getElementById("admin-season-label").value = "";
      document.getElementById("admin-season-opens").value = "";
      document.getElementById("admin-season-closes").value = "";
      document.getElementById("admin-season-started").value = "";
      document.getElementById("admin-season-active").checked = true;
      return;
    }
    if (idEl) idEl.value = String(active.id);
    document.getElementById("admin-season-label").value = active.label;
    document.getElementById("admin-season-opens").value = isoToDatetimeLocal(
      active.registration_opens_at
    );
    document.getElementById("admin-season-closes").value = isoToDatetimeLocal(
      active.registration_closes_at
    );
    document.getElementById("admin-season-started").value = isoToDatetimeLocal(
      active.started_at
    );
    document.getElementById("admin-season-active").checked = active.is_active;
  } catch (e) {
    const err = document.getElementById("admin-season-error");
    if (err) {
      err.textContent = e.body?.message || e.message;
      err.classList.remove("hidden");
    }
  }
}

const formAdminSeason = document.getElementById("form-admin-season");
if (formAdminSeason) {
  formAdminSeason.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const errEl = document.getElementById("admin-season-error");
    errEl.classList.add("hidden");
    errEl.textContent = "";
    const id = document.getElementById("admin-season-id").value;
    const opens = document.getElementById("admin-season-opens").value;
    const closes = document.getElementById("admin-season-closes").value;
    const started = document.getElementById("admin-season-started").value;
    const payload = {
      label: document.getElementById("admin-season-label").value.trim(),
      registration_opens_at: opens,
      registration_closes_at: closes,
      started_at: started || null,
      is_active: document.getElementById("admin-season-active").checked,
    };
    try {
      if (id) {
        await client().adminSeasonUpdate(id, payload);
      } else {
        await client().adminSeasonStore(payload);
      }
      await loadAdminSeasonForm();
      await loadSeasonCurrent();
      await loadPublicFixtures();
      await loadPublicStandings();
      show({ saved: true, season: payload });
    } catch (e) {
      errEl.textContent =
        e.body?.message ||
        (e.body?.errors && JSON.stringify(e.body.errors)) ||
        e.message;
      errEl.classList.remove("hidden");
    }
  });
}

const btnAdminNew = document.getElementById("admin-season-new");
if (btnAdminNew) {
  btnAdminNew.addEventListener("click", () => {
    document.getElementById("admin-season-id").value = "";
    document.getElementById("admin-season-label").value = "";
    document.getElementById("admin-season-opens").value = "";
    document.getElementById("admin-season-closes").value = "";
    document.getElementById("admin-season-started").value = "";
    document.getElementById("admin-season-active").checked = true;
    document.getElementById("admin-season-label").focus();
  });
}

document.getElementById("btn-season-current")?.addEventListener("click", async () => {
  try {
    show(await client().seasonsCurrent());
  } catch (e) {
    show(`Error: ${e.message}\n${e.body != null ? JSON.stringify(e.body, null, 2) : ""}`);
  }
});

let baseDebounce;
baseInput.addEventListener("input", () => {
  clearTimeout(baseDebounce);
  baseDebounce = setTimeout(() => {
    loadSeasonCurrent();
    loadPublicClubs();
    loadPublicFixtures();
    loadPublicStandings();
    if (currentUser && (currentUser.role === "admin" || currentUser.role === "main_admin")) {
      loadAdminSeasonForm();
      refreshAdminClubsUi();
      refreshAdminFixturesUi();
      refreshAdminResultsUi();
    }
    refreshSession();
  }, 400);
});

// ——— Modals ———
function openModal(id) {
  closeClubModal();
  const el = document.getElementById(id);
  el.hidden = false;
  document.body.style.overflow = "hidden";
  const key = recaptchaSiteKey();
  if (key && id === "modal-signin") {
    ensureRecaptchaRendered("signin");
  }
  if (key && id === "modal-signup") {
    ensureRecaptchaRendered("signup");
  }
}

function closeModals() {
  document.querySelectorAll("#modal-signin, #modal-signup").forEach((el) => {
    el.hidden = true;
  });
  document.body.style.overflow = "";
  resetWidget("signin");
  resetWidget("signup");
}

document.querySelectorAll("[data-open-modal]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const which = btn.getAttribute("data-open-modal");
    if (which === "signin") {
      openModal("modal-signin");
    }
    if (which === "signup") {
      openModal("modal-signup");
    }
  });
});

document.querySelectorAll("[data-close-modal]").forEach((btn) => {
  btn.addEventListener("click", closeModals);
});

document.querySelectorAll("#modal-signin, #modal-signup").forEach((backdrop) => {
  backdrop.addEventListener("click", (ev) => {
    if (ev.target === backdrop) {
      closeModals();
    }
  });
});

// ——— Sign in ———
const formSignin = document.getElementById("form-signin");
const signinError = document.getElementById("signin-error");

formSignin.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  signinError.classList.add("hidden");
  signinError.textContent = "";
  const fd = new FormData(formSignin);
  const intent = fd.get("intent");

  let recaptcha_token;
  if (recaptchaSiteKey()) {
    await ensureRecaptchaRendered("signin");
    recaptcha_token = recaptchaTokenForWidget("signin");
    if (!recaptcha_token) {
      signinError.textContent = "Please complete the reCAPTCHA checkbox.";
      signinError.classList.remove("hidden");
      return;
    }
  } else {
    recaptcha_token = "local-dev-placeholder";
  }

  try {
    const data = await client().login({
      username: fd.get("username"),
      password: fd.get("password"),
      intent,
      recaptcha_token,
    });
    setAuthToken(data.token);
    setSession(data.user);
    closeModals();
    show(data);
    formSignin.reset();
  } catch (e) {
    const msg =
      e.body?.message ||
      (e.body?.errors && JSON.stringify(e.body.errors)) ||
      e.message;
    signinError.textContent = msg;
    signinError.classList.remove("hidden");
    resetWidget("signin");
  }
});

// ——— Sign up ———
const formSignup = document.getElementById("form-signup");
const signupError = document.getElementById("signup-error");

formSignup.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  signupError.classList.add("hidden");
  signupError.textContent = "";
  const fd = new FormData(formSignup);

  let recaptcha_token;
  if (recaptchaSiteKey()) {
    await ensureRecaptchaRendered("signup");
    recaptcha_token = recaptchaTokenForWidget("signup");
    if (!recaptcha_token) {
      signupError.textContent = "Please complete the reCAPTCHA checkbox.";
      signupError.classList.remove("hidden");
      return;
    }
  } else {
    recaptcha_token = "local-dev-placeholder";
  }

  try {
    const data = await client().register({
      username: fd.get("username"),
      name: fd.get("name"),
      email: fd.get("email"),
      password: fd.get("password"),
      password_confirmation: fd.get("password_confirmation"),
      recaptcha_token,
    });
    setAuthToken(data.token);
    setSession(data.user);
    closeModals();
    show(data);
    formSignup.reset();
    resetWidget("signup");
  } catch (e) {
    const msg =
      e.body?.message ||
      (e.body?.errors && JSON.stringify(e.body.errors)) ||
      e.message;
    signupError.textContent = msg;
    signupError.classList.remove("hidden");
    resetWidget("signup");
  }
});

// ——— Public fixtures ———
function renderFixtureTeamSnippet(team) {
  const wrap = document.createElement("div");
  wrap.className = "fixture-team";
  if (team?.logo_url) {
    const img = document.createElement("img");
    img.src = team.logo_url;
    img.alt = "";
    img.className = "fixture-team-logo";
    img.loading = "lazy";
    wrap.appendChild(img);
  } else {
    const ph = document.createElement("div");
    ph.className = "fixture-team-placeholder";
    ph.textContent = "⚽";
    wrap.appendChild(ph);
  }
  const nm = document.createElement("span");
  nm.className = "fixture-team-name";
  nm.textContent = team?.name || "—";
  wrap.appendChild(nm);
  return wrap;
}

/** @param {Record<string, unknown>} f */
function renderFixtureCard(f) {
  const card = document.createElement("article");
  card.className = "fixture-card";
  const head = document.createElement("div");
  head.className = "fixture-card-head";
  const st = document.createElement("span");
  st.className = `fixture-status fixture-status-${String(f.status)}`;
  st.textContent = String(f.status);
  head.appendChild(st);
  if (f.match_number) {
    const mn = document.createElement("span");
    mn.className = "fixture-match-no";
    mn.textContent = `Match ${f.match_number}`;
    head.appendChild(mn);
  }
  card.appendChild(head);
  const row = document.createElement("div");
  row.className = "fixture-teams";
  row.appendChild(renderFixtureTeamSnippet(f.home));
  const vs = document.createElement("span");
  vs.className = "fixture-vs";
  vs.textContent = "vs";
  row.appendChild(vs);
  row.appendChild(renderFixtureTeamSnippet(f.away));
  card.appendChild(row);
  const when = document.createElement("p");
  when.className = "fixture-when";
  when.textContent = f.kickoff_at ? formatLocaleDateTime(f.kickoff_at) : "—";
  card.appendChild(when);
  const venue = document.createElement("p");
  venue.className = "fixture-venue";
  const loc = f.venue_location ? `${f.venue_name} · ${f.venue_location}` : f.venue_name;
  venue.textContent = loc || "—";
  card.appendChild(venue);
  const comp = document.createElement("p");
  comp.className = "fixture-comp";
  const bits = [f.competition_name, f.round_label].filter(Boolean);
  comp.textContent = bits.join(" · ") || "—";
  card.appendChild(comp);
  return card;
}

async function loadPublicFixtures() {
  const list = document.getElementById("fixtures-list");
  const status = document.getElementById("fixtures-status");
  const seasonLabel = document.getElementById("fixtures-season-label");
  if (!list || !status) return;
  const filterEl = document.getElementById("fixtures-filter");
  const filter = filterEl?.value || "all";
  const params = {};
  if (filter === "upcoming") {
    params.upcoming = "1";
  } else if (filter !== "all") {
    params.status = filter;
  }
  try {
    const data = await client().fixturesList(params);
    list.replaceChildren();
    if (!data.season) {
      if (seasonLabel) {
        seasonLabel.classList.add("hidden");
        seasonLabel.textContent = "";
      }
      status.textContent =
        "No active season — fixtures appear once an admin activates a season.";
      return;
    }
    if (seasonLabel) {
      seasonLabel.textContent = `Season: ${data.season.label}`;
      seasonLabel.classList.remove("hidden");
    }
    const fixtures = data.fixtures || [];
    if (!fixtures.length) {
      status.textContent = "No fixtures for this filter yet.";
      return;
    }
    status.textContent = `${fixtures.length} match(es).`;
    for (const f of fixtures) {
      list.appendChild(renderFixtureCard(f));
    }
  } catch (e) {
    status.textContent = `Could not load fixtures: ${e.message}`;
    list.replaceChildren();
  }
}

document.getElementById("fixtures-filter")?.addEventListener("change", () => {
  loadPublicFixtures();
});

async function loadPublicStandings() {
  const tbody = document.getElementById("standings-tbody");
  const status = document.getElementById("standings-status");
  const seasonLabel = document.getElementById("standings-season-label");
  const tieNote = document.getElementById("standings-tie-note");
  if (!tbody || !status) return;
  try {
    const data = await client().standings();
    tbody.replaceChildren();
    if (!data.season) {
      if (seasonLabel) {
        seasonLabel.classList.add("hidden");
        seasonLabel.textContent = "";
      }
      if (tieNote) tieNote.classList.add("hidden");
      status.textContent = "No active season — standings appear when a season is active.";
      return;
    }
    if (seasonLabel) {
      seasonLabel.textContent = `Season: ${data.season.label}`;
      seasonLabel.classList.remove("hidden");
    }
    if (tieNote && Array.isArray(data.tie_breakers)) {
      tieNote.textContent = `Order: ${data.tie_breakers.join(" → ")}`;
      tieNote.classList.remove("hidden");
    }
    const rows = data.standings || [];
    if (!rows.length) {
      status.textContent = "No clubs in the table yet.";
      return;
    }
    status.textContent = `${rows.length} club(s).`;
    for (const r of rows) {
      const tr = document.createElement("tr");
      const addTd = (text, strong = false) => {
        const td = document.createElement("td");
        if (strong) {
          const b = document.createElement("strong");
          b.textContent = String(text);
          td.appendChild(b);
        } else {
          td.textContent = String(text);
        }
        tr.appendChild(td);
      };
      addTd(r.position);
      const clubTd = document.createElement("td");
      clubTd.className = "standings-club-cell";
      if (r.club_logo_url) {
        const img = document.createElement("img");
        img.src = r.club_logo_url;
        img.alt = "";
        img.className = "standings-club-logo";
        clubTd.appendChild(img);
      }
      const nm = document.createElement("span");
      nm.textContent = r.club_name;
      clubTd.appendChild(nm);
      tr.appendChild(clubTd);
      addTd(r.played);
      addTd(r.won);
      addTd(r.drawn);
      addTd(r.lost);
      addTd(r.gf);
      addTd(r.ga);
      addTd(r.gd);
      addTd(r.points, true);
      tbody.appendChild(tr);
    }
  } catch (e) {
    status.textContent = `Could not load standings: ${e.message}`;
    tbody.replaceChildren();
  }
}

// ——— Public clubs ———
async function loadPublicClubs() {
  const grid = document.getElementById("clubs-grid");
  const status = document.getElementById("clubs-status");
  if (!grid || !status) return;
  try {
    const { clubs } = await client().clubsList();
    grid.replaceChildren();
    if (!clubs.length) {
      status.textContent = "No clubs yet.";
      return;
    }
    status.textContent = `${clubs.length} club(s).`;
    for (const c of clubs) {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "club-card";
      if (c.logo_url) {
        const img = document.createElement("img");
        img.src = c.logo_url;
        img.alt = "";
        img.loading = "lazy";
        card.appendChild(img);
      } else {
        const ph = document.createElement("div");
        ph.className = "club-card-placeholder";
        ph.textContent = "⚽";
        card.appendChild(ph);
      }
      const name = document.createElement("span");
      name.className = "club-card-name";
      name.textContent = c.name;
      card.appendChild(name);
      card.addEventListener("click", () => openClubModal(c.id));
      grid.appendChild(card);
    }
  } catch (e) {
    status.textContent = `Could not load clubs: ${e.message}`;
    grid.replaceChildren();
  }
}

function closeClubModal() {
  const modal = document.getElementById("modal-club");
  if (modal) modal.hidden = true;
  document.body.style.overflow = "";
}

async function openClubModal(id) {
  const modal = document.getElementById("modal-club");
  const content = document.getElementById("club-modal-content");
  const title = document.getElementById("club-modal-title");
  if (!modal || !content || !title) return;
  modal.hidden = false;
  document.body.style.overflow = "hidden";
  title.textContent = "…";
  content.replaceChildren();
  const loading = document.createElement("p");
  loading.textContent = "Loading…";
  content.appendChild(loading);
  try {
    const data = await client().clubDetail(id);
    title.textContent = data.club.name;
    content.replaceChildren();
    if (data.club.founded_year) {
      const fy = document.createElement("p");
      fy.className = "club-founded";
      fy.textContent = `Founded: ${data.club.founded_year}`;
      content.appendChild(fy);
    }
    if (data.club.motto) {
      const m = document.createElement("p");
      m.className = "club-motto";
      m.textContent = data.club.motto;
      content.appendChild(m);
    }
    if (data.club.logo_url) {
      const img = document.createElement("img");
      img.src = data.club.logo_url;
      img.alt = "";
      img.className = "club-modal-logo";
      content.appendChild(img);
    }
    const coaches = data.coaches || [];
    if (coaches.length) {
      const coachH = document.createElement("h4");
      coachH.textContent = coaches.length > 1 ? "Coaches" : "Coach";
      content.appendChild(coachH);
      for (const ch of coaches) {
        content.appendChild(renderMemberCard(ch, true));
      }
    }
    const players = data.players || [];
    if (players.length) {
      const playH = document.createElement("h4");
      playH.textContent = "Players";
      content.appendChild(playH);
      for (const pl of players) {
        content.appendChild(renderMemberCard(pl, false));
      }
    }
    if (!coaches.length && !players.length) {
      const empty = document.createElement("p");
      empty.className = "club-roster-empty";
      empty.textContent = "No roster published yet.";
      content.appendChild(empty);
    }
  } catch (e) {
    content.replaceChildren();
    const err = document.createElement("p");
    err.textContent = e.message;
    content.appendChild(err);
  }
}

function renderMemberCard(m, isCoach) {
  const wrap = document.createElement("div");
  wrap.className = "club-member-card";
  if (m.photo_url) {
    const img = document.createElement("img");
    img.src = m.photo_url;
    img.alt = "";
    img.className = "club-member-photo";
    wrap.appendChild(img);
  }
  const body = document.createElement("div");
  body.className = "club-member-text";
  const nm = document.createElement("strong");
  nm.textContent = m.name;
  body.appendChild(nm);
  if (!isCoach && m.jersey_number != null) {
    const meta = document.createElement("div");
    meta.className = "club-member-meta";
    meta.textContent = `#${m.jersey_number} · ${m.position || ""}`;
    body.appendChild(meta);
  }
  if (m.previous_achievements) {
    const ach = document.createElement("p");
    ach.className = "club-member-ach";
    ach.textContent = m.previous_achievements;
    body.appendChild(ach);
  }
  wrap.appendChild(body);
  return wrap;
}

document.querySelectorAll("[data-close-club-modal]").forEach((btn) => {
  btn.addEventListener("click", closeClubModal);
});
document.getElementById("modal-club")?.addEventListener("click", (ev) => {
  if (ev.target?.id === "modal-club") closeClubModal();
});

// ——— Admin clubs ———
async function refreshAdminClubsUi(preferredClubId) {
  const panel = document.getElementById("admin-clubs-panel");
  const sel = document.getElementById("admin-club-select");
  if (!panel || panel.classList.contains("hidden") || !sel) return;
  const errEl = document.getElementById("admin-club-error");
  if (errEl) {
    errEl.classList.add("hidden");
    errEl.textContent = "";
  }
  try {
    const { clubs } = await client().adminClubsList();
    const keep =
      preferredClubId != null
        ? String(preferredClubId)
        : sel.value || document.getElementById("admin-club-id")?.value;
    sel.replaceChildren();
    const o0 = document.createElement("option");
    o0.value = "";
    o0.textContent = "— New club —";
    sel.appendChild(o0);
    for (const c of clubs) {
      const o = document.createElement("option");
      o.value = String(c.id);
      o.textContent = `${c.name} (${c.status})`;
      sel.appendChild(o);
    }
    if (keep && [...sel.options].some((o) => o.value === keep)) {
      sel.value = keep;
    } else if (sel.options[0]) {
      sel.value = sel.options[0].value;
    }
    if (sel.value) await loadClubIntoAdminForm(sel.value);
    else clearAdminClubForm();
  } catch (e) {
    if (errEl) {
      errEl.textContent = e.body?.message || e.message;
      errEl.classList.remove("hidden");
    }
  }
}

function clearAdminClubForm() {
  document.getElementById("admin-club-id").value = "";
  document.getElementById("admin-club-name").value = "";
  document.getElementById("admin-club-founded").value = "";
  document.getElementById("admin-club-motto").value = "";
  document.getElementById("admin-club-status").value = "active";
  document.getElementById("admin-club-logo").value = "";
  document.getElementById("admin-club-members-list").replaceChildren();
  resetAdminMemberForm();
}

function resetAdminMemberForm() {
  document.getElementById("admin-member-id").value = "";
  document.getElementById("form-admin-member")?.reset();
  document.getElementById("admin-member-sort").value = "0";
  document.getElementById("admin-member-photo").value = "";
  const title = document.getElementById("admin-member-form-title");
  const submit = document.getElementById("admin-member-submit");
  const cancel = document.getElementById("admin-member-cancel-edit");
  if (title) title.textContent = "Add member";
  if (submit) submit.textContent = "Add member";
  if (cancel) cancel.classList.add("hidden");
  syncAdminMemberTypeFields();
}

/** @param {Record<string, unknown>} m */
function beginEditMember(m) {
  document.getElementById("admin-member-id").value = String(m.id);
  document.getElementById("admin-member-type").value = m.member_type;
  document.getElementById("admin-member-name").value = m.name || "";
  document.getElementById("admin-member-jersey").value =
    m.jersey_number != null ? String(m.jersey_number) : "";
  document.getElementById("admin-member-position").value = m.position || "";
  document.getElementById("admin-member-achievements").value =
    m.previous_achievements || "";
  document.getElementById("admin-member-sort").value =
    m.sort_order != null ? String(m.sort_order) : "0";
  document.getElementById("admin-member-photo").value = "";
  const title = document.getElementById("admin-member-form-title");
  const submit = document.getElementById("admin-member-submit");
  const cancel = document.getElementById("admin-member-cancel-edit");
  if (title) title.textContent = "Edit member";
  if (submit) submit.textContent = "Save changes";
  if (cancel) cancel.classList.remove("hidden");
  syncAdminMemberTypeFields();
  document.getElementById("admin-member-name")?.focus();
}

function syncAdminMemberTypeFields() {
  const type = document.getElementById("admin-member-type")?.value;
  const jersey = document.getElementById("admin-member-jersey")?.closest(".field");
  const pos = document.getElementById("admin-member-position")?.closest(".field");
  const isPlayer = type === "player";
  if (jersey) jersey.classList.toggle("hidden", !isPlayer);
  if (pos) pos.classList.toggle("hidden", !isPlayer);
}

async function loadClubIntoAdminForm(id) {
  if (!id) {
    clearAdminClubForm();
    return;
  }
  try {
    const { club } = await client().adminClubShow(id);
    resetAdminMemberForm();
    document.getElementById("admin-club-id").value = String(club.id);
    document.getElementById("admin-club-name").value = club.name;
    document.getElementById("admin-club-founded").value = club.founded_year ?? "";
    document.getElementById("admin-club-motto").value = club.motto || "";
    document.getElementById("admin-club-status").value = club.status;
    document.getElementById("admin-club-logo").value = "";
    renderAdminMembersList(club);
  } catch (e) {
    const err = document.getElementById("admin-club-error");
    if (err) {
      err.textContent = e.body?.message || e.message;
      err.classList.remove("hidden");
    }
  }
}

function renderAdminMembersList(club) {
  const ul = document.getElementById("admin-club-members-list");
  if (!ul) return;
  ul.replaceChildren();
  const rows = [...(club.coaches || []), ...(club.players || [])];
  for (const m of rows) {
    const li = document.createElement("li");
    li.className = "member-admin-row";
    const label = document.createElement("span");
    label.textContent = `${m.member_type}: ${m.name}${
      m.jersey_number != null ? ` #${m.jersey_number}` : ""
    }`;
    li.appendChild(label);
    const actions = document.createElement("span");
    actions.className = "member-admin-actions";
    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "btn-link-edit";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", () => beginEditMember(m));
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn-link-delete";
    btn.textContent = "Remove";
    btn.addEventListener("click", async () => {
      const clubId = document.getElementById("admin-club-id").value;
      try {
        await client().adminClubMemberDelete(clubId, m.id);
        resetAdminMemberForm();
        await loadClubIntoAdminForm(clubId);
        await loadPublicClubs();
      } catch (err) {
        window.alert(err.body?.message || err.message);
      }
    });
    actions.appendChild(editBtn);
    actions.appendChild(btn);
    li.appendChild(actions);
    ul.appendChild(li);
  }
}

document.getElementById("admin-club-select")?.addEventListener("change", (ev) => {
  loadClubIntoAdminForm(ev.target.value);
});

document.getElementById("admin-club-new")?.addEventListener("click", () => {
  const sel = document.getElementById("admin-club-select");
  if (sel) sel.value = "";
  clearAdminClubForm();
  document.getElementById("admin-club-name").focus();
});

document.getElementById("admin-member-type")?.addEventListener("change", () => {
  syncAdminMemberTypeFields();
});

document.getElementById("admin-member-cancel-edit")?.addEventListener("click", () => {
  resetAdminMemberForm();
});

document.getElementById("admin-club-delete")?.addEventListener("click", async () => {
  const id = document.getElementById("admin-club-id").value;
  if (!id || !window.confirm("Delete this club and all members?")) return;
  try {
    await client().adminClubDelete(id);
    await refreshAdminClubsUi();
    await refreshAdminFixturesUi();
    await refreshAdminResultsUi();
    await loadPublicFixtures();
    await loadPublicClubs();
    await loadPublicStandings();
  } catch (e) {
    window.alert(e.body?.message || e.message);
  }
});

document.getElementById("form-admin-club")?.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const errEl = document.getElementById("admin-club-error");
  errEl.classList.add("hidden");
  errEl.textContent = "";
  const id = document.getElementById("admin-club-id").value;
  const fd = new FormData();
  fd.append("name", document.getElementById("admin-club-name").value.trim());
  const fy = document.getElementById("admin-club-founded").value;
  if (fy) fd.append("founded_year", fy);
  const motto = document.getElementById("admin-club-motto").value;
  if (motto) fd.append("motto", motto);
  fd.append("status", document.getElementById("admin-club-status").value);
  const logo = document.getElementById("admin-club-logo").files[0];
  if (logo) fd.append("logo", logo);
  try {
    if (id) {
      await client().adminClubUpdate(id, fd);
      await refreshAdminClubsUi(id);
    } else {
      const res = await client().adminClubStore(fd);
      const newId = String(res.club.id);
      document.getElementById("admin-club-id").value = newId;
      await refreshAdminClubsUi(newId);
    }
    await loadPublicFixtures();
    await loadPublicClubs();
    await loadPublicStandings();
  } catch (e) {
    errEl.textContent =
      e.body?.message ||
      (e.body?.errors && JSON.stringify(e.body.errors)) ||
      e.message;
    errEl.classList.remove("hidden");
  }
});

document.getElementById("form-admin-member")?.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const clubId = document.getElementById("admin-club-id").value;
  const memberId = document.getElementById("admin-member-id").value;
  const errEl = document.getElementById("admin-member-error");
  errEl.classList.add("hidden");
  errEl.textContent = "";
  if (!clubId) {
    errEl.textContent = "Save or select a club first.";
    errEl.classList.remove("hidden");
    return;
  }
  const type = document.getElementById("admin-member-type").value;
  const fd = new FormData();
  fd.append("member_type", type);
  fd.append("name", document.getElementById("admin-member-name").value.trim());
  fd.append("sort_order", document.getElementById("admin-member-sort").value || "0");
  const ach = document.getElementById("admin-member-achievements").value;
  if (ach) fd.append("previous_achievements", ach);
  if (type === "player") {
    fd.append("jersey_number", document.getElementById("admin-member-jersey").value);
    fd.append("position", document.getElementById("admin-member-position").value.trim());
  }
  const photo = document.getElementById("admin-member-photo").files[0];
  if (photo) fd.append("photo", photo);
  try {
    if (memberId) {
      await client().adminClubMemberUpdate(clubId, memberId, fd);
    } else {
      await client().adminClubMemberStore(clubId, fd);
    }
    resetAdminMemberForm();
    await loadClubIntoAdminForm(clubId);
    await loadPublicClubs();
  } catch (e) {
    errEl.textContent =
      e.body?.message ||
      (e.body?.errors && JSON.stringify(e.body.errors)) ||
      e.message;
    errEl.classList.remove("hidden");
  }
});

// ——— Admin fixtures ———
function fillAdminFixtureSeasonSelect(seasons) {
  const sel = document.getElementById("admin-fixture-season");
  if (!sel) return;
  sel.replaceChildren();
  if (!seasons.length) {
    const o = document.createElement("option");
    o.value = "";
    o.textContent = "No seasons — create one first";
    sel.appendChild(o);
    return;
  }
  const sorted = [...seasons].sort((a, b) => Number(b.is_active) - Number(a.is_active));
  for (const s of sorted) {
    const o = document.createElement("option");
    o.value = String(s.id);
    o.textContent = s.is_active ? `${s.label} (active)` : s.label;
    sel.appendChild(o);
  }
}

function fillAdminFixtureClubSelects(clubs) {
  const home = document.getElementById("admin-fixture-home");
  const away = document.getElementById("admin-fixture-away");
  if (!home || !away) return;
  for (const sel of [home, away]) {
    sel.replaceChildren();
    const o0 = document.createElement("option");
    o0.value = "";
    o0.textContent = "— Choose club —";
    sel.appendChild(o0);
    for (const c of clubs) {
      const o = document.createElement("option");
      o.value = String(c.id);
      o.textContent = `${c.name} (${c.status})`;
      sel.appendChild(o);
    }
  }
}

function fillAdminFixtureSelect(fixtures) {
  const sel = document.getElementById("admin-fixture-select");
  if (!sel) return;
  sel.replaceChildren();
  const o0 = document.createElement("option");
  o0.value = "";
  o0.textContent = "— New fixture —";
  sel.appendChild(o0);
  for (const f of fixtures) {
    const o = document.createElement("option");
    o.value = String(f.id);
    const home = f.home?.name || "?";
    const away = f.away?.name || "?";
    const when = f.kickoff_at ? formatLocaleDateTime(f.kickoff_at) : "";
    o.textContent = `${when} · ${home} vs ${away}`;
    sel.appendChild(o);
  }
}

function clearAdminFixtureForm() {
  document.getElementById("admin-fixture-id").value = "";
  document.getElementById("admin-fixture-matchno").value = "";
  document.getElementById("admin-fixture-kickoff").value = "";
  document.getElementById("admin-fixture-venue").value = "";
  document.getElementById("admin-fixture-venueloc").value = "";
  document.getElementById("admin-fixture-round").value = "";
  document.getElementById("admin-fixture-status").value = "scheduled";
  const seasonSel = document.getElementById("admin-fixture-season");
  const comp = document.getElementById("admin-fixture-comp");
  if (seasonSel?.options.length) {
    const activeOpt = [...seasonSel.options].find((opt) => opt.textContent.includes("(active)"));
    seasonSel.value = activeOpt ? activeOpt.value : seasonSel.options[0].value;
    const lab = seasonSel.options[seasonSel.selectedIndex]?.textContent || "";
    if (comp) {
      comp.value = lab.replace(/\s*\(active\)\s*$/i, "").trim();
    }
  } else if (comp) {
    comp.value = "";
  }
  document.getElementById("admin-fixture-home").value = "";
  document.getElementById("admin-fixture-away").value = "";
}

async function loadFixtureIntoAdminForm(id) {
  const errEl = document.getElementById("admin-fixture-error");
  if (errEl) {
    errEl.classList.add("hidden");
    errEl.textContent = "";
  }
  if (!id) {
    clearAdminFixtureForm();
    return;
  }
  try {
    const { fixture } = await client().adminFixtureShow(id);
    document.getElementById("admin-fixture-id").value = String(fixture.id);
    document.getElementById("admin-fixture-season").value = String(fixture.season_id);
    document.getElementById("admin-fixture-matchno").value = fixture.match_number || "";
    document.getElementById("admin-fixture-home").value = String(fixture.home_club_id);
    document.getElementById("admin-fixture-away").value = String(fixture.away_club_id);
    document.getElementById("admin-fixture-kickoff").value = isoToDatetimeLocal(
      fixture.kickoff_at
    );
    document.getElementById("admin-fixture-venue").value = fixture.venue_name || "";
    document.getElementById("admin-fixture-venueloc").value = fixture.venue_location || "";
    document.getElementById("admin-fixture-comp").value = fixture.competition_name || "";
    document.getElementById("admin-fixture-round").value = fixture.round_label || "";
    document.getElementById("admin-fixture-status").value = fixture.status || "scheduled";
  } catch (e) {
    if (errEl) {
      errEl.textContent = e.body?.message || e.message;
      errEl.classList.remove("hidden");
    }
  }
}

async function refreshAdminFixturesUi(preferredFixtureId) {
  const panel = document.getElementById("admin-fixtures-panel");
  const sel = document.getElementById("admin-fixture-select");
  if (!panel || panel.classList.contains("hidden") || !sel) return;
  const errEl = document.getElementById("admin-fixture-error");
  if (errEl) {
    errEl.classList.add("hidden");
    errEl.textContent = "";
  }
  try {
    const [{ seasons }, { clubs }, { fixtures }] = await Promise.all([
      client().adminSeasonsList(),
      client().adminClubsList(),
      client().adminFixturesList(),
    ]);
    fillAdminFixtureSeasonSelect(seasons);
    fillAdminFixtureClubSelects(clubs);
    fillAdminFixtureSelect(fixtures);
    const keep =
      preferredFixtureId != null
        ? String(preferredFixtureId)
        : sel.value || document.getElementById("admin-fixture-id")?.value;
    if (keep && [...sel.options].some((o) => o.value === keep)) {
      sel.value = keep;
    } else {
      sel.value = "";
    }
    if (sel.value) await loadFixtureIntoAdminForm(sel.value);
    else clearAdminFixtureForm();
  } catch (e) {
    if (errEl) {
      errEl.textContent = e.body?.message || e.message;
      errEl.classList.remove("hidden");
    }
  }
}

document.getElementById("admin-fixture-select")?.addEventListener("change", (ev) => {
  loadFixtureIntoAdminForm(ev.target.value);
});

document.getElementById("admin-fixture-new")?.addEventListener("click", () => {
  const s = document.getElementById("admin-fixture-select");
  if (s) s.value = "";
  clearAdminFixtureForm();
  document.getElementById("admin-fixture-kickoff")?.focus();
});

document.getElementById("admin-fixture-delete")?.addEventListener("click", async () => {
  const id = document.getElementById("admin-fixture-id").value;
  if (!id || !window.confirm("Delete this fixture?")) return;
  try {
    await client().adminFixtureDelete(id);
    await refreshAdminFixturesUi();
    await refreshAdminResultsUi();
    await loadPublicFixtures();
    await loadPublicStandings();
  } catch (e) {
    window.alert(e.body?.message || e.message);
  }
});

document.getElementById("form-admin-fixture")?.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const errEl = document.getElementById("admin-fixture-error");
  errEl.classList.add("hidden");
  errEl.textContent = "";
  const id = document.getElementById("admin-fixture-id").value;
  const kickIso = datetimeLocalToIso(document.getElementById("admin-fixture-kickoff").value);
  if (!kickIso) {
    errEl.textContent = "Kick-off date and time are required.";
    errEl.classList.remove("hidden");
    return;
  }
  const matchNo = document.getElementById("admin-fixture-matchno").value.trim();
  const payload = {
    season_id: parseInt(document.getElementById("admin-fixture-season").value, 10),
    match_number: matchNo || null,
    home_club_id: parseInt(document.getElementById("admin-fixture-home").value, 10),
    away_club_id: parseInt(document.getElementById("admin-fixture-away").value, 10),
    kickoff_at: kickIso,
    venue_name: document.getElementById("admin-fixture-venue").value.trim(),
    venue_location: document.getElementById("admin-fixture-venueloc").value.trim() || null,
    competition_name: document.getElementById("admin-fixture-comp").value.trim(),
    round_label: document.getElementById("admin-fixture-round").value.trim() || null,
    status: document.getElementById("admin-fixture-status").value,
  };
  try {
    if (id) {
      await client().adminFixtureUpdate(id, payload);
      await refreshAdminFixturesUi(id);
    } else {
      const res = await client().adminFixtureStore(payload);
      const newId = String(res.fixture.id);
      document.getElementById("admin-fixture-id").value = newId;
      await refreshAdminFixturesUi(newId);
    }
    await refreshAdminResultsUi();
    await loadPublicFixtures();
    await loadPublicStandings();
  } catch (e) {
    errEl.textContent =
      e.body?.message ||
      (e.body?.errors && JSON.stringify(e.body.errors)) ||
      e.message;
    errEl.classList.remove("hidden");
  }
});

/** @type {unknown[]} */
let adminResultFixturesCache = [];

async function refreshAdminResultsUi(preferredFixtureId) {
  const panel = document.getElementById("admin-results-panel");
  const sel = document.getElementById("admin-result-fixture-select");
  if (!panel || panel.classList.contains("hidden") || !sel) return;
  const errEl = document.getElementById("admin-result-error");
  if (errEl) {
    errEl.classList.add("hidden");
    errEl.textContent = "";
  }
  try {
    const { fixtures } = await client().adminFixturesList();
    adminResultFixturesCache = fixtures;
    const keep =
      preferredFixtureId != null
        ? String(preferredFixtureId)
        : sel.value;
    sel.replaceChildren();
    const o0 = document.createElement("option");
    o0.value = "";
    o0.textContent = "— Select fixture —";
    sel.appendChild(o0);
    for (const f of fixtures) {
      const o = document.createElement("option");
      o.value = String(f.id);
      o.textContent = `${f.home?.name || "?"} vs ${f.away?.name || "?"} · ${
        f.kickoff_at ? formatLocaleDateTime(f.kickoff_at) : ""
      }${f.result ? " ✓" : ""}`;
      sel.appendChild(o);
    }
    if (keep && [...sel.options].some((x) => x.value === keep)) {
      sel.value = keep;
    } else {
      sel.value = "";
    }
    loadAdminResultFormFromSelection();
  } catch (e) {
    if (errEl) {
      errEl.textContent = e.body?.message || e.message;
      errEl.classList.remove("hidden");
    }
  }
}

function loadAdminResultFormFromSelection() {
  const sel = document.getElementById("admin-result-fixture-select");
  const id = sel?.value;
  const labelEl = document.getElementById("admin-result-fixture-label");
  const hg = document.getElementById("admin-result-home-goals");
  const ag = document.getElementById("admin-result-away-goals");
  const hl = document.getElementById("admin-result-home-label");
  const al = document.getElementById("admin-result-away-label");
  const errEl = document.getElementById("admin-result-error");
  errEl?.classList.add("hidden");
  if (!hg || !ag) return;
  if (!id) {
    if (labelEl) labelEl.textContent = "";
    hg.value = "";
    ag.value = "";
    return;
  }
  const f = adminResultFixturesCache.find((x) => String(x.id) === id);
  if (!f) return;
  if (labelEl) {
    labelEl.textContent = `${f.home?.name} (home) vs ${f.away?.name} (away)`;
  }
  if (hl) hl.textContent = `${f.home?.name} goals`;
  if (al) al.textContent = `${f.away?.name} goals`;
  if (f.result) {
    hg.value = String(f.result.home_goals);
    ag.value = String(f.result.away_goals);
  } else {
    hg.value = "";
    ag.value = "";
  }
}

document.getElementById("admin-result-fixture-select")?.addEventListener("change", () => {
  loadAdminResultFormFromSelection();
});

document.getElementById("form-admin-result")?.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const fixtureId = document.getElementById("admin-result-fixture-select")?.value;
  const errEl = document.getElementById("admin-result-error");
  errEl.classList.add("hidden");
  errEl.textContent = "";
  if (!fixtureId) {
    errEl.textContent = "Select a fixture first.";
    errEl.classList.remove("hidden");
    return;
  }
  const homeGoals = parseInt(document.getElementById("admin-result-home-goals").value, 10);
  const awayGoals = parseInt(document.getElementById("admin-result-away-goals").value, 10);
  if (Number.isNaN(homeGoals) || Number.isNaN(awayGoals)) {
    errEl.textContent = "Enter valid goal counts (0–99).";
    errEl.classList.remove("hidden");
    return;
  }
  try {
    await client().adminFixtureResultUpsert(fixtureId, {
      home_goals: homeGoals,
      away_goals: awayGoals,
    });
    await refreshAdminResultsUi(fixtureId);
    await refreshAdminFixturesUi();
    await loadPublicStandings();
  } catch (e) {
    errEl.textContent =
      e.body?.message || (e.body?.errors && JSON.stringify(e.body.errors)) || e.message;
    errEl.classList.remove("hidden");
  }
});

document.getElementById("admin-result-clear")?.addEventListener("click", async () => {
  const fixtureId = document.getElementById("admin-result-fixture-select")?.value;
  if (!fixtureId) return;
  if (!window.confirm("Remove saved result for this fixture?")) return;
  try {
    await client().adminFixtureResultDelete(fixtureId);
    await refreshAdminResultsUi(fixtureId);
    await refreshAdminFixturesUi();
    await loadPublicStandings();
  } catch (e) {
    window.alert(e.body?.message || e.message);
  }
});

document.getElementById("btn-clubs")?.addEventListener("click", async () => {
  try {
    show(await client().clubsList());
  } catch (e) {
    show(`Error: ${e.message}\n${e.body != null ? JSON.stringify(e.body, null, 2) : ""}`);
  }
});

document.getElementById("btn-fixtures")?.addEventListener("click", async () => {
  try {
    show(await client().fixturesList());
  } catch (e) {
    show(`Error: ${e.message}\n${e.body != null ? JSON.stringify(e.body, null, 2) : ""}`);
  }
});

document.getElementById("btn-standings")?.addEventListener("click", async () => {
  try {
    show(await client().standings());
  } catch (e) {
    show(`Error: ${e.message}\n${e.body != null ? JSON.stringify(e.body, null, 2) : ""}`);
  }
});

syncAdminMemberTypeFields();

refreshSession();
loadPublicClubs();
loadPublicFixtures();
loadPublicStandings();
