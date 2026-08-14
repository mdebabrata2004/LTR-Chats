/**
 * Chat list — WhatsApp-style list panel + mobile page
 */

import { listenMyConversations, getUserProfile } from "../firebase/firestore.js";
import { auth } from "../config/firebase.js";
import { navigate } from "../core/router.js";
import { formatMessageTime } from "../utils/date.js";
import { setState } from "../core/state.js";
import { signOut } from "../auth/auth.js";

let unsub = null;
let profileCache = {};

async function resolveOtherUser(conv) {
  const me = auth.currentUser?.uid;
  if (!me || conv.type !== "direct") return null;
  const otherUid = (conv.members || []).find((u) => u !== me);
  if (!otherUid) return null;
  if (profileCache[otherUid]) return profileCache[otherUid];
  const p = await getUserProfile(otherUid);
  if (p) profileCache[otherUid] = p;
  return p;
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderRow(conv, other, activeId) {
  const name = other?.displayName || other?.username || "User";
  const initials = (name[0] || "?").toUpperCase();
  const last = conv.lastMessage?.text || "No messages yet";
  const time = conv.lastMessage?.createdAt
    ? formatMessageTime(conv.lastMessage.createdAt)
    : "";
  const active = conv.id === activeId ? " active" : "";

  return `
    <div class="list-row${active}" data-cid="${conv.id}">
      <div class="avatar avatar--md">${other?.photoURL ? `<img src="${other.photoURL}" alt="">` : initials}</div>
      <div class="list-row__content">
        <div class="list-row__title truncate">${escapeHtml(name)}</div>
        <div class="list-row__subtitle truncate">${escapeHtml(last)}</div>
      </div>
      <div class="list-row__meta">
        <span class="list-row__time">${time}</span>
      </div>
    </div>
  `;
}

function buildListHTML() {
  return `
    <header class="app-header">
      <h1 class="app-header__title">Chats</h1>
      <div class="app-header__actions">
        <button type="button" class="btn btn--icon btn--ghost" id="btn-new-chat" title="New chat">
          <i class="bi bi-plus-lg" style="font-size:1.2rem"></i>
        </button>
        <button type="button" class="btn btn--icon btn--ghost" id="btn-menu" title="Menu">
          <i class="bi bi-three-dots-vertical" style="font-size:1.2rem"></i>
        </button>
        <div id="header-menu" class="menu-dropdown" hidden>
          <button type="button" class="menu-dropdown__item" data-action="settings">
            <i class="bi bi-gear"></i> Settings
          </button>
          <button type="button" class="menu-dropdown__item" data-action="people">
            <i class="bi bi-person-plus"></i> New chat
          </button>
          <button type="button" class="menu-dropdown__item menu-dropdown__item--danger" data-action="logout">
            <i class="bi bi-box-arrow-right"></i> Sign out
          </button>
        </div>
      </div>
    </header>
    <div class="wp-search">
      <input type="search" id="chat-search" placeholder="Search or start a new chat" autocomplete="off" />
    </div>
    <div class="page__scroll" id="chat-list-scroll" style="flex:1">
      <div class="empty-state" id="chat-list-empty" style="display:none">
        <div class="empty-state__title">No chats yet</div>
        <p class="empty-state__desc">Search people by username to start messaging.</p>
      </div>
      <div id="chat-list-rows"></div>
    </div>
  `;
}

function wireListUI(root, getFilter) {
  root.querySelector("#btn-new-chat")?.addEventListener("click", () => navigate("people"));

  const menuBtn = root.querySelector("#btn-menu");
  const menu = root.querySelector("#header-menu");
  menuBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    menu.hidden = !menu.hidden;
  });
  document.addEventListener("click", () => { if (menu) menu.hidden = true; });

  menu?.addEventListener("click", async (e) => {
    e.stopPropagation();
    const item = e.target.closest("[data-action]");
    if (!item) return;
    menu.hidden = true;
    if (item.dataset.action === "settings") navigate("settings");
    if (item.dataset.action === "people") navigate("people");
    if (item.dataset.action === "logout") {
      if (!confirm("Sign out?")) return;
      await signOut();
      location.href = location.pathname;
    }
  });

  root.querySelector("#chat-search")?.addEventListener("input", () => {
    // re-render rows via stored list in closure — handled in listener
    if (root._rerender) root._rerender();
  });
}

export function renderChatList() {
  const isDesktop = window.matchMedia("(min-width: 900px)").matches;
  const listHost = isDesktop
    ? document.getElementById("list-panel-root")
    : document.getElementById("page-root");

  const pageRoot = document.getElementById("page-root");

  if (!listHost) return () => {};

  // Desktop: keep empty state on the right
  if (isDesktop && pageRoot) {
    pageRoot.innerHTML = `
      <div class="wp-empty" id="wp-empty">
        <div class="wp-empty__icon"><i class="bi bi-chat-dots"></i></div>
        <h2 class="wp-empty__title">Nexus</h2>
        <p class="wp-empty__desc">Send and receive messages in real time.<br/>Select a chat to start messaging.</p>
        <p class="wp-empty__lock"><i class="bi bi-lock-fill"></i> Your personal messages stay on your devices</p>
      </div>
    `;
  }

  listHost.innerHTML = buildListHTML();
  wireListUI(listHost);

  let allConvs = [];

  const paint = async () => {
    const rowsEl = listHost.querySelector("#chat-list-rows");
    const emptyEl = listHost.querySelector("#chat-list-empty");
    const q = (listHost.querySelector("#chat-search")?.value || "").toLowerCase();
    if (!rowsEl) return;

    const activeId = location.hash.startsWith("#chat/")
      ? location.hash.replace("#chat/", "").split("?")[0]
      : null;

    let list = allConvs;
    if (q) {
      list = [];
      for (const conv of allConvs) {
        const other = await resolveOtherUser(conv);
        const name = (other?.displayName || other?.username || "").toLowerCase();
        const last = (conv.lastMessage?.text || "").toLowerCase();
        if (name.includes(q) || last.includes(q)) list.push(conv);
      }
    }

    if (!list.length) {
      rowsEl.innerHTML = "";
      if (emptyEl) emptyEl.style.display = "flex";
      return;
    }
    if (emptyEl) emptyEl.style.display = "none";

    const parts = [];
    for (const conv of list) {
      const other = await resolveOtherUser(conv);
      parts.push(renderRow(conv, other, activeId));
    }
    rowsEl.innerHTML = parts.join("");
    rowsEl.querySelectorAll(".list-row").forEach((el) => {
      el.addEventListener("click", () => {
        const cid = el.dataset.cid;
        if (cid) navigate(`chat/${cid}`);
      });
    });
  };

  listHost._rerender = paint;

  unsub = listenMyConversations(async (list) => {
    allConvs = list;
    setState({
      conversationList: list.map((c) => c.id),
      conversations: Object.fromEntries(list.map((c) => [c.id, c])),
    });
    await paint();
  });

  return () => {
    if (unsub) {
      unsub();
      unsub = null;
    }
    // don't clear list-panel on desktop when opening a chat
  };
}

export default { renderChatList };