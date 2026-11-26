/**
 * opening.js — Quiet first-visit greeting overlay controller.
 * Skipped on repeat visits in session, mobile (<640px), or prefers-reduced-motion.
 */
const SESSION_KEY = "portfolio-opening-seen";

export function initOpening(overlay, durationMs = 3200) {
  if (!overlay) return;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const mobile = window.innerWidth < 640;

  let seen = false;
  try {
    seen = sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    seen = false;
  }

  if (reduced || mobile || seen) {
    overlay.remove();
    document.documentElement.classList.remove("opening-pending");
    return;
  }

  let closed = false;
  let timer = null;

  function dismiss() {
    if (closed) return;
    closed = true;
    clearTimeout(timer);
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      // ignore storage errors
    }
    overlay.classList.add("is-fading");
    document.documentElement.classList.remove("opening-pending");
    window.setTimeout(() => {
      overlay.remove();
    }, 650);
  }

  const skipBtn = overlay.querySelector("[data-opening-skip]");
  if (skipBtn) {
    skipBtn.addEventListener("click", dismiss);
  }

  // Reveal lines smoothly, then fade into home page
  requestAnimationFrame(() => {
    overlay.classList.add("is-visible");
  });

  timer = window.setTimeout(dismiss, durationMs);
}
