/**
 * Modern Toast — Telegram Style with Glassmorphism
 * Uses Bootstrap Icons
 */

let container = null;

const ICONS = {
  success: "bi-check-circle-fill",
  error:   "bi-exclamation-circle-fill",
  warning: "bi-exclamation-triangle-fill",
  info:    "bi-info-circle-fill",
  default: "",
};

const COLORS = {
  success: "#3ddc84",
  error:   "#ff6b6b",
  warning: "#ffd93d",
  info:    "#60b4ff",
  default: null,
};

function getContainer() {
  if (!container || !document.body.contains(container)) {
    container = document.getElementById("toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "toast-container";
      container.className = "toast-container";
      container.setAttribute("aria-live", "polite");
      document.body.appendChild(container);
    }
  }
  ensureStyles();
  return container;
}

function ensureStyles() {
  if (document.getElementById("toast-styles")) return;
  const style = document.createElement("style");
  style.id = "toast-styles";
  style.textContent = `
    .toast-container {
      position: fixed;
      left: 50%;
      bottom: calc(28px + env(safe-area-inset-bottom, 0px));
      transform: translateX(-50%);
      z-index: 9999;
      display: flex;
      flex-direction: column-reverse;
      align-items: center;
      gap: 10px;
      pointer-events: none;
      width: max-content;
      max-width: min(440px, calc(100vw - 32px));
    }

    @media (min-width: 900px) {
      .toast-container { bottom: 36px; }
    }

    .toast {
      pointer-events: auto;
      position: relative;
      display: flex;
      align-items: center;
      gap: 12px;
      min-height: 48px;
      padding: 12px 18px 12px 14px;
      border-radius: 16px;
      overflow: hidden;

      /* Glassmorphism */
      background: rgba(30, 36, 48, 0.72);
      backdrop-filter: blur(20px) saturate(1.6);
      -webkit-backdrop-filter: blur(20px) saturate(1.6);
      border: 1px solid rgba(255, 255, 255, 0.08);
      box-shadow:
        0 8px 32px rgba(0, 0, 0, 0.4),
        inset 0 1px 0 rgba(255, 255, 255, 0.07);

      color: #e8eaf0;
      font-size: 14px;
      font-weight: 500;
      line-height: 1.4;
      letter-spacing: 0.01em;
      cursor: pointer;
      max-width: 100%;
      animation: toast-in 0.28s cubic-bezier(0.18, 1.1, 0.35, 1) both;
      will-change: transform, opacity;
    }

    /* Subtle left glow accent */
    .toast::before {
      content: "";
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 3px;
      border-radius: 16px 0 0 16px;
      background: var(--toast-accent, transparent);
    }

    /* Shimmer gloss overlay */
    .toast::after {
      content: "";
      position: absolute;
      inset: 0;
      background: linear-gradient(
        135deg,
        rgba(255,255,255,0.06) 0%,
        transparent 60%
      );
      pointer-events: none;
      border-radius: inherit;
    }

    .toast--success { --toast-accent: #3ddc84; }
    .toast--error   { --toast-accent: #ff6b6b; }
    .toast--warning { --toast-accent: #ffd93d; }
    .toast--info    { --toast-accent: #60b4ff; }

    .toast__icon {
      font-size: 1.2rem;
      flex-shrink: 0;
      filter: drop-shadow(0 0 6px var(--toast-accent, transparent));
    }
    .toast--success .toast__icon { color: #3ddc84; }
    .toast--error   .toast__icon { color: #ff6b6b; }
    .toast--warning .toast__icon { color: #ffd93d; }
    .toast--info    .toast__icon { color: #60b4ff; }

    .toast__text {
      flex: 1;
      min-width: 0;
      word-break: break-word;
    }

    /* Progress bar */
    .toast__progress {
      position: absolute;
      bottom: 0;
      left: 0;
      height: 2px;
      width: 100%;
      background: var(--toast-accent, rgba(255,255,255,0.2));
      opacity: 0.5;
      transform-origin: left;
      border-radius: 0 0 16px 16px;
      animation: toast-progress linear both;
      animation-duration: var(--toast-duration, 2800ms);
    }

    .toast.is-leaving {
      animation: toast-out 0.2s ease forwards;
    }
    .toast.is-leaving .toast__progress {
      animation-play-state: paused;
    }

    @keyframes toast-in {
      from { opacity: 0; transform: translateY(16px) scale(0.92); filter: blur(4px); }
      to   { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
    }
    @keyframes toast-out {
      from { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
      to   { opacity: 0; transform: translateY(10px) scale(0.94); filter: blur(3px); }
    }
    @keyframes toast-progress {
      from { transform: scaleX(1); }
      to   { transform: scaleX(0); }
    }
  `;
  document.head.appendChild(style);
}

/**
 * @param {string} message
 * @param {{ duration?: number, type?: "success"|"error"|"warning"|"info"|"default" }} [options]
 */
export function showToast(message, options = {}) {
  const duration = options.duration ?? 2800;
  const type = options.type || "default";
  const parent = getContainer();
  if (!parent || !message) return;

  // Max 3 toasts
  while (parent.children.length >= 3) {
    const oldest = parent.firstChild;
    if (oldest) {
      oldest.classList.add("is-leaving");
      setTimeout(() => oldest.remove(), 200);
      break;
    }
  }

  const el = document.createElement("div");
  el.className = "toast" + (type !== "default" ? ` toast--${type}` : "");
  el.setAttribute("role", "status");
  el.style.setProperty("--toast-duration", `${duration}ms`);

  const iconClass = ICONS[type] || "";
  el.innerHTML = `
    ${iconClass ? `<i class="bi ${iconClass} toast__icon" aria-hidden="true"></i>` : ""}
    <span class="toast__text"></span>
    <div class="toast__progress"></div>
  `;
  el.querySelector(".toast__text").textContent = String(message);

  const remove = () => {
    if (el._removed) return;
    el._removed = true;
    clearTimeout(el._timer);
    el.classList.add("is-leaving");
    setTimeout(() => el.remove(), 200);
  };

  el.addEventListener("click", remove);
  parent.appendChild(el);
  el._timer = setTimeout(remove, duration);

  return remove;
}

export function showSuccess(message, opts) {
  return showToast(message, { ...opts, type: "success" });
}

export function showError(message, opts) {
  return showToast(message, { ...opts, type: "error", duration: opts?.duration ?? 3500 });
}

export function showWarning(message, opts) {
  return showToast(message, { ...opts, type: "warning" });
}

export function showInfo(message, opts) {
  return showToast(message, { ...opts, type: "info" });
}

export default { showToast, showSuccess, showError, showWarning, showInfo };