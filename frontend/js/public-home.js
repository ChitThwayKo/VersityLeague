import { API_BASE_URL } from "./config.js";
import { apiGet, formatApiErrors, getToken, resolveBackendPublicFileUrl, setFormFeedback } from "./auth.js?v=20260417a";
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

function formatPlayerStatList(entries) {
  const rows = Array.isArray(entries) ? entries : [];
  if (rows.length === 0) return "—";
  return rows
    .map((entry) => {
      const name = String(entry?.player_name || "").trim() || "Unknown";
      const qty = Number(entry?.quantity || 1);
      return qty > 1 ? `${name} (${qty})` : name;
    })
    .join(", ");
}

function showHomeLoading() {
  const tbody = document.getElementById("standings-tbody");
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="7" class="home-api-status home-api-status--loading">Loading standings…</td></tr>`;
  }
  const upcomingStack = document.getElementById("upcoming-stack");
  if (upcomingStack) {
    upcomingStack.innerHTML = `<p class="form__hint home-api-status home-api-status--loading">Loading upcoming fixtures…</p>`;
  }
  const resultStack = document.getElementById("fixture-results-stack");
  if (resultStack) {
    resultStack.innerHTML = `<p class="form__hint home-api-status home-api-status--loading">Loading fixtures…</p>`;
  }
  const track = document.getElementById("gallery-track");
  if (track) {
    track.innerHTML = `<p class="form__hint home-api-status home-api-status--loading" style="padding:1rem 1.25rem;margin:0">Loading gallery…</p>`;
  }
}

export async function loadPublicHomePage() {
  showHomeLoading();
  try {
    const [stRes, fxRes, phRes, statsRes] = await Promise.all([
      apiGet("/api/v1/standings"),
      apiGet("/api/v1/fixtures"),
      apiGet("/api/v1/photos"),
      apiGet("/api/v1/stats/home"),
    ]);
    renderStandings(stRes);
    renderUpcoming(fxRes);
    renderFixtureResults(fxRes);
    renderGallery(phRes);
    renderOverviewStrip(stRes, fxRes, statsRes);
  } catch {
    const failed = /** @type {{ ok: false, status: number, data: Record<string, unknown> }} */ ({
      ok: false,
      status: 0,
      data: {},
    });
    renderStandings(failed);
    renderUpcoming(failed);
    renderFixtureResults(failed);
    renderGallery(failed);
    renderOverviewStrip(failed, failed, failed);
  }
}

function renderOverviewStrip(stRes, fxRes, statsRes) {
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
    if (statsRes.ok && typeof statsRes.data.total_players === "number") {
      playersEl.textContent = String(statsRes.data.total_players);
    } else {
      playersEl.textContent = "—";
    }
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
      const logoUrl = typeof r.club_photo_url === "string" ? resolveBackendPublicFileUrl(r.club_photo_url) : "";
      const clubMark = logoUrl
        ? `<img class="club-logo" src="${escapeHtml(logoUrl)}" alt="${escapeHtml(name)} logo" loading="lazy" />`
        : `<span class="club-badge ${badge}" aria-hidden="true">${ini}</span>`;
      return `<tr>
        <td>${String(r.rank).padStart(2, "0")}</td>
        <td><span class="club-cell">${clubMark} ${escapeHtml(name)}</span></td>
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

function renderUpcoming(res) {
  const stack = document.getElementById("upcoming-stack");
  if (!stack) return;

  if (!res.ok) {
    const line =
      res.status === 0 ? "Upcoming fixtures unavailable (network error)." : "Upcoming fixtures unavailable.";
    stack.innerHTML = `<p class="form__hint home-api-status">${line}</p>`;
    return;
  }

  const fixtures = /** @type {Record<string, unknown>[]} */ (res.data.fixtures || []);
  const upcoming = fixtures
    .filter((f) => String(f.status || "") === "upcoming")
    .sort(
      (a, b) =>
        String(a.match_date || "").localeCompare(String(b.match_date || "")) ||
        String(a.match_time || "").localeCompare(String(b.match_time || "")),
    )
    .slice(0, 2);

  if (upcoming.length === 0) {
    stack.innerHTML = `<p class="form__hint home-api-status">No upcoming fixtures yet.</p>`;
    return;
  }

  stack.innerHTML = upcoming
    .map((f, i) => {
      const cardClass = "fixture-card fixture-card--upcoming";
      const homeClub = f.home_club && /** @type {{club_name:string, club_photo_url?:string|null}} */ (f.home_club);
      const awayClub = f.away_club && /** @type {{club_name:string, club_photo_url?:string|null}} */ (f.away_club);
      const hn = homeClub?.club_name;
      const an = awayClub?.club_name;
      const hLogo = homeClub?.club_photo_url ? resolveBackendPublicFileUrl(String(homeClub.club_photo_url)) : "";
      const aLogo = awayClub?.club_photo_url ? resolveBackendPublicFileUrl(String(awayClub.club_photo_url)) : "";
      const lg = f.league && /** @type {{name:string}} */ (f.league).name;
      const badgeH = BADGE_MOD[i % BADGE_MOD.length];
      const badgeA = BADGE_MOD[(i + 1) % BADGE_MOD.length];
      const metaPill = `<span class="pill pill--on-dark">Upcoming</span>`;
      const scoreBlock = `<div class="fixture-score"><span class="fixture-score__vs">vs</span><span class="fixture-score__ft">${formatTime(String(f.match_time))}</span></div>`;
      const venue =
        f.venue && String(f.venue).trim()
          ? `<p class="fixture-card__venue"><span aria-hidden="true">📍</span> ${escapeHtml(String(f.venue))}</p>`
          : "";
      const btnClass = "btn btn--block btn--gold";
      const btnLabel = "Match preview";
      return `<article class="${cardClass}">
        <div class="fixture-card__meta">
          ${metaPill}
          <time datetime="${escapeHtml(String(f.match_date))}">${escapeHtml(formatDate(String(f.match_date)))}</time>
          ${lg ? `<span class="pill">${escapeHtml(lg)}</span>` : ""}
        </div>
        <div class="fixture-card__scoreboard">
          <div class="fixture-team">
            ${
              hLogo
                ? `<img class="club-logo" src="${escapeHtml(hLogo)}" alt="${escapeHtml(String(hn || "Home club"))} logo" loading="lazy" />`
                : `<span class="club-badge club-badge--ghost ${badgeH}" aria-hidden="true">${escapeHtml(initials(hn))}</span>`
            }
            <span class="fixture-team__name">${escapeHtml(String(hn))}</span>
          </div>
          ${scoreBlock}
          <div class="fixture-team">
            ${
              aLogo
                ? `<img class="club-logo" src="${escapeHtml(aLogo)}" alt="${escapeHtml(String(an || "Away club"))} logo" loading="lazy" />`
                : `<span class="club-badge club-badge--ghost ${badgeA}" aria-hidden="true">${escapeHtml(initials(an))}</span>`
            }
            <span class="fixture-team__name">${escapeHtml(String(an))}</span>
          </div>
        </div>
        ${venue}
        <button type="button" class="${btnClass}" data-open-modal="modal-match-details" data-fixture-id="${f.id}">${btnLabel}</button>
      </article>`;
    })
    .join("");
}

function renderFixtureResults(res) {
  const stack = document.getElementById("fixture-results-stack");
  if (!stack) return;
  if (!res.ok) {
    const line = res.status === 0 ? "Fixtures unavailable (network error)." : "Fixtures unavailable.";
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
      const cardClass = "fixture-card";
      const homeClub = f.home_club && /** @type {{club_name:string, club_photo_url?:string|null}} */ (f.home_club);
      const awayClub = f.away_club && /** @type {{club_name:string, club_photo_url?:string|null}} */ (f.away_club);
      const hn = homeClub?.club_name;
      const an = awayClub?.club_name;
      const hLogo = homeClub?.club_photo_url ? resolveBackendPublicFileUrl(String(homeClub.club_photo_url)) : "";
      const aLogo = awayClub?.club_photo_url ? resolveBackendPublicFileUrl(String(awayClub.club_photo_url)) : "";
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
          <time datetime="${escapeHtml(String(f.match_date))}">${escapeHtml(formatDate(String(f.match_date)))}</time>
          ${lg ? `<span class="pill">${escapeHtml(lg)}</span>` : ""}
        </div>
        <div class="fixture-card__scoreboard">
          <div class="fixture-team">
            ${
              hLogo
                ? `<img class="club-logo" src="${escapeHtml(hLogo)}" alt="${escapeHtml(String(hn || "Home club"))} logo" loading="lazy" />`
                : `<span class="club-badge club-badge--ghost ${badgeH}" aria-hidden="true">${escapeHtml(initials(hn))}</span>`
            }
            <span class="fixture-team__name">${escapeHtml(String(hn))}</span>
          </div>
          ${scoreBlock}
          <div class="fixture-team">
            ${
              aLogo
                ? `<img class="club-logo" src="${escapeHtml(aLogo)}" alt="${escapeHtml(String(an || "Away club"))} logo" loading="lazy" />`
                : `<span class="club-badge club-badge--ghost ${badgeA}" aria-hidden="true">${escapeHtml(initials(an))}</span>`
            }
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
  setText("md-home-goals", "—");
  setText("md-away-goals", "—");
  setText("md-home-assists", "—");
  setText("md-away-assists", "—");
  setMatchStatRowsVisible(true);
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
  const isFinished = f.status === "finished" && f.home_score != null && f.away_score != null;
  setMatchStatRowsVisible(isFinished);

  if (isFinished) {
    setText("md-score", `${f.home_score} – ${f.away_score}`);
  } else if (f.status === "postponed") {
    setText("md-score", "Postponed");
  } else {
    setText("md-score", "—");
  }

  const stats = f.player_stats && typeof f.player_stats === "object" ? f.player_stats : {};
  const home = stats.home && typeof stats.home === "object" ? stats.home : {};
  const away = stats.away && typeof stats.away === "object" ? stats.away : {};
  setText("md-home-goals", formatPlayerStatList(home.goals));
  setText("md-away-goals", formatPlayerStatList(away.goals));
  setText("md-home-assists", formatPlayerStatList(home.assists));
  setText("md-away-assists", formatPlayerStatList(away.assists));

  if (hint) hint.hidden = true;
}

function setMatchStatRowsVisible(visible) {
  const rowIds = [
    "md-row-score",
    "md-row-home-goals",
    "md-row-away-goals",
    "md-row-home-assists",
    "md-row-away-assists",
  ];
  rowIds.forEach((id) => {
    const row = document.getElementById(id);
    if (row) row.hidden = !visible;
  });
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

/** @type {string | null} */
let certificatePdfRequestPath = null;

async function openCertificateFlow() {
  const dialog = document.getElementById("modal-certificate");
  if (!dialog?.showModal) return;

  hideGoalsAssists();
  certificatePdfRequestPath = null;

  const foot = document.getElementById("cert-foot-note");
  const dlBtn = document.getElementById("cert-btn-download");
  const title = document.getElementById("modal-cert-title");

  if (!getToken()) {
    if (dlBtn) dlBtn.disabled = true;
    if (foot) foot.textContent = "Sign in to view your certificate.";
    if (title) title.textContent = "Certificate of Participation";
    openModalById("modal-sign-in");
    const signInForm = document.getElementById("form-sign-in");
    if (signInForm) {
      setFormFeedback(signInForm, "Sing in to view achievements", "error");
    }
    return;
  }

  if (foot) foot.textContent = "Loading your certificate…";
  if (dlBtn) dlBtn.disabled = true;
  hideGoalsAssists();
  dialog.showModal();

  const res = await apiGet("/api/v1/certificates", { auth: true });
  if (!res.ok) {
    certificatePdfRequestPath = null;
    if (dlBtn) dlBtn.disabled = true;
    if (foot) foot.textContent = formatApiErrors(res.data, { status: res.status });
    if (title) title.textContent = "Certificate of Participation";
    setText("cert-dd-id", "—");
    setText("cert-dd-name", "—");
    setText("cert-dd-years", "—");
    setText("cert-dd-position", "—");
    setText("cert-dd-goals", "0");
    setText("cert-dd-assists", "0");
    return;
  }

  if (!Array.isArray(res.data.certificates) || res.data.certificates.length === 0) {
    certificatePdfRequestPath = null;
    if (dlBtn) dlBtn.disabled = true;
    if (foot) foot.textContent = "No certificate on file for your account yet.";
    if (title) title.textContent = "Certificate of Participation";
    setText("cert-dd-id", "—");
    setText("cert-dd-name", "—");
    setText("cert-dd-years", "—");
    setText("cert-dd-position", "—");
    setText("cert-dd-goals", "0");
    setText("cert-dd-assists", "0");
    return;
  }

  const c = /** @type {Record<string, unknown>} */ (res.data.certificates[0]);
  const rawId = c.id;
  const hasRecordId =
    rawId !== null &&
    rawId !== undefined &&
    rawId !== "" &&
    Number.isFinite(Number(rawId)) &&
    Number(rawId) > 0;

  if (hasRecordId) {
    certificatePdfRequestPath = `/api/v1/certificates/${Number(rawId)}/pdf`;
  } else {
    certificatePdfRequestPath = "/api/v1/certificates/profile-pdf";
  }

  if (dlBtn) dlBtn.disabled = false;
  if (foot) foot.textContent = "Official record — download PDF for your files.";
  if (title) title.textContent = String(c.title || "Certificate of Participation");

  const staffId = String(c.student_staff_id ?? "").trim();
  setText("cert-dd-id", staffId || "—");

  const fromApi = String(c.recipient_name ?? "").trim();
  if (fromApi && fromApi !== "Participant") {
    setText("cert-dd-name", fromApi);
  } else {
    setText("cert-dd-name", "—");
    await fillCertificateNameFromMe();
  }

  const startYear = Number(c.participate_year_start);
  const endYear = Number(c.participate_year_end);
  if (startYear > 0 && endYear > 0) {
    setText("cert-dd-years", `${startYear} – ${endYear}`);
  } else {
    setText("cert-dd-years", "—");
  }
  setText("cert-dd-position", String(c.positions_played ?? "").trim() || "—");

  const scored = Number(c.scored || 0);
  const assisted = Number(c.assisted || 0);
  setText("cert-dd-goals", String(scored));
  setText("cert-dd-assists", String(assisted));
}

function hideGoalsAssists() {
  setText("cert-dd-goals", "0");
  setText("cert-dd-assists", "0");
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
    if (!getToken() || !certificatePdfRequestPath) return;
    const foot = document.getElementById("cert-foot-note");
    const res = await fetch(`${API_BASE_URL}${certificatePdfRequestPath}`, {
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
    const cd = res.headers.get("content-disposition") || "";
    const m = cd.match(/filename="([^"]+)"/i);
    a.download = m?.[1] ? m[1] : "versity-certificate.pdf";
    a.click();
    URL.revokeObjectURL(url);
  });
}
