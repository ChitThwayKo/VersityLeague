import { API_BASE_URL } from "./config.js";
import {
  apiGet,
  apiPostForm,
  apiPostJson,
  clearFormFeedback,
  clearToken,
  formatApiErrors,
  getToken,
  setFormFeedback,
  setToken,
} from "./auth.js?v=20260417a";
import {
  initDay6ModalCapture,
  loadPublicHomePage,
  wireCertificateDownload,
} from "./public-home.js";
import { initGalleryCarousel, initModals, initNavigation, initPasswordToggles, openModalById } from "./ui.js";

initDay6ModalCapture();
wireCertificateDownload();

function getPasswordRequirementIssue(password) {
  const value = String(password || "");
  if (value.length < 8) return "Password must be at least 8 characters.";
  if (!/[A-Z]/.test(value)) return "Password must include at least one capital letter.";
  if (!/[a-z]/.test(value)) return "Password must include at least one small letter.";
  if (!/[0-9]/.test(value)) return "Password must include at least one number.";
  if (!/[^A-Za-z0-9]/.test(value)) return "Password must include at least one special character.";
  return "";
}

const CLUB_PLAYER_ROLES = ["Head Coach", "Assistant Coach", "Captain", "Vice Captain", "Player"];

function createPlayerRowHtml(index) {
  const roleOpts = CLUB_PLAYER_ROLES.map((role) => `<option value="${role}">${role}</option>`).join("");
  return `<tr data-player-row data-row-index="${index}" data-saved="0">
    <td class="club-register-row-no">${index + 1}</td>
    <td>
      <div class="club-register-photo-cell">
        <input type="file" class="club-register-player-photo" accept="image/*" />
        <img class="club-register-photo-preview" alt="Player photo preview" hidden />
        <span class="club-register-photo-fallback" hidden aria-hidden="true">&#128100;</span>
      </div>
    </td>
    <td><input type="text" class="club-register-player-ssid" maxlength="100" required /></td>
    <td><input type="text" class="club-register-player-name" maxlength="255" required /></td>
    <td><input type="text" class="club-register-player-position" maxlength="100" /></td>
    <td><input type="number" class="club-register-player-jersey" min="0" max="99999" /></td>
    <td>
      <select class="club-register-player-role" required>
        <option value="">Select role</option>
        ${roleOpts}
      </select>
    </td>
    <td>
      <div class="club-register-row-actions">
        <button type="button" class="btn btn--muted club-register-row-icon-btn js-player-save" title="Save" aria-label="Save">&#128190;</button>
        <button type="button" class="btn btn--muted club-register-row-icon-btn js-player-edit" title="Edit" aria-label="Edit" hidden>&#9998;</button>
        <button type="button" class="btn btn--muted club-register-row-icon-btn js-player-del" title="Delete" aria-label="Delete">&#128465;</button>
      </div>
    </td>
  </tr>`;
}

function initClubRegistrationForm() {
  const form = document.getElementById("form-club-register");
  if (!form) return;

  const tbody = document.getElementById("club-register-players-body");
  const addBtn = document.getElementById("btn-add-player-row");
  const seasonSelect = document.getElementById("club-register-season");
  const clubPhotoInput = form.querySelector('input[name="club_photo"]');
  const clubPreview = form.querySelector(".club-logo-picker__preview");
  const clubPlus = form.querySelector(".club-logo-picker__plus");

  if (!tbody || !addBtn || !seasonSelect) return;

  const rowElems = () => [...tbody.querySelectorAll("[data-player-row]")];
  const renumberRows = () => {
    rowElems().forEach((row, idx) => {
      row.dataset.rowIndex = String(idx);
      const no = row.querySelector(".club-register-row-no");
      if (no) no.textContent = String(idx + 1);
    });
  };
  const savedRows = () => rowElems().filter((row) => row.dataset.saved === "1");
  const rowRole = (row) => String(row.querySelector(".club-register-player-role")?.value || "");
  const rowSsid = (row) => String(row.querySelector(".club-register-player-ssid")?.value || "").trim();

  const refreshRoleValidationHint = () => {
    const roles = savedRows().map((row) => rowRole(row));
    const hc = roles.filter((r) => r === "Head Coach").length;
    const cp = roles.filter((r) => r === "Captain").length;
    if (hc === 1 && cp === 1) return "";
    return "Each team must have exactly one Head Coach and one Captain.";
  };

  const setRowMode = (row, saved) => {
    row.dataset.saved = saved ? "1" : "0";
    row.querySelectorAll("input, select").forEach((el) => {
      if (el.classList.contains("club-register-player-photo")) return;
      el.disabled = saved;
    });
    const photoInput = row.querySelector(".club-register-player-photo");
    if (photoInput) {
      photoInput.disabled = saved;
      photoInput.hidden = saved;
    }

    const saveBtn = row.querySelector(".js-player-save");
    const editBtn = row.querySelector(".js-player-edit");
    if (saveBtn) saveBtn.hidden = saved;
    if (editBtn) editBtn.hidden = !saved;
  };

  const updatePlayerPreview = (row) => {
    const input = row.querySelector(".club-register-player-photo");
    const img = row.querySelector(".club-register-photo-preview");
    const icon = row.querySelector(".club-register-photo-fallback");
    if (!(input instanceof HTMLInputElement) || !(img instanceof HTMLImageElement)) return;

    const file = input.files?.[0];
    if (file) {
      img.src = URL.createObjectURL(file);
      img.hidden = false;
      if (icon) icon.hidden = true;
    } else {
      img.removeAttribute("src");
      img.hidden = true;
      if (row.dataset.saved === "1" && icon) icon.hidden = false;
    }
  };

  const validateAndSaveRow = (row) => {
    const ssid = rowSsid(row);
    const name = String(row.querySelector(".club-register-player-name")?.value || "").trim();
    const role = rowRole(row);
    if (!ssid || !name || !role) return "Player ID, name, and role are required.";

    const duplicateSsid = rowElems().some((r) => r !== row && rowSsid(r) && rowSsid(r) === ssid);
    if (duplicateSsid) return "Student / staff ID must be unique per team.";

    const saved = savedRows().filter((r) => r !== row);
    const headCoachCount = saved.filter((r) => rowRole(r) === "Head Coach").length + (role === "Head Coach" ? 1 : 0);
    const captainCount = saved.filter((r) => rowRole(r) === "Captain").length + (role === "Captain" ? 1 : 0);
    if (headCoachCount > 1) return "Only one Head Coach is allowed.";
    if (captainCount > 1) return "Only one Captain is allowed.";

    setRowMode(row, true);
    updatePlayerPreview(row);
    return "";
  };

  const addRow = () => {
    const idx = rowElems().length;
    tbody.insertAdjacentHTML("beforeend", createPlayerRowHtml(idx));
  };

  const resetRegistrationUi = () => {
    tbody.innerHTML = "";
    addRow();
    if (clubPreview instanceof HTMLImageElement) {
      clubPreview.hidden = true;
      clubPreview.removeAttribute("src");
    }
    if (clubPlus) clubPlus.hidden = false;
  };

  if (clubPhotoInput instanceof HTMLInputElement) {
    clubPhotoInput.addEventListener("change", () => {
      const file = clubPhotoInput.files?.[0];
      if (!file || !(clubPreview instanceof HTMLImageElement)) {
        if (clubPreview instanceof HTMLImageElement) {
          clubPreview.hidden = true;
          clubPreview.removeAttribute("src");
        }
        if (clubPlus) clubPlus.hidden = false;
        return;
      }
      clubPreview.src = URL.createObjectURL(file);
      clubPreview.hidden = false;
      if (clubPlus) clubPlus.hidden = true;
    });
  }

  addBtn.addEventListener("click", () => addRow());

  tbody.addEventListener("change", (e) => {
    const row = /** @type {HTMLElement | null} */ (e.target instanceof Element ? e.target.closest("[data-player-row]") : null);
    if (!row) return;
    if (e.target instanceof Element && e.target.classList.contains("club-register-player-photo")) {
      updatePlayerPreview(row);
    }
  });

  tbody.addEventListener("click", (e) => {
    const row = /** @type {HTMLElement | null} */ (e.target instanceof Element ? e.target.closest("[data-player-row]") : null);
    if (!row) return;
    const saveBtn = /** @type {HTMLElement | null} */ (e.target instanceof Element ? e.target.closest(".js-player-save") : null);
    const editBtn = /** @type {HTMLElement | null} */ (e.target instanceof Element ? e.target.closest(".js-player-edit") : null);
    const delBtn = /** @type {HTMLElement | null} */ (e.target instanceof Element ? e.target.closest(".js-player-del") : null);

    if (saveBtn) {
      const issue = validateAndSaveRow(row);
      if (issue) {
        setFormFeedback(form, issue, "error");
      } else {
        clearFormFeedback(form);
      }
      return;
    }
    if (editBtn) {
      setRowMode(row, false);
      const icon = row.querySelector(".club-register-photo-fallback");
      if (icon) icon.hidden = true;
      return;
    }
    if (delBtn) {
      row.remove();
      if (rowElems().length === 0) addRow();
      renumberRows();
      const roleHint = refreshRoleValidationHint();
      if (roleHint) setFormFeedback(form, roleHint, "error");
      else clearFormFeedback(form);
    }
  });

  const loadActiveSeasons = async () => {
    seasonSelect.innerHTML = '<option value="">Loading active season...</option>';
    const { ok, data } = await apiGet("/api/v1/leagues/active");
    if (!ok || !Array.isArray(data.leagues) || data.leagues.length === 0) {
      seasonSelect.innerHTML = '<option value="">No active season available</option>';
      return;
    }
    seasonSelect.innerHTML = data.leagues
      .map((l) => `<option value="${l.id}">${String(l.name || "Season")} (${String(l.year || "—")})</option>`)
      .join("");
  };

  void loadActiveSeasons();
  form.addEventListener("reset", () => {
    window.setTimeout(() => {
      resetRegistrationUi();
    }, 0);
  });
  resetRegistrationUi();
}

/** Public `index.html` -> `frontend/admin/index.html` when admin signs in. */
function resolveAdminDashboardUrl() {
  try {
    if (typeof import.meta !== "undefined" && import.meta.url) {
      const m = new URL(import.meta.url);
      const p = m.pathname.replace(/\\/g, "/");
      if (/\/frontend\/js\/main\.js$/i.test(p)) {
        m.pathname = p.replace(/\/frontend\/js\/main\.js$/i, "/frontend/admin/adminDashboard.html");
        m.search = "";
        m.hash = "";
        return m.toString();
      }
    }
  } catch {
    /* ignore */
  }

  try {
    const u = new URL(window.location.href);
    if (u.pathname.includes("/frontend")) {
      if (/\/frontend\/?$/i.test(u.pathname)) {
        u.pathname = u.pathname.replace(/\/frontend\/?$/i, "/frontend/admin/adminDashboard.html");
      } else {
        u.pathname = u.pathname.replace(/\/frontend\/[^/]+$/i, "/frontend/admin/adminDashboard.html");
      }
      u.search = "";
      u.hash = "";
      return u.toString();
    }
  } catch {
    /* ignore */
  }
  return new URL("frontend/admin/adminDashboard.html", window.location.href).toString();
}

/** Block opening club registration when not signed in; offer sign-in modal first. */
function initRegistrationGuard() {
  document.addEventListener(
    "click",
    (e) => {
      const opener = e.target.closest('[data-open-modal="modal-club-register"]');
      if (!opener) return;
      if (getToken()) return;
      e.preventDefault();
      e.stopPropagation();
      openModalById("modal-sign-in");
      const form = document.getElementById("form-sign-in");
      if (form) {
        setFormFeedback(form, "Sign in with a client account to register your club.", "error");
      }
    },
    true
  );
}

function setAuthChromeMode(mode) {
  const guestBlocks = document.querySelectorAll('[data-auth-state="guest"]');
  const userBlocks = document.querySelectorAll('[data-auth-state="signed-in"]');
  const idEls = document.querySelectorAll(".js-header-user-id");

  if (mode === "signed-in") {
    guestBlocks.forEach((el) => {
      el.hidden = true;
    });
    userBlocks.forEach((el) => {
      el.hidden = false;
    });
  } else {
    guestBlocks.forEach((el) => {
      el.hidden = false;
    });
    userBlocks.forEach((el) => {
      el.hidden = true;
    });
    idEls.forEach((el) => {
      el.textContent = "";
    });
  }
}

async function applyAuthChrome() {
  if (!getToken()) {
    document.querySelectorAll(".js-admin-dashboard").forEach((el) => {
      el.hidden = true;
    });
    setAuthChromeMode("guest");
    return;
  }

  const { ok, data } = await apiGet("/api/v1/auth/me", { auth: true });
  if (!ok || !data.user) {
    clearToken();
    document.querySelectorAll(".js-admin-dashboard").forEach((el) => {
      el.hidden = true;
    });
    setAuthChromeMode("guest");
    return;
  }

  const u = /** @type {{ student_staff_id?: string; role?: string }} */ (data.user);
  const idText = u.student_staff_id ? String(u.student_staff_id) : "—";
  document.querySelectorAll(".js-header-user-id").forEach((el) => {
    el.textContent = idText;
  });
  const role = String(u.role || "");
  const isLeagueAdmin = role === "admin" || role === "default_admin";
  document.querySelectorAll(".js-admin-dashboard").forEach((el) => {
    el.hidden = !isLeagueAdmin;
  });
  setAuthChromeMode("signed-in");
}

function wireAuthModalSwitches() {
  document.getElementById("switch-signin-to-signup")?.addEventListener("click", () => {
    document.getElementById("modal-sign-in")?.close();
    openModalById("modal-sign-up");
  });
  document.getElementById("switch-signup-to-signin")?.addEventListener("click", () => {
    document.getElementById("modal-sign-up")?.close();
    openModalById("modal-sign-in");
  });
}

function hasPortalValidationErrors(data) {
  const p = data?.errors?.portal;
  return Array.isArray(p) && p.length > 0;
}

function isAdminRole(role) {
  return role === "admin" || role === "default_admin";
}

async function resolveSignedInUserRole(loginData) {
  const user = loginData?.user && typeof loginData.user === "object" ? loginData.user : null;
  const role = user && "role" in user ? String(/** @type {{ role: string }} */ (user).role) : "";
  if (role) return role;

  const me = await apiGet("/api/v1/auth/me", { auth: true });
  if (!me.ok || !me.data?.user || typeof me.data.user !== "object") return "";
  return "role" in me.data.user ? String(/** @type {{ role: string }} */ (me.data.user).role) : "";
}

async function checkApiHealth() {
  const url = `${API_BASE_URL}/api/v1/health`;
  try {
    const res = await fetch(url);
    if (!res.ok) return;
    const data = await res.json();
    console.info("[Versity League] API:", data);
  } catch {
    // Backend may be offline during static-only development.
  }
}

async function runPublicSignIn() {
  const signIn = document.getElementById("form-sign-in");
  if (!signIn) return;
  if (!/** @type {HTMLFormElement} */ (signIn).reportValidity()) return;
  clearFormFeedback(signIn);
  const fd = new FormData(/** @type {HTMLFormElement} */ (signIn));
  const body = {
    email: String(fd.get("email") || ""),
    password: String(fd.get("password") || ""),
    portal: "client",
  };
  try {
    let { ok, data, status } = await apiPostJson("/api/v1/auth/login", body, { auth: false });
    if (!ok && hasPortalValidationErrors(data)) {
      const second = await apiPostJson("/api/v1/auth/login", { ...body, portal: "admin" }, { auth: false });
      if (second.ok) {
        ok = second.ok;
        data = second.data;
        status = second.status;
      }
    }
    if (!ok) {
      setFormFeedback(signIn, formatApiErrors(data, { status }), "error");
      return;
    }
    if (data.token) setToken(data.token);
    const role = await resolveSignedInUserRole(data);
    if (isAdminRole(role)) {
      window.location.replace(resolveAdminDashboardUrl());
      return;
    }
    await applyAuthChrome();
    setFormFeedback(signIn, "Signed in successfully.", "success");
    signIn.closest("dialog")?.close();
    signIn.reset();
    clearFormFeedback(signIn);
    void loadPublicHomePage().then(() => initGalleryCarousel());
  } catch (err) {
    console.error(err);
    setFormFeedback(
      signIn,
      `Cannot reach the API (${API_BASE_URL}). Open the console for "[Versity League] API_BASE_URL" and fix the URL (versity-api-base meta in index.html if needed).`,
      "error",
    );
  }
}

function wireAuthForms() {
  const signIn = document.getElementById("form-sign-in");
  if (signIn) {
    document.getElementById("btn-public-sign-in")?.addEventListener("click", () => {
      void runPublicSignIn();
    });
    signIn.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        void runPublicSignIn();
      }
    });
  }

  const signUp = document.getElementById("form-sign-up");
  if (signUp) {
    signUp.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearFormFeedback(signUp);
      const fd = new FormData(signUp);
      const body = {
        name: String(fd.get("name") || ""),
        email: String(fd.get("email") || ""),
        student_staff_id: String(fd.get("student_staff_id") || ""),
        password: String(fd.get("password") || ""),
        password_confirmation: String(fd.get("password_confirmation") || ""),
      };
      const passwordIssue = getPasswordRequirementIssue(body.password);
      if (passwordIssue) {
        setFormFeedback(signUp, passwordIssue, "error");
        return;
      }
      if (body.password !== body.password_confirmation) {
        setFormFeedback(signUp, "Password confirmation does not match.", "error");
        return;
      }
      const { ok, data, status } = await apiPostJson("/api/v1/auth/register", body, { auth: false });
      if (!ok) {
        setFormFeedback(signUp, formatApiErrors(data, { status }), "error");
        return;
      }
      signUp.closest("dialog")?.close();
      signUp.reset();
      clearFormFeedback(signUp);

      const signInForm = document.getElementById("form-sign-in");
      openModalById("modal-sign-in");
      if (signInForm) {
        const emailInput = signInForm.querySelector('input[name="email"]');
        if (emailInput && body.email) emailInput.value = String(body.email);
        setFormFeedback(
          signInForm,
          "Account created. Please sign in with your email and password.",
          "success",
        );
      }
    });
  }

  document.querySelectorAll(".js-sign-out").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (getToken()) {
        await apiPostJson("/api/v1/auth/logout", {}, { auth: true });
      }
      clearToken();
      await applyAuthChrome();
      void loadPublicHomePage().then(() => initGalleryCarousel());
    });
  });

  const reg = document.getElementById("form-club-register");
  if (reg) {
    reg.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearFormFeedback(reg);
      if (!getToken()) {
        setFormFeedback(reg, "Please sign in first.", "error");
        openModalById("modal-sign-in");
        return;
      }
      const leagueId = String(reg.querySelector("#club-register-season")?.value || "").trim();
      const clubName = String(reg.querySelector('input[name="club_name"]')?.value || "").trim();
      const clubPhotoInput = reg.querySelector('input[name="club_photo"]');
      const clubPhotoFile = clubPhotoInput instanceof HTMLInputElement ? clubPhotoInput.files?.[0] : null;
      if (!leagueId) {
        setFormFeedback(reg, "Please select an active season.", "error");
        return;
      }
      if (!clubName) {
        setFormFeedback(reg, "Club name is required.", "error");
        return;
      }
      if (!clubPhotoFile) {
        setFormFeedback(reg, "Club logo is required.", "error");
        return;
      }

      const savedRows = [...reg.querySelectorAll('[data-player-row][data-saved="1"]')];
      if (savedRows.length < 2) {
        setFormFeedback(reg, "Save at least 2 players before submitting.", "error");
        return;
      }
      const roles = savedRows.map((row) => String(row.querySelector(".club-register-player-role")?.value || ""));
      const headCoachCount = roles.filter((r) => r === "Head Coach").length;
      const captainCount = roles.filter((r) => r === "Captain").length;
      if (headCoachCount !== 1 || captainCount !== 1) {
        setFormFeedback(reg, "Each team must have exactly one Head Coach and one Captain.", "error");
        return;
      }

      const fd = new FormData();
      fd.append("league_id", leagueId);
      fd.append("club_name", clubName);
      fd.append("club_photo", clubPhotoFile);
      savedRows.forEach((row, idx) => {
        const studentId = String(row.querySelector(".club-register-player-ssid")?.value || "").trim();
        const fullName = String(row.querySelector(".club-register-player-name")?.value || "").trim();
        const position = String(row.querySelector(".club-register-player-position")?.value || "").trim();
        const jersey = String(row.querySelector(".club-register-player-jersey")?.value || "").trim();
        const role = String(row.querySelector(".club-register-player-role")?.value || "").trim();
        const photoInput = row.querySelector(".club-register-player-photo");
        const photoFile = photoInput instanceof HTMLInputElement ? photoInput.files?.[0] : null;

        fd.append(`players[${idx}][student_staff_id]`, studentId);
        fd.append(`players[${idx}][full_name]`, fullName);
        fd.append(`players[${idx}][position]`, position);
        fd.append(`players[${idx}][role]`, role);
        if (jersey) fd.append(`players[${idx}][jersey_number]`, jersey);
        if (photoFile) fd.append(`players[${idx}][player_photo]`, photoFile);
      });
      const { ok, data, status } = await apiPostForm("/api/v1/club-registrations", fd);
      if (!ok) {
        setFormFeedback(reg, formatApiErrors(data, { status }), "error");
        return;
      }
      setFormFeedback(reg, String(data.message || "Registration submitted."), "success");
      reg.reset();
      reg.closest("dialog")?.close();
      clearFormFeedback(reg);
    });
  }
}

initRegistrationGuard();
initNavigation();
initModals();
initPasswordToggles();
initClubRegistrationForm();
wireAuthForms();
wireAuthModalSwitches();

document.querySelectorAll(".js-admin-dashboard").forEach((btn) => {
  btn.addEventListener("click", () => {
    window.location.assign(resolveAdminDashboardUrl());
  });
});

async function bootPublicSite() {
  await applyAuthChrome();
  checkApiHealth();
  await loadPublicHomePage();
  initGalleryCarousel();
}

void bootPublicSite();
