import { API_BASE_URL } from "./config.js";
import { apiGet, formatApiErrors, getToken, resolveBackendPublicFileUrl } from "./auth.js";
import { initGalleryCarousel, openModalById } from "./ui.js";

const BADGE_MOD = ["", "club-badge--alt", "club-badge--green", "club-badge--orange"];

function initials(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

function formatTime(t) {
  if (!t) return "—";
  const s = String(t);
  return s.length >= 5 ? s.slice(0, 5) : s;
}

function statusLabel(s) {
  const m = { upcoming: "Upcoming", finished: "Full time", postponed: "Postponed" };
  return m[s] || s || "—";
}

function showHomeLoading() {
  const tbody = document.getElementById("standings-tbody");
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="7" class="home-api-status home-api-status--loading">Loading standings…</td></tr>`;
  }
  const stack = document.getElementById("fixture-stack");
  if (stack) {
    stack.innerHTML = `<p class="form__hint home-api-status home-api-status--loading">Loading fixtures…</p>`;
  }
  const track = document.getElementById("gallery-track");
  if (track) {
    track.innerHTML = `<p class="form__hint home-api-status home-api-status--loading" style="padding:1rem 1.25rem;margin:0">Loading gallery…</p>`;
  }
}

export async function loadPublicHomePage() {
  showHomeLoading();
  try {
    const [stRes, fxRes, phRes] = await Promise.all([
      apiGet("/api/v1/standings"),
      apiGet("/api/v1/fixtures"),
      apiGet("/api/v1/photos"),
    ]);
    renderStandings(stRes);
    renderFixtures(fxRes);
    renderGallery(phRes);
    renderOverviewStrip(stRes, fxRes);
  } catch {
    const failed = /** @type {{ ok: false, status: number, data: Record<string, unknown> }} */ ({
      ok: false,
      status: 0,
      data: {},
    });
    renderStandings(failed);
    renderFixtures(failed);
    renderGallery(failed);
    renderOverviewStrip(failed, failed);
  }
}

function renderOverviewStrip(stRes, fxRes) {
  const seasonEl = document.getElementById("home-stat-season");
  const clubsEl = document.getElementById("home-stat-clubs");
  const playersEl = document.getElementById("home-stat-players");
  const kickEl = document.getElementById("home-next-kickoff");
  const metaEl = document.getElementById("home-next-meta");

  if (seasonEl) {
    if (stRes.ok && stRes.data.league) {
      const L = /** @type {{name:string, year?:string, season?:string}} */ (stRes.data.league);
      seasonEl.textContent = `${L.name} — ${String(L.year || L.season || "—")}`;
    } else {
      seasonEl.textContent = "—";
    }
  }

  if (clubsEl) {
    const n =
      stRes.ok && Array.isArray(stRes.data.standings) ? /** @type {unknown[]} */ (stRes.data.standings).length : null;
    clubsEl.textContent = n === null ? "—" : String(n);
  }

  if (playersEl) {
    playersEl.textContent = "—";
  }

  if (kickEl && metaEl) {
    if (!fxRes.ok || !Array.isArray(fxRes.data.fixtures)) {
      kickEl.textContent = "—";
      metaEl.textContent =
        fxRes.status === 0 ? "Network error — could not load fixtures." : "Could not load fixtures.";
      return;
    }
    const fixtures = /** @type {Record<string, unknown>[]} */ (fxRes.data.fixtures);
    const upcoming = fixtures
      .filter((f) => f.status === "upcoming")
      .sort((a, b) => String(a.match_date).localeCompare(String(b.match_date)) || String(a.match_time).localeCompare(String(b.match_time)))[0];
    if (!upcoming) {
      kickEl.textContent = "TBC";
      metaEl.textContent = "No upcoming fixtures.";
      return;
    }
    const hn = upcoming.home_club && /** @type {{club_name:string}} */ (upcoming.home_club).club_name;
    const an = upcoming.away_club && /** @type {{club_name:string}} */ (upcoming.away_club).club_name;
    kickEl.textContent = `${hn || "?"} vs ${an || "?"}`;
    metaEl.textContent = `${formatDate(String(upcoming.match_date))} · ${formatTime(String(upcoming.match_time))} · ${String(upcoming.venue || "")}`;
  }
}

function renderStandings(res) {
  const tbody = document.getElementById("standings-tbody");
  if (!tbody) return;

  if (!res.ok) {
    const line =
      res.status === 0 ? "Standings unavailable (network error)." : "Standings unavailable.";
    tbody.innerHTML = `<tr><td colspan="7" class="home-api-status">${line}</td></tr>`;
    return;
  }

  const rows = /** @type {Record<string, unknown>[]} */ (res.data.standings || []);
  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="home-api-status">No standings yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = rows
    .map((r, i) => {
      const badge = BADGE_MOD[i % BADGE_MOD.length];
      const name = String(r.club_name || "Club");
      const ini = initials(name);
      return `<tr>
        <td>${String(r.rank).padStart(2, "0")}</td>
        <td><span class="club-cell"><span class="club-badge ${badge}" aria-hidden="true">${ini}</span> ${escapeHtml(name)}</span></td>
        <td>${r.played}</td>
        <td>${r.won}</td>
        <td>${r.drawn}</td>
        <td>${r.lost}</td>
        <td class="standings-table__pts">${r.points}</td>
      </tr>`;
    })
    .join("");
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderFixtures(res) {
  const stack = document.getElementById("fixture-stack");
  if (!stack) return;

  if (!res.ok) {
    const line =
      res.status === 0 ? "Fixtures unavailable (network error)." : "Fixtures unavailable.";
    stack.innerHTML = `<p class="form__hint home-api-status">${line}</p>`;
    return;
  }

  const fixtures = /** @type {Record<string, unknown>[]} */ (res.data.fixtures || []);
  if (fixtures.length === 0) {
    stack.innerHTML = `<p class="form__hint home-api-status">No fixtures published yet.</p>`;
    return;
  }

  stack.innerHTML = fixtures
    .map((f, i) => {
      const finished = f.status === "finished" && f.home_score != null && f.away_score != null;
      const cardClass = finished ? "fixture-card fixture-card--result" : "fixture-card fixture-card--upcoming";
      const hn = f.home_club && /** @type {{club_name:string}} */ (f.home_club).club_name;
      const an = f.away_club && /** @type {{club_name:string}} */ (f.away_club).club_name;
      const lg = f.league && /** @type {{name:string}} */ (f.league).name;
      const badgeH = BADGE_MOD[i % BADGE_MOD.length];
      const badgeA = BADGE_MOD[(i + 1) % BADGE_MOD.length];
      const metaPill = finished ? `<span class="pill">FT</span>` : `<span class="pill pill--on-dark">Upcoming</span>`;
      const scoreBlock = finished
        ? `<div class="fixture-score"><span class="fixture-score__nums">${f.home_score} – ${f.away_score}</span><span class="fixture-score__ft">FT</span></div>`
        : `<div class="fixture-score"><span class="fixture-score__vs">vs</span><span class="fixture-score__ft">${formatTime(String(f.match_time))}</span></div>`;
      const venue =
        f.venue && String(f.venue).trim()
          ? `<p class="fixture-card__venue"><span aria-hidden="true">📍</span> ${escapeHtml(String(f.venue))}</p>`
          : "";
      const btnClass = finished ? "btn btn--block btn--muted" : "btn btn--block btn--gold";
      const btnLabel = finished ? "Match details" : "Match preview";
      return `<article class="${cardClass}">
        <div class="fixture-card__meta">
          ${metaPill}
          <time datetime="${escapeHtml(String(f.match_date))}">${escapeHtml(String(f.match_date))}</time>
          ${lg ? `<span class="pill">${escapeHtml(lg)}</span>` : ""}
        </div>
        <div class="fixture-card__scoreboard">
          <div class="fixture-team">
            <span class="club-badge ${finished ? "" : "club-badge--ghost"} ${badgeH}" aria-hidden="true">${escapeHtml(initials(hn))}</span>
            <span class="fixture-team__name">${escapeHtml(String(hn))}</span>
          </div>
          ${scoreBlock}
          <div class="fixture-team">
            <span class="club-badge ${finished ? "" : "club-badge--ghost"} ${badgeA}" aria-hidden="true">${escapeHtml(initials(an))}</span>
            <span class="fixture-team__name">${escapeHtml(String(an))}</span>
          </div>
        </div>
        ${venue}
        <button type="button" class="${btnClass}" data-open-modal="modal-match-details" data-fixture-id="${f.id}">${btnLabel}</button>
      </article>`;
    })
    .join("");
}

function renderGallery(res) {
  const track = document.getElementById("gallery-track");
  if (!track) return;

  if (!res.ok) {
    const line =
      res.status === 0 ? "Gallery unavailable (network error)." : "Gallery unavailable.";
    track.innerHTML = `<p class="form__hint home-api-status" style="padding:1rem 1.25rem;margin:0">${line}</p>`;
    return;
  }

  if (!Array.isArray(res.data.photos) || res.data.photos.length === 0) {
    track.innerHTML = `<p class="form__hint home-api-status" style="padding:1rem 1.25rem;margin:0">No gallery photos yet.</p>`;
    return;
  }

  const photos = /** @type {{id:number, image_url:string}[]} */ (res.data.photos);
  track.innerHTML = photos
    .map(
      (p, i) => `<div class="gallery__slide" role="listitem">
      <img src="${escapeHtml(resolveBackendPublicFileUrl(p.image_url))}" alt="Gallery photo ${i + 1}" width="800" height="500" loading="lazy" />
    </div>`,
    )
    .join("");
}

export async function openMatchDetailsModal(fixtureId) {
  const dialog = document.getElementById("modal-match-details");
  const hint = document.getElementById("md-hint");
  if (!dialog?.showModal) return;

  setText("md-league", "—");
  setText("md-teams", "—");
  setText("md-date", "—");
  setText("md-time", "—");
  setText("md-venue", "—");
  setText("md-status", "—");
  setText("md-score", "—");
  if (hint) {
    hint.textContent = "Loading match…";
    hint.hidden = false;
  }
  dialog.showModal();

  const res = await apiGet(`/api/v1/fixtures/${fixtureId}`);

  if (!res.ok) {
    if (hint) {
      hint.textContent =
        res.status === 0 ? "Network error — could not load this match." : "Could not load this match.";
      hint.hidden = false;
    }
    return;
  }

  const f = /** @type {Record<string, unknown>} */ (res.data.fixture);
  const league = f.league && /** @type {{name:string, year?:string, season?:string}} */ (f.league);
  const hn = f.home_club && /** @type {{club_name:string}} */ (f.home_club).club_name;
  const an = f.away_club && /** @type {{club_name:string}} */ (f.away_club).club_name;

  setText("md-league", league ? `${league.name} — ${String(league.year || league.season || "—")}` : "—");
  setText("md-teams", `${hn || "?"} vs ${an || "?"}`);
  setText("md-date", formatDate(String(f.match_date)));
  setText("md-time", formatTime(String(f.match_time)));
  setText("md-venue", String(f.venue || "—"));
  setText("md-status", statusLabel(String(f.status)));
  if (f.status === "finished" && f.home_score != null && f.away_score != null) {
    setText("md-score", `${f.home_score} – ${f.away_score}`);
  } else if (f.status === "postponed") {
    setText("md-score", "Postponed");
  } else {
    setText("md-score", "—");
  }

  if (hint) hint.hidden = true;
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

export function initDay6ModalCapture() {
  document.addEventListener(
    "click",
    (e) => {
      const matchBtn = /** @type {HTMLElement | null} */ (e.target).closest(
        '[data-open-modal="modal-match-details"][data-fixture-id]',
      );
      if (matchBtn) {
        e.preventDefault();
        e.stopPropagation();
        const id = matchBtn.getAttribute("data-fixture-id");
        if (id) void openMatchDetailsModal(id);
        return;
      }

      const certBtn = /** @type {HTMLElement | null} */ (e.target).closest('[data-open-modal="modal-certificate"]');
      if (certBtn) {
        e.preventDefault();
        e.stopPropagation();
        void openCertificateFlow();
      }
    },
    true,
  );
}

let currentCertificateId = null;

async function openCertificateFlow() {
  const dialog = document.getElementById("modal-certificate");
  if (!dialog?.showModal) return;

  hideGoalsAssists();

  const foot = document.getElementById("cert-foot-note");
  const dlBtn = document.getElementById("cert-btn-download");
  const title = document.getElementById("modal-cert-title");
  const ribbon = document.getElementById("cert-ribbon");

  if (!getToken()) {
    currentCertificateId = null;
    if (dlBtn) dlBtn.disabled = true;
    if (foot) foot.textContent = "Sign in to view your certificate.";
    if (title) title.textContent = "Certificate";
    if (ribbon) ribbon.textContent = "Certificate";
    openModalById("modal-sign-in");
    return;
  }

  if (foot) foot.textContent = "Loading your certificate…";
  if (dlBtn) dlBtn.disabled = true;
  hideGoalsAssists();
  dialog.showModal();

  const res = await apiGet("/api/v1/certificates", { auth: true });
  if (!res.ok) {
    currentCertificateId = null;
    if (dlBtn) dlBtn.disabled = true;
    if (foot) foot.textContent = formatApiErrors(res.data, { status: res.status });
    if (title) title.textContent = "Certificate";
    if (ribbon) ribbon.textContent = "Certificate";
    setText("cert-dd-id", "—");
    setText("cert-dd-name", "—");
    setText("cert-dd-years", "—");
    setText("cert-dd-position", "—");
    hideGoalsAssists();
    return;
  }

  if (!Array.isArray(res.data.certificates) || res.data.certificates.length === 0) {
    currentCertificateId = null;
    if (dlBtn) dlBtn.disabled = true;
    if (foot) foot.textContent = "No certificate on file for your account yet.";
    if (title) title.textContent = "Certificate";
    if (ribbon) ribbon.textContent = "Certificate";
    setText("cert-dd-id", "—");
    setText("cert-dd-name", "—");
    setText("cert-dd-years", "—");
    setText("cert-dd-position", "—");
    hideGoalsAssists();
    return;
  }

  const c = /** @type {Record<string, unknown>} */ (res.data.certificates[0]);
  currentCertificateId = Number(c.id);
  if (dlBtn) dlBtn.disabled = false;
  if (foot) foot.textContent = "Official record — download PDF for your files.";
  if (title) title.textContent = String(c.title || "Certificate");
  if (ribbon) ribbon.textContent = String(c.type || "Certificate").replaceAll("_", " ");

  setText("cert-dd-id", String(c.student_staff_id || "—"));
  setText("cert-dd-name", "—");
  await fillCertificateNameFromMe();
  setText("cert-dd-years", `${c.participate_year_start} – ${c.participate_year_end}`);
  setText("cert-dd-position", String(c.positions_played || "—"));

  const goalsRow = document.getElementById("cert-row-goals");
  const asstRow = document.getElementById("cert-row-assists");
  const goalsDd = document.getElementById("cert-dd-goals");
  const asstDd = document.getElementById("cert-dd-assists");
  const scored = Number(c.scored || 0);
  const assisted = Number(c.assisted || 0);
  if (scored > 0 && goalsRow && goalsDd) {
    goalsDd.textContent = String(scored);
    goalsRow.hidden = false;
  } else if (goalsRow) {
    goalsRow.hidden = true;
  }
  if (assisted > 0 && asstRow && asstDd) {
    asstDd.textContent = String(assisted);
    asstRow.hidden = false;
  } else if (asstRow) {
    asstRow.hidden = true;
  }
}

function hideGoalsAssists() {
  const g = document.getElementById("cert-row-goals");
  const a = document.getElementById("cert-row-assists");
  if (g) g.hidden = true;
  if (a) a.hidden = true;
}

async function fillCertificateNameFromMe() {
  const res = await apiGet("/api/v1/auth/me", { auth: true });
  if (res.ok && res.data.user) {
    const u = /** @type {{name?: string}} */ (res.data.user);
    setText("cert-dd-name", u.name || "—");
  }
}

export function wireCertificateDownload() {
  document.getElementById("cert-btn-download")?.addEventListener("click", async () => {
    if (!currentCertificateId || !getToken()) return;
    const foot = document.getElementById("cert-foot-note");
    const res = await fetch(`${API_BASE_URL}/api/v1/certificates/${currentCertificateId}/pdf`, {
      headers: { Authorization: `Bearer ${getToken()}`, Accept: "application/pdf" },
    });
    if (!res.ok) {
      let msg = "Could not download PDF. Please try again.";
      try {
        const ct = res.headers.get("content-type") || "";
        if (ct.includes("application/json")) {
          const data = await res.json();
          msg = formatApiErrors(data, { status: res.status });
        }
      } catch {
        /* keep default */
      }
      if (foot) foot.textContent = msg;
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `versity-certificate-${currentCertificateId}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  });
}
