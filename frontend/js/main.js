import { API_BASE_URL } from "./config.js";
import {
  apiPostForm,
  apiPostJson,
  clearFormFeedback,
  formatApiErrors,
  getToken,
  setFormFeedback,
  setToken,
} from "./auth.js";
import { initGalleryCarousel, initModals, initNavigation, openModalById } from "./ui.js";

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
      const { ok, data } = await apiPostJson("/api/v1/auth/login", body, { auth: false });
      if (!ok) {
        setFormFeedback(signIn, formatApiErrors(data), "error");
        return;
      }
      if (data.token) setToken(data.token);
      setFormFeedback(signIn, "Signed in successfully.", "success");
      signIn.closest("dialog")?.close();
      signIn.reset();
      clearFormFeedback(signIn);
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
      const { ok, data } = await apiPostJson("/api/v1/auth/register", body, { auth: false });
      if (!ok) {
        setFormFeedback(signUp, formatApiErrors(data), "error");
        return;
      }
      if (data.token) setToken(data.token);
      setFormFeedback(signUp, "Account created. You are signed in.", "success");
      signUp.closest("dialog")?.close();
      signUp.reset();
      clearFormFeedback(signUp);
    });
  }

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
      const { ok, data } = await apiPostForm("/api/v1/club-registrations", fd);
      if (!ok) {
        setFormFeedback(reg, formatApiErrors(data), "error");
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
initGalleryCarousel();
wireAuthForms();
checkApiHealth();
