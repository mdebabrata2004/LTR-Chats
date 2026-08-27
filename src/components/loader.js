/**
 * Loader — inline spinner, button loading, full-page overlay
 */

let styleReady = false;
let overlayEl = null;

function ensureStyles() {
  if (styleReady || document.getElementById("nx-loader-styles")) {
    styleReady = true;
    return;
  }
  const style = document.createElement("style");
  style.id = "nx-loader-styles";
  style.textContent = `
    .nx-spinner {
      width: 28px;
      height: 28px;
      border: 2.5px solid var(--border-subtle, rgba(255,255,255,0.12));
      border-top-color: var(--color-accent, #5b6af0);
      border-radius: 50%;
      animation: nx-spin 0.65s linear infinite;
      flex-shrink: 0;
      box-sizing: border-box;
    }
    .nx-spinner--sm { width: 16px; height: 16px; border-width: 2px; }
    .nx-spinner--lg { width: 40px; height: 40px; border-width: 3px; }

    .nx-loader-inline {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      color: var(--text-secondary, #aebac1);
      font-size: 14px;
    }

    .nx-loader-block {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 32px 16px;
      color: var(--text-secondary, #aebac1);
      font-size: 14px;
      min-height: 120px;
    }

    .nx-loader-overlay {
      position: fixed;
      inset: 0;
      z-index: 1100;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.35);
      backdrop-filter: blur(2px);
      -webkit-backdrop-filter: blur(2px);
    }
    .nx-loader-overlay[hidden] {
      display: none !important;
    }
    .nx-loader-overlay__card {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 14px;
      padding: 28px 32px;
      border-radius: 16px;
      background: var(--surface-1, #1f2933);
      color: var(--text-primary, #e9edef);
      box-shadow: 0 12px 40px rgba(0,0,0,0.35);
      min-width: 120px;
    }
    .nx-loader-overlay__text {
      font-size: 14px;
      font-weight: 500;
      color: var(--text-secondary, #aebac1);
    }

    .nx-btn-loading {
      position: relative;
      pointer-events: none;
      opacity: 0.85;
    }
    .nx-btn-loading .nx-btn-loading__label {
      opacity: 0;
    }
    .nx-btn-loading .nx-spinner {
      position: absolute;
      left: 50%;
      top: 50%;
      margin: -8px 0 0 -8px;
    }

    @keyframes nx-spin {
      to { transform: rotate(360deg); }
    }

    @media (prefers-reduced-motion: reduce) {
      .nx-spinner {
        animation-duration: 1.2s;
      }
    }
  `;
  document.head.appendChild(style);
  styleReady = true;
}

/**
 * Spinner element HTML
 * @param {"sm"|"md"|"lg"} [size="md"]
 */
export function spinnerHtml(size = "md") {
  ensureStyles();
  const cls =
    size === "sm"
      ? "nx-spinner nx-spinner--sm"
      : size === "lg"
        ? "nx-spinner nx-spinner--lg"
        : "nx-spinner";
  return `<div class="${cls}" role="status" aria-label="Loading"></div>`;
}

/**
 * Inline loader (spinner + optional text)
 */
export function inlineLoaderHtml(text = "Loading…") {
  ensureStyles();
  return `
    <div class="nx-loader-inline">
      ${spinnerHtml("sm")}
      <span>${escapeHtml(text)}</span>
    </div>
  `;
}

/**
 * Block centered loader for page sections
 */
export function blockLoaderHtml(text = "Loading…") {
  ensureStyles();
  return `
    <div class="nx-loader-block">
      ${spinnerHtml("md")}
      <span>${escapeHtml(text)}</span>
    </div>
  `;
}

/**
 * Show full-screen overlay
 * @param {string} [text]
 */
export function showLoader(text = "Loading…") {
  ensureStyles();
  if (!overlayEl) {
    overlayEl = document.createElement("div");
    overlayEl.className = "nx-loader-overlay";
    overlayEl.id = "nx-loader-overlay";
    document.body.appendChild(overlayEl);
  }
  overlayEl.hidden = false;
  overlayEl.innerHTML = `
    <div class="nx-loader-overlay__card">
      ${spinnerHtml("lg")}
      <div class="nx-loader-overlay__text">${escapeHtml(text)}</div>
    </div>
  `;
  return hideLoader;
}

/**
 * Hide full-screen overlay
 */
export function hideLoader() {
  if (overlayEl) {
    overlayEl.hidden = true;
    overlayEl.innerHTML = "";
  }
}

/**
 * Put spinner inside a button; returns restore fn
 * @param {HTMLButtonElement|null} btn
 * @param {string} [loadingText] — optional, keeps width via invisible label
 */
export function setButtonLoading(btn, loadingText) {
  if (!btn) return () => {};
  ensureStyles();

  if (btn.dataset.nxLoading === "1") {
    return () => {};
  }

  const originalHtml = btn.innerHTML;
  const originalDisabled = btn.disabled;
  btn.dataset.nxLoading = "1";
  btn.disabled = true;
  btn.classList.add("nx-btn-loading");

  if (loadingText) {
    btn.innerHTML = `
      <span class="nx-btn-loading__label">${escapeHtml(loadingText)}</span>
      ${spinnerHtml("sm")}
    `;
  } else {
    btn.innerHTML = `
      <span class="nx-btn-loading__label">${originalHtml}</span>
      ${spinnerHtml("sm")}
    `;
  }

  return () => {
    btn.dataset.nxLoading = "0";
    btn.disabled = originalDisabled;
    btn.classList.remove("nx-btn-loading");
    btn.innerHTML = originalHtml;
  };
}

/**
 * Wrap async fn with overlay loader
 * @param {() => Promise<any>} fn
 * @param {string} [text]
 */
export async function withLoader(fn, text = "Loading…") {
  showLoader(text);
  try {
    return await fn();
  } finally {
    hideLoader();
  }
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export default {
  spinnerHtml,
  inlineLoaderHtml,
  blockLoaderHtml,
  showLoader,
  hideLoader,
  setButtonLoading,
  withLoader,
};