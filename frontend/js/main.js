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
} from "./auth.js";
import {
  initDay6ModalCapture,
  loadPublicHomePage,
  wireCertificateDownload,
} from "./public-home.js";
import { initGalleryCarousel, initModals, initNavigation, openModalById } from "./ui.js";

initDay6ModalCapture();
wireCertificateDownload();

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
    setAuthChromeMode("guest");
    return;
  }

  const { ok, data } = await apiGet("/api/v1/auth/me", { auth: true });
  if (!ok || !data.user) {
    clearToken();
    setAuthChromeMode("guest");
    return;
  }

  const u = /** @type {{ student_staff_id?: string }} */ (data.user);
  const idText = u.student_staff_id ? String(u.student_staff_id) : "—";
  document.querySelectorAll(".js-header-user-id").forEach((el) => {
    el.textContent = idText;
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

function wireAuthForms() {
  const signIn = document.getElementById("form-sign-in");
  if (signIn) {
    signIn.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearFormFeedback(signIn);
      const fd = new FormData(signIn);
      const body = {
        email: String(fd.get("email") || ""),
        password: String(fd.get("password") || ""),
        portal: String(fd.get("portal") || "client"),
      };
      const { ok, data, status } = await apiPostJson("/api/v1/auth/login", body, { auth: false });
      if (!ok) {
        setFormFeedback(signIn, formatApiErrors(data, { status }), "error");
        return;
      }
      if (data.token) setToken(data.token);
      await applyAuthChrome();
      setFormFeedback(signIn, "Signed in successfully.", "success");
      signIn.closest("dialog")?.close();
      signIn.reset();
      clearFormFeedback(signIn);
      void loadPublicHomePage().then(() => initGalleryCarousel());
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
      const fd = new FormData(reg);
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
wireAuthForms();
wireAuthModalSwitches();
void applyAuthChrome();
checkApiHealth();
void loadPublicHomePage().then(() => initGalleryCarousel());
