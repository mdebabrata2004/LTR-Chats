/**
 * Modal / bottom-sheet overlays
 * Usage:
 *   openModal({ title, body, actions })
 *   confirmDialog({ title, message }) → Promise<boolean>
 */

let styleReady = false;
let openCount = 0;

function ensureStyles() {
  if (styleReady || document.getElementById("nx-modal-styles")) {
    styleReady = true;
    return;
  }
  const style = document.createElement("style");
  style.id = "nx-modal-styles";
  style.textContent = `
    .nx-modal-root {
      position: fixed;
      inset: 0;
      z-index: 900;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      padding: 0;
    }
    @media (min-width: 600px) {
      .nx-modal-root {
        align-items: center;
        padding: 24px;
      }
    }
    .nx-modal-root[hidden] {
      display: none !important;
    }
    .nx-modal-backdrop {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.45);
      backdrop-filter: blur(2px);
      -webkit-backdrop-filter: blur(2px);
      animation: nx-fade-in 0.15s ease;
    }
    .nx-modal {
      position: relative;
      width: min(420px, 100%);
      max-height: min(90vh, 720px);
      display: flex;
      flex-direction: column;
      background: var(--surface-1, #1f2933);
      color: var(--text-primary, #e9edef);
      border-radius: 16px 16px 0 0;
      box-shadow: 0 16px 48px rgba(0, 0, 0, 0.4);
      animation: nx-sheet-up 0.2s cubic-bezier(0.2, 0.9, 0.3, 1);
      overflow: hidden;
    }
    @media (min-width: 600px) {
      .nx-modal {
        border-radius: 16px;
      }
    }
    .nx-modal__head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 14px 16px;
      border-bottom: 1px solid var(--border-subtle, rgba(255,255,255,0.08));
      flex-shrink: 0;
    }
    .nx-modal__title {
      font-size: 16px;
      font-weight: 600;
      margin: 0;
      flex: 1;
      min-width: 0;
    }
    .nx-modal__close {
      width: 36px;
      height: 36px;
      border: none;
      border-radius: 50%;
      background: transparent;
      color: inherit;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.1rem;
    }
    .nx-modal__close:hover {
      background: var(--surface-2, rgba(255,255,255,0.06));
    }
    .nx-modal__body {
      padding: 16px;
      overflow-y: auto;
      flex: 1 1 auto;
      min-height: 0;
      -webkit-overflow-scrolling: touch;
    }
    .nx-modal__foot {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      justify-content: flex-end;
      padding: 12px 16px;
      border-top: 1px solid var(--border-subtle, rgba(255,255,255,0.08));
      flex-shrink: 0;
      padding-bottom: max(12px, env(safe-area-inset-bottom));
    }
    .nx-modal__foot .btn {
      min-height: 40px;
      padding: 0 16px;
      border-radius: 10px;
      border: none;
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
    }
    .nx-modal__foot .btn--primary {
      background: var(--color-accent, #5b6af0);
      color: #fff;
    }
    .nx-modal__foot .btn--secondary {
      background: var(--surface-2, rgba(255,255,255,0.08));
      color: inherit;
    }
    .nx-modal__foot .btn--danger {
      background: var(--color-danger, #e53935);
      color: #fff;
    }
    .nx-modal__foot .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    @keyframes nx-fade-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes nx-sheet-up {
      from { opacity: 0.6; transform: translateY(16px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @media (min-width: 600px) {
      @keyframes nx-sheet-up {
        from { opacity: 0.6; transform: translateY(8px) scale(0.98); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
    }
  `;
  document.head.appendChild(style);
  styleReady = true;
}

function lockBody(lock) {
  if (lock) {
    openCount += 1;
    if (openCount === 1) {
      document.body.dataset.nxScrollY = String(window.scrollY || 0);
      document.body.style.overflow = "hidden";
    }
  } else {
    openCount = Math.max(0, openCount - 1);
    if (openCount === 0) {
      document.body.style.overflow = "";
      const y = Number(document.body.dataset.nxScrollY || 0);
      delete document.body.dataset.nxScrollY;
      if (y) window.scrollTo(0, y);
    }
  }
}

/**
 * @typedef {object} ModalAction
 * @property {string} label
 * @property {"primary"|"secondary"|"danger"} [variant]
 * @property {boolean} [closeOnClick]
 * @property {() => void|Promise<void>} [onClick]
 */

/**
 * @param {object} options
 * @param {string} [options.title]
 * @param {string|HTMLElement} [options.body] - HTML string or node
 * @param {ModalAction[]} [options.actions]
 * @param {boolean} [options.dismissible=true] - backdrop / Escape
 * @param {string} [options.ariaLabel]
 * @returns {{ close: () => void, el: HTMLElement, setBody: Function, setLoading: Function }}
 */
export function openModal(options = {}) {
  ensureStyles();

  const dismissible = options.dismissible !== false;
  const root = document.createElement("div");
  root.className = "nx-modal-root";
  root.setAttribute("role", "presentation");

  const title = options.title || "";
  const aria = options.ariaLabel || title || "Dialog";

  root.innerHTML = `
    <div class="nx-modal-backdrop" data-nx-dismiss="1"></div>
    <div class="nx-modal" role="dialog" aria-modal="true" aria-label="${escapeAttr(aria)}">
      <div class="nx-modal__head">
        <h2 class="nx-modal__title"></h2>
        ${
          dismissible
            ? `<button type="button" class="nx-modal__close" data-nx-dismiss="1" aria-label="Close">
                 <i class="bi bi-x-lg"></i>
               </button>`
            : `<span></span>`
        }
      </div>
      <div class="nx-modal__body"></div>
      <div class="nx-modal__foot" hidden></div>
    </div>
  `;

  const titleEl = root.querySelector(".nx-modal__title");
  const bodyEl = root.querySelector(".nx-modal__body");
  const footEl = root.querySelector(".nx-modal__foot");
  const dialog = root.querySelector(".nx-modal");

  if (titleEl) titleEl.textContent = title;

  if (typeof options.body === "string") {
    bodyEl.innerHTML = options.body;
  } else if (options.body instanceof HTMLElement) {
    bodyEl.appendChild(options.body);
  }

  const actions = Array.isArray(options.actions) ? options.actions : [];
  if (actions.length && footEl) {
    footEl.hidden = false;
    actions.forEach((action, index) => {
      const btn = document.createElement("button");
      btn.type = "button";
      const variant = action.variant || (index === actions.length - 1 ? "primary" : "secondary");
      btn.className = `btn btn--${variant}`;
      btn.textContent = action.label || "OK";
      btn.addEventListener("click", async () => {
        try {
          if (action.onClick) await action.onClick();
          if (action.closeOnClick !== false) close();
        } catch (err) {
          console.error(err);
        }
      });
      footEl.appendChild(btn);
    });
  }

  function onKey(e) {
    if (e.key === "Escape" && dismissible) {
      e.preventDefault();
      close();
    }
  }

  function onRootClick(e) {
    if (!dismissible) return;
    if (e.target?.getAttribute?.("data-nx-dismiss") === "1") {
      close();
    }
  }

  function close() {
    document.removeEventListener("keydown", onKey);
    root.removeEventListener("click", onRootClick);
    root.remove();
    lockBody(false);
  }

  function setBody(content) {
    if (!bodyEl) return;
    bodyEl.innerHTML = "";
    if (typeof content === "string") bodyEl.innerHTML = content;
    else if (content instanceof HTMLElement) bodyEl.appendChild(content);
  }

  function setLoading(loading) {
    footEl?.querySelectorAll("button").forEach((b) => {
      b.disabled = !!loading;
    });
  }

  root.addEventListener("click", onRootClick);
  document.addEventListener("keydown", onKey);
  document.body.appendChild(root);
  lockBody(true);

  // focus first focusable
  requestAnimationFrame(() => {
    const focusable = dialog?.querySelector(
      "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"
    );
    focusable?.focus?.();
  });

  return { close, el: root, setBody, setLoading };
}

/**
 * Confirm dialog
 * @param {{ title?: string, message?: string, confirmLabel?: string, cancelLabel?: string, danger?: boolean }} opts
 * @returns {Promise<boolean>}
 */
export function confirmDialog(opts = {}) {
  return new Promise((resolve) => {
    const api = openModal({
      title: opts.title || "Confirm",
      body: `<p style="margin:0;line-height:1.45;color:var(--text-secondary)">${escapeHtml(
        opts.message || "Are you sure?"
      )}</p>`,
      dismissible: true,
      actions: [
        {
          label: opts.cancelLabel || "Cancel",
          variant: "secondary",
          onClick: () => resolve(false),
        },
        {
          label: opts.confirmLabel || "OK",
          variant: opts.danger ? "danger" : "primary",
          onClick: () => resolve(true),
        },
      ],
    });

    // backdrop dismiss → false
    const obs = new MutationObserver(() => {
      if (!document.body.contains(api.el)) {
        obs.disconnect();
        resolve(false);
      }
    });
    obs.observe(document.body, { childList: true });
  });
}

/**
 * Simple alert
 */
export function alertDialog({ title = "Notice", message = "" } = {}) {
  return new Promise((resolve) => {
    openModal({
      title,
      body: `<p style="margin:0;line-height:1.45">${escapeHtml(message)}</p>`,
      actions: [
        {
          label: "OK",
          variant: "primary",
          onClick: () => resolve(),
        },
      ],
    });
  });
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, "&#39;");
}

export default {
  openModal,
  confirmDialog,
  alertDialog,
};