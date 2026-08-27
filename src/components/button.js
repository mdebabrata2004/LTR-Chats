/**
 * Button helpers — HTML, loading state, variants
 * Self-contained (no broken imports from loader.js)
 */

let styleReady = false;

function ensureSpinnerStyles() {
  if (document.getElementById("nx-loader-styles")) return;
  const s = document.createElement("style");
  s.id = "nx-loader-styles";
  s.textContent = `
    .nx-spinner {
      width: 28px;
      height: 28px;
      border: 2.5px solid var(--border-subtle, rgba(255,255,255,0.12));
      border-top-color: var(--color-accent, #5b6af0);
      border-radius: 50%;
      animation: nx-spin 0.65s linear infinite;
      box-sizing: border-box;
      flex-shrink: 0;
    }
    .nx-spinner--sm {
      width: 16px;
      height: 16px;
      border-width: 2px;
    }
    @keyframes nx-spin {
      to { transform: rotate(360deg); }
    }
    @media (prefers-reduced-motion: reduce) {
      .nx-spinner { animation-duration: 1.2s; }
    }
  `;
  document.head.appendChild(s);
}

export function ensureButtonStyles() {
  if (styleReady || document.getElementById("nx-btn-styles")) {
    styleReady = true;
    return;
  }

  ensureSpinnerStyles();

  const style = document.createElement("style");
  style.id = "nx-btn-styles";
  style.textContent = `
    .nx-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      min-height: 40px;
      padding: 0 16px;
      border: none;
      border-radius: 10px;
      font-size: 14.5px;
      font-weight: 600;
      font-family: inherit;
      line-height: 1;
      cursor: pointer;
      user-select: none;
      -webkit-tap-highlight-color: transparent;
      transition: background 0.15s, opacity 0.15s, transform 0.1s;
      position: relative;
    }
    .nx-btn:active:not(:disabled) {
      transform: scale(0.98);
    }
    .nx-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .nx-btn--primary {
      background: var(--color-accent, #5b6af0);
      color: #fff;
    }
    .nx-btn--primary:hover:not(:disabled) {
      filter: brightness(1.06);
    }

    .nx-btn--secondary {
      background: var(--surface-2, rgba(255,255,255,0.08));
      color: var(--text-primary, #e9edef);
    }
    .nx-btn--secondary:hover:not(:disabled) {
      background: var(--surface-3, rgba(255,255,255,0.12));
    }

    .nx-btn--ghost {
      background: transparent;
      color: var(--text-secondary, #aebac1);
    }
    .nx-btn--ghost:hover:not(:disabled) {
      background: var(--surface-2, rgba(255,255,255,0.06));
      color: var(--text-primary, #e9edef);
    }

    .nx-btn--danger {
      background: var(--color-danger, #e53935);
      color: #fff;
    }
    .nx-btn--danger:hover:not(:disabled) {
      filter: brightness(1.05);
    }

    .nx-btn--block {
      width: 100%;
    }

    .nx-btn--sm {
      min-height: 32px;
      padding: 0 12px;
      font-size: 13px;
      border-radius: 8px;
    }

    .nx-btn--lg {
      min-height: 48px;
      padding: 0 20px;
      font-size: 16px;
      border-radius: 12px;
    }

    .nx-btn--icon {
      width: 40px;
      min-height: 40px;
      padding: 0;
      border-radius: 50%;
    }
    .nx-btn--icon.nx-btn--sm {
      width: 32px;
      min-height: 32px;
    }
    .nx-btn--icon.nx-btn--lg {
      width: 48px;
      min-height: 48px;
    }

    .nx-btn.is-loading {
      pointer-events: none;
    }
    .nx-btn.is-loading .nx-btn__label {
      opacity: 0;
    }
    .nx-btn.is-loading .nx-btn__spinner {
      position: absolute;
      left: 50%;
      top: 50%;
      margin: -8px 0 0 -8px;
    }

    .nx-btn__icon {
      font-size: 1.1em;
      line-height: 1;
      display: inline-flex;
    }
  `;
  document.head.appendChild(style);
  styleReady = true;
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function spinnerHtmlSafe() {
  ensureSpinnerStyles();
  return `<div class="nx-spinner nx-spinner--sm" role="status" aria-label="Loading"></div>`;
}

/**
 * Button HTML
 * @param {object} opts
 * @param {string} [opts.label]
 * @param {"primary"|"secondary"|"ghost"|"danger"} [opts.variant="primary"]
 * @param {"sm"|"md"|"lg"} [opts.size="md"]
 * @param {string} [opts.icon] bi name without prefix
 * @param {string} [opts.id]
 * @param {string} [opts.type="button"]
 * @param {boolean} [opts.block]
 * @param {boolean} [opts.iconOnly]
 * @param {boolean} [opts.disabled]
 * @param {string} [opts.className]
 * @param {string} [opts.ariaLabel]
 */
export function buttonHtml(opts = {}) {
  ensureButtonStyles();

  const variant = opts.variant || "primary";
  const size = opts.size || "md";
  const iconOnly = !!opts.iconOnly;

  const classes = [
    "nx-btn",
    `nx-btn--${variant}`,
    size !== "md" ? `nx-btn--${size}` : "",
    opts.block ? "nx-btn--block" : "",
    iconOnly ? "nx-btn--icon" : "",
    opts.className || "",
  ]
    .filter(Boolean)
    .join(" ");

  const icon = opts.icon
    ? `<i class="bi bi-${escapeHtml(opts.icon)} nx-btn__icon" aria-hidden="true"></i>`
    : "";

  const label = iconOnly
    ? icon
    : `${icon}<span class="nx-btn__label">${escapeHtml(opts.label || "")}</span>`;

  return `
    <button
      type="${escapeHtml(opts.type || "button")}"
      class="${classes}"
      ${opts.id ? `id="${escapeHtml(opts.id)}"` : ""}
      ${opts.disabled ? "disabled" : ""}
      ${opts.ariaLabel ? `aria-label="${escapeHtml(opts.ariaLabel)}"` : ""}
    >${label}</button>
  `;
}

/** Icon-only button */
export function iconButtonHtml(opts = {}) {
  return buttonHtml({
    ...opts,
    iconOnly: true,
    ariaLabel: opts.ariaLabel || opts.label || "Button",
  });
}

/**
 * Loading state on a button — returns restore()
 * @param {HTMLButtonElement|null} btn
 */
export function setButtonLoading(btn) {
  if (!btn) return () => {};
  ensureButtonStyles();

  if (btn.classList.contains("is-loading")) {
    return () => {};
  }

  const originalHtml = btn.innerHTML;
  const wasDisabled = btn.disabled;

  btn.classList.add("is-loading");
  btn.disabled = true;
  btn.innerHTML = `
    <span class="nx-btn__label">${originalHtml}</span>
    <span class="nx-btn__spinner">${spinnerHtmlSafe()}</span>
  `;

  return () => {
    btn.classList.remove("is-loading");
    btn.disabled = wasDisabled;
    btn.innerHTML = originalHtml;
  };
}

/**
 * Async click + auto loading
 * @param {HTMLButtonElement|null} btn
 * @param {(e: Event) => Promise<void>} handler
 */
export function bindAsyncClick(btn, handler) {
  if (!btn || typeof handler !== "function") return () => {};

  const onClick = async (e) => {
    e.preventDefault();
    if (btn.disabled || btn.classList.contains("is-loading")) return;
    const restore = setButtonLoading(btn);
    try {
      await handler(e);
    } catch (err) {
      console.error(err);
      throw err;
    } finally {
      restore();
    }
  };

  btn.addEventListener("click", onClick);
  return () => btn.removeEventListener("click", onClick);
}

export default {
  ensureButtonStyles,
  buttonHtml,
  iconButtonHtml,
  setButtonLoading,
  bindAsyncClick,
};