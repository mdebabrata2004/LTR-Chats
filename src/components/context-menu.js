/**
 * Context menu — long-press / right-click floating menu
 *
 * openContextMenu({ x, y, items })
 * items: [{ id, label, icon, danger, disabled, onClick }]
 */

let activeMenu = null;
let styleReady = false;

function ensureStyles() {
  if (styleReady || document.getElementById("nx-ctx-styles")) {
    styleReady = true;
    return;
  }
  const style = document.createElement("style");
  style.id = "nx-ctx-styles";
  style.textContent = `
    .nx-ctx-root {
      position: fixed;
      inset: 0;
      z-index: 850;
    }
    .nx-ctx-root[hidden] {
      display: none !important;
    }
    .nx-ctx-backdrop {
      position: absolute;
      inset: 0;
      background: transparent;
    }
    .nx-ctx-menu {
      position: fixed;
      min-width: 200px;
      max-width: min(280px, calc(100vw - 16px));
      padding: 6px;
      border-radius: 12px;
      background: var(--surface-1, #1f2933);
      color: var(--text-primary, #e9edef);
      border: 1px solid var(--border-default, rgba(255,255,255,0.1));
      box-shadow: 0 12px 36px rgba(0,0,0,0.4);
      z-index: 1;
      animation: nx-ctx-in 0.14s cubic-bezier(0.2, 0.9, 0.3, 1);
      transform-origin: top left;
    }
    .nx-ctx-item {
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
      padding: 11px 12px;
      border: none;
      border-radius: 8px;
      background: transparent;
      color: inherit;
      font-size: 14.5px;
      text-align: left;
      cursor: pointer;
      font-family: inherit;
    }
    .nx-ctx-item:hover,
    .nx-ctx-item:focus-visible {
      background: var(--surface-2, rgba(255,255,255,0.06));
      outline: none;
    }
    .nx-ctx-item:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    .nx-ctx-item--danger {
      color: var(--color-danger, #e53935);
    }
    .nx-ctx-item__icon {
      width: 20px;
      text-align: center;
      font-size: 1rem;
      flex-shrink: 0;
      opacity: 0.9;
    }
    .nx-ctx-sep {
      height: 1px;
      margin: 4px 6px;
      background: var(--border-subtle, rgba(255,255,255,0.08));
    }
    @keyframes nx-ctx-in {
      from { opacity: 0; transform: scale(0.94); }
      to { opacity: 1; transform: scale(1); }
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

/**
 * Close any open context menu
 */
export function closeContextMenu() {
  if (activeMenu) {
    activeMenu.cleanup?.();
    activeMenu.el?.remove();
    activeMenu = null;
  }
}

/**
 * @typedef {object} CtxItem
 * @property {string} [id]
 * @property {string} [label]
 * @property {string} [icon] — bootstrap icon name without bi- prefix, e.g. "trash"
 * @property {boolean} [danger]
 * @property {boolean} [disabled]
 * @property {boolean} [separator] — if true, render divider
 * @property {() => void|Promise<void>} [onClick]
 */

/**
 * @param {object} opts
 * @param {number} opts.x
 * @param {number} opts.y
 * @param {CtxItem[]} opts.items
 * @param {HTMLElement} [opts.anchor] — optional element to mark
 * @returns {{ close: () => void }}
 */
export function openContextMenu(opts = {}) {
  ensureStyles();
  closeContextMenu();

  const items = Array.isArray(opts.items) ? opts.items : [];
  if (!items.length) return { close: () => {} };

  const root = document.createElement("div");
  root.className = "nx-ctx-root";
  root.innerHTML = `
    <div class="nx-ctx-backdrop" data-nx-ctx-dismiss="1"></div>
    <div class="nx-ctx-menu" role="menu"></div>
  `;

  const menu = root.querySelector(".nx-ctx-menu");

  items.forEach((item) => {
    if (item.separator) {
      const sep = document.createElement("div");
      sep.className = "nx-ctx-sep";
      menu.appendChild(sep);
      return;
    }
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className =
      "nx-ctx-item" + (item.danger ? " nx-ctx-item--danger" : "");
    btn.setAttribute("role", "menuitem");
    if (item.id) btn.dataset.id = item.id;
    btn.disabled = !!item.disabled;
    btn.innerHTML = `
      ${
        item.icon
          ? `<i class="bi bi-${escapeHtml(item.icon)} nx-ctx-item__icon" aria-hidden="true"></i>`
          : `<span class="nx-ctx-item__icon"></span>`
      }
      <span>${escapeHtml(item.label || "")}</span>
    `;
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (item.disabled) return;
      try {
        await item.onClick?.();
      } finally {
        closeContextMenu();
      }
    });
    menu.appendChild(btn);
  });

  document.body.appendChild(root);

  // Position — keep inside viewport
  const pad = 8;
  const rect = menu.getBoundingClientRect();
  let left = opts.x ?? 0;
  let top = opts.y ?? 0;
  if (left + rect.width > window.innerWidth - pad) {
    left = Math.max(pad, window.innerWidth - rect.width - pad);
  }
  if (top + rect.height > window.innerHeight - pad) {
    top = Math.max(pad, window.innerHeight - rect.height - pad);
  }
  if (left < pad) left = pad;
  if (top < pad) top = pad;
  menu.style.left = left + "px";
  menu.style.top = top + "px";

  const onKey = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      closeContextMenu();
    }
  };

  const onDismiss = (e) => {
    if (e.target?.getAttribute?.("data-nx-ctx-dismiss") === "1") {
      closeContextMenu();
    }
  };

  const onScroll = () => closeContextMenu();

  root.addEventListener("click", onDismiss);
  document.addEventListener("keydown", onKey);
  window.addEventListener("scroll", onScroll, true);
  window.addEventListener("resize", onScroll);

  const cleanup = () => {
    root.removeEventListener("click", onDismiss);
    document.removeEventListener("keydown", onKey);
    window.removeEventListener("scroll", onScroll, true);
    window.removeEventListener("resize", onScroll);
  };

  activeMenu = { el: root, cleanup };

  // Focus first item
  requestAnimationFrame(() => {
    menu.querySelector(".nx-ctx-item:not(:disabled)")?.focus?.();
  });

  return { close: closeContextMenu };
}

/**
 * Bind contextmenu + long-press on a container (event delegation)
 * @param {HTMLElement} container
 * @param {(e: Event, target: HTMLElement) => CtxItem[]|null} getItems
 *        return items for the target, or null to ignore
 * @param {string} [targetSelector=".msg"]
 * @returns {() => void} unbind
 */
export function bindContextMenu(container, getItems, targetSelector = "[data-mid]") {
  if (!container || typeof getItems !== "function") return () => {};

  let pressTimer = null;

  const openFromEvent = (e, target) => {
    const items = getItems(e, target);
    if (!items || !items.length) return;
    const x = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
    const y = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
    openContextMenu({ x, y, items, anchor: target });
  };

  const onContext = (e) => {
    const target = e.target.closest(targetSelector);
    if (!target || !container.contains(target)) return;
    e.preventDefault();
    openFromEvent(e, target);
  };

  const onTouchStart = (e) => {
    const target = e.target.closest(targetSelector);
    if (!target || !container.contains(target)) return;
    const t = e.touches[0];
    pressTimer = setTimeout(() => {
      openFromEvent(
        { clientX: t.clientX, clientY: t.clientY, touches: e.touches },
        target
      );
    }, 480);
  };

  const clearPress = () => {
    if (pressTimer) clearTimeout(pressTimer);
    pressTimer = null;
  };

  container.addEventListener("contextmenu", onContext);
  container.addEventListener("touchstart", onTouchStart, { passive: true });
  container.addEventListener("touchend", clearPress);
  container.addEventListener("touchmove", clearPress);

  return () => {
    clearPress();
    closeContextMenu();
    container.removeEventListener("contextmenu", onContext);
    container.removeEventListener("touchstart", onTouchStart);
    container.removeEventListener("touchend", clearPress);
    container.removeEventListener("touchmove", clearPress);
  };
}

export default {
  openContextMenu,
  closeContextMenu,
  bindContextMenu,
};