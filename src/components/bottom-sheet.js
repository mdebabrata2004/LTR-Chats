/**
 * Bottom sheet — mobile action panel / content drawer
 *
 * openBottomSheet({ title, body, actions, dismissible })
 */

let openCount = 0;
let styleReady = false;

function ensureStyles() {
  if (styleReady || document.getElementById("nx-sheet-styles")) {
    styleReady = true;
    return;
  }
  const style = document.createElement("style");
  style.id = "nx-sheet-styles";
  style.textContent = `
    .nx-sheet-root {
      position: fixed;
      inset: 0;
      z-index: 920;
      display: flex;
      align-items: flex-end;
      justify-content: center;
    }
    .nx-sheet-root[hidden] {
      display: none !important;
    }
    .nx-sheet-backdrop {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.45);
      backdrop-filter: blur(2px);
      -webkit-backdrop-filter: blur(2px);
      animation: nx-sheet-fade 0.18s ease;
    }
    .nx-sheet {
      position: relative;
      width: min(480px, 100%);
      max-height: min(92vh, 820px);
      display: flex;
      flex-direction: column;
      background: var(--surface-1, #1f2933);
      color: var(--text-primary, #e9edef);
      border-radius: 16px 16px 0 0;
      box-shadow: 0 -8px 40px rgba(0, 0, 0, 0.35);
      animation: nx-sheet-up 0.22s cubic-bezier(0.2, 0.9, 0.3, 1);
      overflow: hidden;
      padding-bottom: env(safe-area-inset-bottom, 0px);
    }
    .nx-sheet__handle {
      display: flex;
      justify-content: center;
      padding: 10px 0 4px;
      flex-shrink: 0;
    }
    .nx-sheet__handle-bar {
      width: 36px;
      height: 4px;
      border-radius: 2px;
      background: var(--border-default, rgba(255,255,255,0.18));
    }
    .nx-sheet__head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 8px 16px 12px;
      flex-shrink: 0;
    }
    .nx-sheet__title {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      flex: 1;
      min-width: 0;
    }
    .nx-sheet__close {
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
      font-size: 1.05rem;
    }
    .nx-sheet__close:hover {
      background: var(--surface-2, rgba(255,255,255,0.06));
    }
    .nx-sheet__body {
      padding: 0 16px 16px;
      overflow-y: auto;
      flex: 1 1 auto;
      min-height: 0;
      -webkit-overflow-scrolling: touch;
    }
    .nx-sheet__actions {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 8px;
      flex-shrink: 0;
    }
    .nx-sheet__action {
      display: flex;
      align-items: center;
      gap: 14px;
      width: 100%;
      padding: 14px 14px;
      border: none;
      border-radius: 12px;
      background: transparent;
      color: inherit;
      font-size: 15.5px;
      text-align: left;
      cursor: pointer;
      font-family: inherit;
    }
    .nx-sheet__action:hover,
    .nx-sheet__action:active {
      background: var(--surface-2, rgba(255,255,255,0.06));
    }
    .nx-sheet__action:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    .nx-sheet__action--danger {
      color: var(--color-danger, #e53935);
    }
    .nx-sheet__action-icon {
      width: 22px;
      text-align: center;
      font-size: 1.15rem;
      flex-shrink: 0;
    }
    .nx-sheet__foot {
      display: flex;
      gap: 8px;
      justify-content: stretch;
      padding: 8px 16px 16px;
      flex-shrink: 0;
    }
    .nx-sheet__foot .nx-sheet-btn {
      flex: 1;
      min-height: 44px;
      border: none;
      border-radius: 12px;
      font-weight: 600;
      font-size: 15px;
      cursor: pointer;
      font-family: inherit;
    }
    .nx-sheet-btn--primary {
      background: var(--color-accent, #5b6af0);
      color: #fff;
    }
    .nx-sheet-btn--secondary {
      background: var(--surface-2, rgba(255,255,255,0.08));
      color: inherit;
    }
    .nx-sheet-btn--danger {
      background: var(--color-danger, #e53935);
      color: #fff;
    }

    @keyframes nx-sheet-fade {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes nx-sheet-up {
      from { transform: translateY(100%); }
      to { transform: translateY(0); }
    }

    @media (min-width: 600px) {
      .nx-sheet-root {
        align-items: center;
        padding: 24px;
      }
      .nx-sheet {
        border-radius: 16px;
        max-height: min(80vh, 640px);
        animation-name: nx-sheet-pop;
      }
      .nx-sheet__handle { display: none; }
      @keyframes nx-sheet-pop {
        from { opacity: 0.7; transform: translateY(12px) scale(0.98); }
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
    if (openCount === 1) document.body.style.overflow = "hidden";
  } else {
    openCount = Math.max(0, openCount - 1);
    if (openCount === 0) document.body.style.overflow = "";
  }
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * @typedef {object} SheetAction
 * @property {string} label
 * @property {string} [icon] — bi icon name without prefix
 * @property {boolean} [danger]
 * @property {boolean} [disabled]
 * @property {boolean} [closeOnClick]
 * @property {() => void|Promise<void>} [onClick]
 */

/**
 * @param {object} options
 * @param {string} [options.title]
 * @param {string|HTMLElement} [options.body]
 * @param {SheetAction[]} [options.actions] — list rows
 * @param {SheetAction[]} [options.buttons] — footer buttons (primary/secondary)
 * @param {boolean} [options.dismissible=true]
 * @param {boolean} [options.showHandle=true]
 * @returns {{ close: Function, el: HTMLElement, setBody: Function }}
 */
export function openBottomSheet(options = {}) {
  ensureStyles();

  const dismissible = options.dismissible !== false;
  const showHandle = options.showHandle !== false;

  const root = document.createElement("div");
  root.className = "nx-sheet-root";
  root.innerHTML = `
    <div class="nx-sheet-backdrop" data-sheet-dismiss="1"></div>
    <div class="nx-sheet" role="dialog" aria-modal="true"
         aria-label="${escapeHtml(options.title || "Sheet")}">
      ${
        showHandle
          ? `<div class="nx-sheet__handle"><div class="nx-sheet__handle-bar"></div></div>`
          : ""
      }
      <div class="nx-sheet__head">
        <h2 class="nx-sheet__title"></h2>
        ${
          dismissible
            ? `<button type="button" class="nx-sheet__close" data-sheet-dismiss="1" aria-label="Close">
                 <i class="bi bi-x-lg"></i>
               </button>`
            : `<span></span>`
        }
      </div>
      <div class="nx-sheet__body"></div>
      <div class="nx-sheet__actions" hidden></div>
      <div class="nx-sheet__foot" hidden></div>
    </div>
  `;

  const titleEl = root.querySelector(".nx-sheet__title");
  const bodyEl = root.querySelector(".nx-sheet__body");
  const actionsEl = root.querySelector(".nx-sheet__actions");
  const footEl = root.querySelector(".nx-sheet__foot");

  if (titleEl) titleEl.textContent = options.title || "";

  if (typeof options.body === "string") {
    bodyEl.innerHTML = options.body;
  } else if (options.body instanceof HTMLElement) {
    bodyEl.appendChild(options.body);
  } else {
    bodyEl.hidden = true;
  }

  const listActions = Array.isArray(options.actions) ? options.actions : [];
  if (listActions.length && actionsEl) {
    actionsEl.hidden = false;
    listActions.forEach((action) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        "nx-sheet__action" + (action.danger ? " nx-sheet__action--danger" : "");
      btn.disabled = !!action.disabled;
      btn.innerHTML = `
        ${
          action.icon
            ? `<i class="bi bi-${escapeHtml(action.icon)} nx-sheet__action-icon"></i>`
            : `<span class="nx-sheet__action-icon"></span>`
        }
        <span>${escapeHtml(action.label || "")}</span>
      `;
      btn.addEventListener("click", async () => {
        try {
          await action.onClick?.();
          if (action.closeOnClick !== false) close();
        } catch (err) {
          console.error(err);
        }
      });
      actionsEl.appendChild(btn);
    });
  }

  const buttons = Array.isArray(options.buttons) ? options.buttons : [];
  if (buttons.length && footEl) {
    footEl.hidden = false;
    buttons.forEach((b, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      const variant =
        b.variant ||
        (b.danger ? "danger" : i === buttons.length - 1 ? "primary" : "secondary");
      btn.className = `nx-sheet-btn nx-sheet-btn--${variant}`;
      btn.textContent = b.label || "OK";
      btn.addEventListener("click", async () => {
        try {
          await b.onClick?.();
          if (b.closeOnClick !== false) close();
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

  function onClick(e) {
    if (!dismissible) return;
    if (e.target?.getAttribute?.("data-sheet-dismiss") === "1") close();
  }

  function close() {
    document.removeEventListener("keydown", onKey);
    root.removeEventListener("click", onClick);
    root.remove();
    lockBody(false);
  }

  function setBody(content) {
    bodyEl.hidden = false;
    bodyEl.innerHTML = "";
    if (typeof content === "string") bodyEl.innerHTML = content;
    else if (content instanceof HTMLElement) bodyEl.appendChild(content);
  }

  root.addEventListener("click", onClick);
  document.addEventListener("keydown", onKey);
  document.body.appendChild(root);
  lockBody(true);

  return { close, el: root, setBody };
}

/**
 * Quick action sheet (attach / message menu style)
 * @param {{ title?: string, actions: SheetAction[] }} opts
 */
export function openActionSheet(opts = {}) {
  return openBottomSheet({
    title: opts.title || "",
    actions: opts.actions || [],
    showHandle: true,
  });
}

export default {
  openBottomSheet,
  openActionSheet,
};