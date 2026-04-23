/**
 * Modals (dialog), mobile nav, gallery carousel, in-page nav scroll.
 */

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

export function initNavigation() {
  const header = document.querySelector(".site-header");
  const toggle = document.querySelector(".nav-toggle");
  const panel = document.getElementById("nav-panel");
  if (!toggle || !panel) return;

  const setOpen = (open) => {
    panel.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    document.body.classList.toggle("nav-open", open);
  };

  toggle.addEventListener("click", () => setOpen(!panel.classList.contains("is-open")));

  panel.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", () => setOpen(false));
  });

  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", (e) => {
      const id = anchor.getAttribute("href");
      if (!id || id === "#") return;
      const el = document.querySelector(id);
      if (!el) return;
      e.preventDefault();
      const top = header
        ? el.getBoundingClientRect().top + window.scrollY - header.offsetHeight
        : el.offsetTop;
      window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    });
  });
}

export function initModals() {
  const dialogs = document.querySelectorAll("dialog.modal");
  let removeTrap = () => {};

  const attachTrap = (dialog) => {
    removeTrap();
    const focusables = [...dialog.querySelectorAll(FOCUSABLE)].filter(
      (el) => !el.hasAttribute("disabled")
    );
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const onKey = (e) => {
      if (e.key !== "Tab") return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    dialog.addEventListener("keydown", onKey);
    removeTrap = () => dialog.removeEventListener("keydown", onKey);
  };

  dialogs.forEach((dialog) => {
    dialog.addEventListener("click", (e) => {
      if (e.target === dialog) dialog.close();
    });
    dialog.addEventListener("close", () => {
      removeTrap();
      removeTrap = () => {};
    });
  });

  document.querySelectorAll("[data-open-modal]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-open-modal");
      const dialog = id ? document.getElementById(id) : null;
      if (!dialog || typeof dialog.showModal !== "function") return;
      dialog.showModal();
      attachTrap(dialog);
      const closeBtn = dialog.querySelector(".modal__close");
      (closeBtn || dialog).focus();
    });
  });

  document.querySelectorAll("[data-close-modal]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const dialog = btn.closest("dialog");
      dialog?.close();
    });
  });
}

export function openModalById(id) {
  const dialog = document.getElementById(id);
  if (dialog && typeof dialog.showModal === "function") {
    dialog.showModal();
  }
}

export function initPasswordToggles() {
  const fields = document.querySelectorAll('input[type="password"]');
  fields.forEach((input) => {
    if (!(input instanceof HTMLInputElement)) return;
    if (input.dataset.pwToggleBound === "1") return;
    input.dataset.pwToggleBound = "1";

    const wrapper = document.createElement("div");
    wrapper.className = "password-field";
    input.parentNode?.insertBefore(wrapper, input);
    wrapper.appendChild(input);

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "password-toggle";
    toggle.setAttribute("aria-label", "Show password");
    toggle.setAttribute("title", "Show password");
    toggle.innerHTML = "&#128065;";
    wrapper.appendChild(toggle);

    toggle.addEventListener("click", () => {
      const revealing = input.type === "password";
      input.type = revealing ? "text" : "password";
      toggle.setAttribute("aria-label", revealing ? "Hide password" : "Show password");
      toggle.setAttribute("title", revealing ? "Hide password" : "Show password");
    });
  });
}

export function initGalleryCarousel() {
  const track = document.querySelector(".gallery__track");
  const prev = document.querySelector("[data-gallery-prev]");
  const next = document.querySelector("[data-gallery-next]");
  if (!track || !prev || !next) return;

  if (prev.dataset.galleryBound === "1") {
    return;
  }
  prev.dataset.galleryBound = "1";
  next.dataset.galleryBound = "1";

  const slideWidth = () => {
    const card = track.querySelector(".gallery__slide");
    const gap = 24;
    return card ? card.offsetWidth + gap : 320;
  };

  prev.addEventListener("click", () => {
    track.scrollBy({ left: -slideWidth(), behavior: "smooth" });
  });
  next.addEventListener("click", () => {
    track.scrollBy({ left: slideWidth(), behavior: "smooth" });
  });
}
