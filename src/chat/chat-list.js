/**
 * Chat list — Telegram / WhatsApp style
 * Desktop → #list-panel-root | Mobile → #page-root
 */

import { listenMyConversations, getUserProfile } from "../firebase/firestore.js";
import { auth } from "../config/firebase.js";
import { navigate } from "../core/router.js";
import { formatMessageTime } from "../utils/date.js";
import { setState, isPinned, isMuted } from "../core/state.js";
import { signOut } from "../auth/auth.js";
import { listSubtitle, DRAFT_CSS } from "./drafts.js";
import { debounce } from "../utils/debounce.js";

let unsub = null;
const profileCache = {};

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function resolveOtherUser(conv) {
  const me = auth.currentUser?.uid;
  if (!me) return null;

  if (conv.type === "group") {
    return {
      displayName: conv.title || conv.name || "Group",
      username: null,
      photoURL: conv.photoURL || null,
      isGroup: true,
    };
  }

  const otherUid = (conv.members || []).find((u) => u !== me);
  if (!otherUid) return null;
  if (profileCache[otherUid]) return profileCache[otherUid];

  try {
    const p = await getUserProfile(otherUid);
    if (p) {
      profileCache[otherUid] = { ...p, uid: otherUid };
      return profileCache[otherUid];
    }
  } catch (_) {}
  return { displayName: "User", uid: otherUid };
}

function lastMessagePreview(conv) {
  const lm = conv.lastMessage;
  if (!lm) return "No messages yet";
  if (lm.type === "image") return "📷 Photo";
  if (lm.type === "audio") return "🎵 Audio";
  if (lm.type === "video") return "🎬 Video";
  if (lm.type === "file") return `📎 ${lm.fileName || "File"}`;
  return lm.text || "No messages yet";
}

function renderRow(conv, other, activeId) {
  const name =
    other?.displayName || other?.username || conv.title || "User";
  const initials = (name[0] || "?").toUpperCase();
  const photo = other?.photoURL || conv.photoURL || "";

  const sub = listSubtitle(
    { lastMessage: { text: lastMessagePreview(conv) } },
    conv.id
  );
  const subtitle = sub.isDraft ? sub.text : lastMessagePreview(conv);
  const time = conv.lastMessage?.createdAt
    ? formatMessageTime(conv.lastMessage.createdAt)
    : "";

  const active = conv.id === activeId ? " active" : "";
  const pinned = isPinned?.(conv.id) ? " is-pinned" : "";
  const muted = isMuted?.(conv.id) ? " is-muted" : "";
  const unread = conv.unreadCount > 0 ? conv.unreadCount : 0;

  return `
    <div class="list-row${active}${pinned}${muted}" data-cid="${escapeHtml(conv.id)}" role="button" tabindex="0">
      <div class="avatar avatar--md">
        ${
          photo
            ? `<img src="${escapeHtml(photo)}" alt="" loading="lazy">`
            : `<span>${escapeHtml(initials)}</span>`
        }
      </div>
      <div class="list-row__content">
        <div class="list-row__top">
          <div class="list-row__title truncate">${escapeHtml(name)}</div>
          <span class="list-row__time">${escapeHtml(time)}</span>
        </div>
        <div class="list-row__bottom">
          <div class="list-row__subtitle truncate">
            ${
              sub.isDraft
                ? `<span class="draft-label">Draft: </span>${escapeHtml(subtitle)}`
                : escapeHtml(subtitle)
            }
          </div>
          <div class="list-row__badges">
            ${muted ? `<i class="bi bi-bell-slash list-row__mute" title="Muted"></i>` : ""}
            ${pinned ? `<i class="bi bi-pin-angle-fill list-row__pin" title="Pinned"></i>` : ""}
            ${
              unread
                ? `<span class="list-row__unread">${unread > 99 ? "99+" : unread}</span>`
                : ""
            }
          </div>
        </div>
      </div>
    </div>
  `;
}

function buildListHTML() {
  return `
    <div class="chat-list">
      <header class="app-header chat-list__header">
        <h1 class="app-header__title">Chats</h1>
        <div class="app-header__actions">
          <button type="button" class="btn btn--icon btn--ghost" id="btn-new-chat" title="New chat" aria-label="New chat">
            <i class="bi bi-pencil-square" style="font-size:1.2rem"></i>
          </button>
          <button type="button" class="btn btn--icon btn--ghost" id="btn-menu" title="Menu" aria-label="Menu">
            <i class="bi bi-three-dots-vertical" style="font-size:1.2rem"></i>
          </button>
          <div id="header-menu" class="menu-dropdown" hidden>
            <button type="button" class="menu-dropdown__item" data-action="people">
              <i class="bi bi-person-plus"></i> New chat
            </button>
            <button type="button" class="menu-dropdown__item" data-action="settings">
              <i class="bi bi-gear"></i> Settings
            </button>
            <button type="button" class="menu-dropdown__item menu-dropdown__item--danger" data-action="logout">
              <i class="bi bi-box-arrow-right"></i> Sign out
            </button>
          </div>
        </div>
      </header>

      <div class="wp-search">
        <input type="search" id="chat-search" placeholder="Search or start a new chat" autocomplete="off" enterkeyhint="search" />
      </div>

      
      <div class="page__scroll chat-list__scroll" id="chat-list-scroll">
        <div class="empty-state" id="chat-list-empty" hidden>
          <div class="empty-state__icon"><i class="bi bi-chat-square-text" style="font-size:2rem"></i></div>
          <div class="empty-state__title">No chats yet</div>
          <p class="empty-state__desc">Search people by username and start a conversation.</p>
          <button type="button" class="btn btn--primary" id="btn-empty-new" style="margin-top:12px">
            Find people
          </button>
        </div>
        <div id="chat-list-rows" role="list"></div>
      </div>
      
    </div>
  `;
}

function ensureListStyles() {
  if (document.getElementById("chat-list-styles")) return;
  const style = document.createElement("style");
  style.id = "chat-list-styles";
  style.textContent = `
    ${DRAFT_CSS}
    .chat-list {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 0;
      background: var(--surface-1);
    }
    .chat-list__header { flex-shrink: 0; }
    .chat-list__header .app-header__actions { position: relative; }
    .chat-list__scroll {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
    }
    .list-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 14px;
      cursor: pointer;
      border: none;
      background: transparent;
      width: 100%;
      text-align: left;
      transition: background 0.12s ease;
    }
    .list-row:hover, .list-row:focus-visible {
      background: var(--surface-2);
      outline: none;
    }
    .list-row.active {
      background: var(--color-accent-muted);
    }
    .list-row__content { flex: 1; min-width: 0; }
    .list-row__top, .list-row__bottom {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .list-row__title {
      font-weight: 600;
      font-size: 15px;
      color: var(--text-primary);
    }
    .list-row__subtitle {
      font-size: 13px;
      color: var(--text-secondary);
      margin-top: 2px;
      flex: 1;
      min-width: 0;
    }
    .list-row__time {
      font-size: 12px;
      color: var(--text-tertiary);
      flex-shrink: 0;
    }
    .list-row__badges {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-shrink: 0;
    }
    .list-row__unread {
      min-width: 20px;
      height: 20px;
      padding: 0 6px;
      border-radius: 10px;
      background: var(--color-accent);
      color: #fff;
      font-size: 11px;
      font-weight: 700;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .list-row__mute, .list-row__pin {
      font-size: 12px;
      color: var(--text-tertiary);
    }
    .list-row.is-muted .list-row__subtitle { opacity: 0.75; }

    .menu-dropdown {
      position: absolute;
      top: calc(100% + 4px);
      right: 0;
      min-width: 200px;
      background: var(--surface-1);
      border: 1px solid var(--border-default);
      border-radius: 12px;
      box-shadow: 0 8px 28px rgba(0,0,0,0.35);
      padding: 6px;
      z-index: 80;
    }
    .menu-dropdown[hidden] { display: none !important; }
    .menu-dropdown__item {
      display: flex; align-items: center; gap: 12px;
      width: 100%; padding: 12px 14px;
      border: none; background: transparent;
      color: var(--text-primary); font-size: 15px;
      text-align: left; border-radius: 8px; cursor: pointer;
    }
    .menu-dropdown__item:hover { background: var(--surface-2); }
    .menu-dropdown__item--danger { color: var(--color-danger, #e53935); }

    .wp-search { padding: 8px 12px 10px; flex-shrink: 0; }
    .wp-search input {
      width: 100%; height: 40px; border: none; border-radius: 8px;
      background: var(--surface-2); color: var(--text-primary);
      padding: 0 14px 0 40px; font-size: 15px; outline: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='%238696a0' viewBox='0 0 16 16'%3E%3Cpath d='M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85zm-5.242.656a5 5 0 1 1 0-10 5 5 0 0 1 0 10z'/%3E%3C/svg%3E");
      background-repeat: no-repeat; background-position: 14px center;
    }
    .wp-search input:focus {
      box-shadow: 0 0 0 2px var(--color-accent-muted);
    }

    .wp-empty {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 40px;
      gap: 12px;
      background: var(--surface-0);
      color: var(--text-secondary);
      height: 100%;
    }
    .wp-empty__icon { font-size: 4rem; opacity: 0.22; }
    .wp-empty__title {
      font-size: 1.75rem; font-weight: 300;
      color: var(--text-primary); letter-spacing: -0.02em;
    }
    .wp-empty__desc { font-size: 0.95rem; max-width: 320px; line-height: 1.5; }
    .wp-empty__lock {
      margin-top: 28px; font-size: 0.8rem;
      color: var(--text-tertiary);
      display: flex; align-items: center; gap: 6px;
    }

    @media (max-width: 899px) {
      .chat-list { background: var(--surface-0); }
    }
  `;
  document.head.appendChild(style);
}

function wireListUI(host, { onSearch }) {
  host.querySelector("#btn-new-chat")?.addEventListener("click", () => {
    navigate("people");
  });
  host.querySelector("#btn-empty-new")?.addEventListener("click", () => {
    navigate("people");
  });

  const menuBtn = host.querySelector("#btn-menu");
  const menu = host.querySelector("#header-menu");

  const closeMenu = () => {
    if (menu) menu.hidden = true;
  };

  menuBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    if (menu) menu.hidden = !menu.hidden;
  });

  document.addEventListener("click", closeMenu);
  host._closeMenu = closeMenu;

  menu?.addEventListener("click", async (e) => {
    e.stopPropagation();
    const item = e.target.closest("[data-action]");
    if (!item) return;
    menu.hidden = true;
    const action = item.dataset.action;
    if (action === "settings") navigate("settings");
    if (action === "people") navigate("people");
    if (action === "logout") {
      if (!confirm("Sign out of Nexus?")) return;
      try {
        await signOut();
        location.href = location.pathname + location.search;
      } catch {
        /* ignore */
      }
    }
  });

  const search = host.querySelector("#chat-search");
  const debounced = debounce(() => onSearch?.(), 180);
  search?.addEventListener("input", debounced);
  host._debouncedSearch = debounced;
}

export function renderChatList() {
  ensureListStyles();

  const isDesktop = window.matchMedia("(min-width: 900px)").matches;
  const listHost = isDesktop
    ? document.getElementById("list-panel-root")
    : document.getElementById("page-root");
  const pageRoot = document.getElementById("page-root");

  if (!listHost) return () => {};

  // Desktop empty state on the right (only when not already in a chat)
  if (isDesktop && pageRoot) {
    const inChat = location.hash.startsWith("#chat/");
    if (!inChat) {
      pageRoot.innerHTML = `
        <div class="wp-empty" id="wp-empty">
          <div class="wp-empty__icon"><i class="bi bi-chat-dots"></i></div>
          <h2 class="wp-empty__title">Nexus</h2>
          <p class="wp-empty__desc">
            Send and receive messages in real time.<br/>
            Select a chat to start messaging.
          </p>
          <p class="wp-empty__lock">
            <i class="bi bi-lock-fill"></i> Your personal messages stay on your devices
          </p>
        </div>
      `;
    }
  }

  listHost.innerHTML = buildListHTML();

  let allConvs = [];

  const paint = async () => {
    const rowsEl = listHost.querySelector("#chat-list-rows");
    const emptyEl = listHost.querySelector("#chat-list-empty");
    const q = (listHost.querySelector("#chat-search")?.value || "")
      .trim()
      .toLowerCase();
    if (!rowsEl) return;

    const activeId = location.hash.startsWith("#chat/")
      ? location.hash.replace(/^#chat\//, "").split("?")[0]
      : null;

    // ── No conversations at all → show empty, hide rows ──
    if (!allConvs.length) {
      rowsEl.innerHTML = "";
      rowsEl.hidden = true;
      if (emptyEl) {
        emptyEl.hidden = false;
        emptyEl.style.display = "";
      }
      return;
    }

    // ── Has chats → empty permanently hidden ──
    if (emptyEl) {
      emptyEl.hidden = true;
      emptyEl.style.display = "none";
    }
    rowsEl.hidden = false;

    let list = [...allConvs];
    list.sort((a, b) => {
      const ap = isPinned?.(a.id) ? 1 : 0;
      const bp = isPinned?.(b.id) ? 1 : 0;
      if (ap !== bp) return bp - ap;
      return 0;
    });

    // Search filter (only among existing chats)
    if (q) {
      const filtered = [];
      for (const conv of list) {
        const other = await resolveOtherUser(conv);
        const name = (
          other?.displayName ||
          other?.username ||
          conv.title ||
          ""
        ).toLowerCase();
        const last = lastMessagePreview(conv).toLowerCase();
        if (name.includes(q) || last.includes(q)) filtered.push(conv);
      }
      list = filtered;
    }

    // Search matched nothing — show rows area empty, NOT the "No chats yet" block
    if (!list.length) {
      rowsEl.innerHTML = `
        <div class="empty-state" style="padding:32px 16px">
          <div class="empty-state__title">No results</div>
          <p class="empty-state__desc">Try a different name</p>
        </div>`;
      return;
    }

    const parts = [];
    for (const conv of list) {
      const other = await resolveOtherUser(conv);
      parts.push(renderRow(conv, other, activeId));
    }
    rowsEl.innerHTML = parts.join("");

    rowsEl.querySelectorAll(".list-row").forEach((el) => {
      const open = () => {
        const id = el.dataset.cid;
        if (id) navigate(`chat/${id}`);
      };
      el.addEventListener("click", open);
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      });
    });
  };

  wireListUI(listHost, { onSearch: () => paint() });
  listHost._rerender = paint;

  if (unsub) {
    unsub();
    unsub = null;
  }

  unsub = listenMyConversations(async (list) => {
    allConvs = Array.isArray(list) ? list : [];
    setState({
      conversationList: allConvs.map((c) => c.id),
      conversations: Object.fromEntries(allConvs.map((c) => [c.id, c])),
    });
    await paint();
  });

  return () => {
    if (listHost._closeMenu) {
      document.removeEventListener("click", listHost._closeMenu);
    }
    if (listHost._debouncedSearch?.cancel) {
      listHost._debouncedSearch.cancel();
    }
    // Desktop: keep listener when opening a chat from list
    const stillDesktop = window.matchMedia("(min-width: 900px)").matches;
    if (!stillDesktop && unsub) {
      unsub();
      unsub = null;
    }
  };
}

export default { renderChatList };