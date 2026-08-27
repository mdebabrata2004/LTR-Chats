/**
 * Avatar component — initials / photo / online dot
 */

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * First letter(s) from display name
 * @param {string} name
 */
export function getInitials(name) {
  const t = String(name || "").trim();
  if (!t) return "?";
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return t.slice(0, 1).toUpperCase();
}

/**
 * Deterministic accent from string (uid / name)
 */
export function avatarColor(seed) {
  const palette = [
    "#5b6af0",
    "#e17076",
    "#eda86c",
    "#a695e7",
    "#7bc862",
    "#6ec9cb",
    "#ee7aae",
    "#f5b942",
  ];
  const s = String(seed || "");
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  }
  return palette[hash % palette.length];
}

/**
 * Avatar HTML string
 * @param {object} opts
 * @param {string} [opts.name]
 * @param {string} [opts.photoURL]
 * @param {string} [opts.uid]
 * @param {"xs"|"sm"|"md"|"lg"|"xl"} [opts.size="md"]
 * @param {boolean} [opts.online]
 * @param {string} [opts.className]
 * @param {string} [opts.id]
 * @param {boolean} [opts.rounded=true]
 */
export function avatarHtml(opts = {}) {
  const name = opts.name || "User";
  const photo = opts.photoURL || "";
  const size = opts.size || "md";
  const uid = opts.uid || name;
  const online = !!opts.online;
  const extra = opts.className ? ` ${opts.className}` : "";
  const idAttr = opts.id ? ` id="${escapeHtml(opts.id)}"` : "";
  const bg = avatarColor(uid);
  const initials = getInitials(name);

  const inner = photo
    ? `<img src="${escapeHtml(photo)}" alt="${escapeHtml(name)}" loading="lazy" onerror="this.remove()">`
    : `<span class="nx-avatar__initials">${escapeHtml(initials)}</span>`;

  return `
    <div class="nx-avatar nx-avatar--${size}${extra}"${idAttr}
         style="${photo ? "" : `background:${bg}`}"
         title="${escapeHtml(name)}"
         role="img"
         aria-label="${escapeHtml(name)}">
      ${inner}
      ${online ? `<span class="nx-avatar__dot" aria-hidden="true"></span>` : ""}
    </div>
  `;
}

/**
 * Update an existing avatar element in the DOM
 * @param {HTMLElement|string} elOrId
 * @param {object} opts — same as avatarHtml
 */
export function updateAvatar(elOrId, opts = {}) {
  const el =
    typeof elOrId === "string" ? document.getElementById(elOrId) : elOrId;
  if (!el) return;

  const name = opts.name || el.getAttribute("aria-label") || "User";
  const photo = opts.photoURL || "";
  const uid = opts.uid || name;
  const online = !!opts.online;

  el.setAttribute("aria-label", name);
  el.setAttribute("title", name);

  if (photo) {
    el.style.background = "";
    el.innerHTML = `<img src="${escapeHtml(photo)}" alt="${escapeHtml(name)}" loading="lazy" onerror="this.remove()">`;
  } else {
    el.style.background = avatarColor(uid);
    el.innerHTML = `<span class="nx-avatar__initials">${escapeHtml(getInitials(name))}</span>`;
  }

  let dot = el.querySelector(".nx-avatar__dot");
  if (online) {
    if (!dot) {
      dot = document.createElement("span");
      dot.className = "nx-avatar__dot";
      dot.setAttribute("aria-hidden", "true");
      el.appendChild(dot);
    }
  } else if (dot) {
    dot.remove();
  }
}

/**
 * Inject avatar CSS once
 */
export function ensureAvatarStyles() {
  if (document.getElementById("nx-avatar-styles")) return;
  const style = document.createElement("style");
  style.id = "nx-avatar-styles";
  style.textContent = `
    .nx-avatar {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      overflow: visible;
      flex-shrink: 0;
      user-select: none;
      color: #fff;
      font-weight: 700;
      line-height: 1;
    }
    .nx-avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 50%;
      display: block;
    }
    .nx-avatar__initials {
      pointer-events: none;
    }
    .nx-avatar--xs { width: 24px; height: 24px; font-size: 10px; }
    .nx-avatar--sm { width: 32px; height: 32px; font-size: 12px; }
    .nx-avatar--md { width: 44px; height: 44px; font-size: 15px; }
    .nx-avatar--lg { width: 56px; height: 56px; font-size: 18px; }
    .nx-avatar--xl { width: 96px; height: 96px; font-size: 32px; }

    .nx-avatar__dot {
      position: absolute;
      right: 0;
      bottom: 0;
      width: 22%;
      min-width: 8px;
      height: 22%;
      min-height: 8px;
      border-radius: 50%;
      background: #25d366;
      border: 2px solid var(--surface-1, #fff);
      box-sizing: border-box;
    }

    .nx-avatar--clickable {
      cursor: pointer;
    }
    .nx-avatar--clickable:active {
      opacity: 0.8;
    }
  `;
  document.head.appendChild(style);
}

/** Call once at app boot (optional) */
ensureAvatarStyles();

export default {
  getInitials,
  avatarColor,
  avatarHtml,
  updateAvatar,
  ensureAvatarStyles,
};