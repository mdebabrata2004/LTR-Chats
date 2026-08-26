/**
 * Chat conversation view — Telegram / WhatsApp style
 * Light + Dark · spacer bottom-stack · scroll FAB · modules wired
 */

import {
  listenMessages,
  markConversationRead,
  getUserProfile,
} from "../firebase/firestore.js";
import { auth } from "../config/firebase.js";
import { navigate } from "../core/router.js";
import { showToast } from "../components/toast.js";

import {
  renderMessageListWithDays,
  MESSAGE_CSS,
} from "./message-renderer.js";
import {
  bindReactionHandlers,
  REACTIONS_CSS,
} from "./reactions.js";
import {
  bindMessageActions,
  MESSAGE_ACTIONS_CSS,
} from "./message-actions.js";
import { mountComposer, COMPOSER_CSS } from "./composer.js";
import { openAttachMenu, ATTACHMENTS_CSS } from "./attachments.js";

let unsubMessages = null;

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function ensureChatStyles() {
  const old = document.getElementById("chat-view-styles");
  if (old) old.remove();

  const style = document.createElement("style");
  style.id = "chat-view-styles";
  style.textContent = `
    ${MESSAGE_CSS}
    ${REACTIONS_CSS}
    ${MESSAGE_ACTIONS_CSS}
    ${COMPOSER_CSS}
    ${ATTACHMENTS_CSS}

    /* ══ Tokens ══ */
    :root,
    [data-theme="light"] {
      --ch-header-bg: rgba(248, 249, 250, 0.92);
      --ch-header-border: rgba(0, 0, 0, 0.08);
      --ch-header-shadow: 0 1px 3px rgba(0,0,0,0.10), 0 4px 12px rgba(0,0,0,0.04);
      --ch-wall-bg: #e5ddd5;
      --ch-wall-dot: rgba(0,0,0,0.06);
      --ch-composer-bg: rgba(248, 249, 250, 0.94);
      --ch-composer-border: rgba(0, 0, 0, 0.07);
      --ch-composer-shadow: 0 -1px 2px rgba(0,0,0,0.06);
      --ch-day-bg: rgba(255,255,255,0.82);
      --ch-day-border: rgba(0,0,0,0.07);
      --ch-day-color: #667781;
      --ch-fab-bg: rgba(255,255,255,0.92);
      --ch-fab-border: rgba(0,0,0,0.10);
      --ch-fab-shadow: 0 4px 14px rgba(0,0,0,0.18);
      --ch-fab-color: #54656f;
      --ch-menu-bg: rgba(255,255,255,0.97);
      --ch-menu-border: rgba(0,0,0,0.08);
      --ch-menu-shadow: 0 8px 28px rgba(0,0,0,0.14);
      --ch-menu-item-hover: rgba(0,0,0,0.05);
      --ch-menu-separator: rgba(0,0,0,0.07);
      --ch-avatar-border: rgba(0,0,0,0.08);
      --ch-avatar-bg: #d1d7db;
      --ch-avatar-color: #54656f;
      --ch-title-color: #111b21;
      --ch-status-color: #667781;
      --ch-icon-color: #54656f;
      --ch-online: #25d366;
      --ch-danger: #e53935;
      --ch-btn-hover: rgba(0,0,0,0.06);
      --ch-scrollbar: rgba(0,0,0,0.14);
      --ch-bubble-in: #ffffff;
      --ch-bubble-out: #d9fdd3;
      --ch-bubble-text: #111b21;
    }

    [data-theme="dark"] {
      --ch-header-bg: rgba(31, 41, 50, 0.92);
      --ch-header-border: rgba(255,255,255,0.05);
      --ch-header-shadow: 0 1px 3px rgba(0,0,0,0.35);
      --ch-wall-bg: #0d1418;
      --ch-wall-dot: rgba(255,255,255,0.03);
      --ch-composer-bg: rgba(31, 41, 50, 0.94);
      --ch-composer-border: rgba(255,255,255,0.05);
      --ch-composer-shadow: 0 -1px 2px rgba(0,0,0,0.30);
      --ch-day-bg: rgba(10, 30, 42, 0.78);
      --ch-day-border: rgba(255,255,255,0.06);
      --ch-day-color: rgba(255,255,255,0.55);
      --ch-fab-bg: rgba(31, 41, 50, 0.90);
      --ch-fab-border: rgba(255,255,255,0.08);
      --ch-fab-shadow: 0 4px 16px rgba(0,0,0,0.45);
      --ch-fab-color: rgba(255,255,255,0.75);
      --ch-menu-bg: rgba(24, 34, 42, 0.97);
      --ch-menu-border: rgba(255,255,255,0.07);
      --ch-menu-shadow: 0 12px 36px rgba(0,0,0,0.50);
      --ch-menu-item-hover: rgba(255,255,255,0.06);
      --ch-menu-separator: rgba(255,255,255,0.07);
      --ch-avatar-border: rgba(255,255,255,0.07);
      --ch-avatar-bg: #2a3942;
      --ch-avatar-color: #aebac1;
      --ch-title-color: #e9edef;
      --ch-status-color: #aebac1;
      --ch-icon-color: #aebac1;
      --ch-online: #3ddc84;
      --ch-danger: #ff6b6b;
      --ch-btn-hover: rgba(255,255,255,0.07);
      --ch-scrollbar: rgba(255,255,255,0.12);
      --ch-bubble-in: #202c33;
      --ch-bubble-out: #005c4b;
      --ch-bubble-text: #e9edef;
    }

    /* system preference when no data-theme */
    @media (prefers-color-scheme: dark) {
      :root:not([data-theme="light"]) {
        --ch-header-bg: rgba(31, 41, 50, 0.92);
        --ch-header-border: rgba(255,255,255,0.05);
        --ch-wall-bg: #0d1418;
        --ch-wall-dot: rgba(255,255,255,0.03);
        --ch-composer-bg: rgba(31, 41, 50, 0.94);
        --ch-composer-border: rgba(255,255,255,0.05);
        --ch-day-bg: rgba(10, 30, 42, 0.78);
        --ch-day-color: rgba(255,255,255,0.55);
        --ch-menu-bg: rgba(24, 34, 42, 0.97);
        --ch-title-color: #e9edef;
        --ch-status-color: #aebac1;
        --ch-icon-color: #aebac1;
        --ch-avatar-bg: #2a3942;
        --ch-bubble-in: #202c33;
        --ch-bubble-out: #005c4b;
        --ch-bubble-text: #e9edef;
        --ch-btn-hover: rgba(255,255,255,0.07);
        --ch-scrollbar: rgba(255,255,255,0.12);
      }
    }

    #page-root {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 0;
      overflow: hidden;
    }

    .chat-view {
      display: flex;
      flex-direction: column;
      flex: 1 1 auto;
      height: 100%;
      min-height: 0;
      width: 100%;
      overflow: hidden;
      position: relative;
    }

    /* Header */
    .chat-header {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 8px 8px 4px;
      min-height: 56px;
      background: var(--ch-header-bg);
      backdrop-filter: blur(16px) saturate(1.4);
      -webkit-backdrop-filter: blur(16px) saturate(1.4);
      border-bottom: 1px solid var(--ch-header-border);
      box-shadow: var(--ch-header-shadow);
      z-index: 10;
    }
    .chat-header__info {
      flex: 1;
      min-width: 0;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      gap: 1px;
    }
    .chat-header__info:active { opacity: 0.75; }
    .chat-header__title,
    .chat-header .app-header__title {
      font-size: 15.5px;
      font-weight: 600;
      color: var(--ch-title-color);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      line-height: 1.2;
    }
    .chat-header__status {
      font-size: 12px;
      color: var(--ch-status-color);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .chat-header__status--online::before {
      content: "";
      display: inline-block;
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--ch-online);
      margin-right: 5px;
      vertical-align: middle;
    }

    .chat-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      overflow: hidden;
      flex-shrink: 0;
      background: var(--ch-avatar-bg);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 15px;
      color: var(--ch-avatar-color);
      border: 1.5px solid var(--ch-avatar-border);
      cursor: pointer;
      user-select: none;
    }
    .chat-avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .app-header__actions {
      position: relative;
      display: flex;
      align-items: center;
      gap: 0;
      flex-shrink: 0;
    }
    .chat-header .btn--icon {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      border: none;
      background: transparent;
      color: var(--ch-icon-color);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }
    .chat-header .btn--icon:hover { background: var(--ch-btn-hover); }

    /* Messages */
    .messages-area {
      flex: 1 1 auto;
      min-height: 0;
      overflow-y: auto;
      overflow-x: hidden;
      -webkit-overflow-scrolling: touch;
      overscroll-behavior-y: contain;
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
      padding: 8px;
      box-sizing: border-box;
      background-color: var(--ch-wall-bg);
      background-image: radial-gradient(circle, var(--ch-wall-dot) 1px, transparent 1px);
      background-size: 18px 18px;
    }
    .messages-area::-webkit-scrollbar { width: 4px; }
    .messages-area::-webkit-scrollbar-thumb {
      background: var(--ch-scrollbar);
      border-radius: 4px;
    }

    .messages-spacer {
      flex: 1 1 auto;
      min-height: 0;
      pointer-events: none;
    }

    .messages-list {
      flex: 0 0 auto;
      display: flex;
      flex-direction: column;
      gap: 2px;
      width: 100%;
      margin: 0;
      padding: 0;
    }

    /* Bubbles — support .out/.in and .msg--out/.msg--in */
    .messages-list .msg {
      max-width: min(72%, 460px);
      padding: 6px 8px 4px;
      border-radius: 7.5px;
      font-size: 14.2px;
      line-height: 1.45;
      position: relative;
      word-break: break-word;
      box-shadow: 0 1px 1px rgba(0,0,0,0.10);
      color: var(--ch-bubble-text);
    }
    .messages-list .msg.out,
    .messages-list .msg.msg--out {
      background: var(--ch-bubble-out);
      border-top-right-radius: 0;
      align-self: flex-end;
    }
    .messages-list .msg.in,
    .messages-list .msg.msg--in {
      background: var(--ch-bubble-in);
      border-top-left-radius: 0;
      align-self: flex-start;
    }
    .messages-list .msg.deleted {
      opacity: 0.7;
      font-style: italic;
    }

    .messages-list .msg-day {
      margin: 10px 0 6px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .messages-list .msg-day span {
      background: var(--ch-day-bg);
      border: 1px solid var(--ch-day-border);
      color: var(--ch-day-color);
      font-size: 11.5px;
      font-weight: 500;
      padding: 3px 10px;
      border-radius: 20px;
    }

    .messages-area > .empty-state:not([hidden]) {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 32px 24px;
      gap: 8px;
    }
    .messages-area > .empty-state[hidden] {
      display: none !important;
    }
    .empty-state__title {
      font-size: 15px;
      font-weight: 600;
      color: var(--ch-title-color);
      opacity: 0.5;
    }
    .empty-state__desc {
      font-size: 13.5px;
      color: var(--ch-status-color);
      opacity: 0.5;
      margin: 0;
    }

    #btn-scroll-bottom {
      position: absolute;
      right: 16px;
      bottom: 76px;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      border: 1px solid var(--ch-fab-border);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 20;
      background: var(--ch-fab-bg);
      box-shadow: var(--ch-fab-shadow);
      color: var(--ch-fab-color);
      opacity: 0;
      pointer-events: none;
      transform: translateY(10px) scale(0.88);
      transition: opacity 0.2s, transform 0.2s;
    }
    #btn-scroll-bottom.visible {
      opacity: 1;
      pointer-events: auto;
      transform: translateY(0) scale(1);
    }

    #composer-host {
      flex-shrink: 0;
      padding: 6px 8px calc(6px + env(safe-area-inset-bottom, 0px));
      background: var(--ch-composer-bg);
      border-top: 1px solid var(--ch-composer-border);
      box-shadow: var(--ch-composer-shadow);
    }

    .chat-view .menu-dropdown {
      position: absolute;
      top: calc(100% + 6px);
      right: 0;
      min-width: 210px;
      background: var(--ch-menu-bg);
      border: 1px solid var(--ch-menu-border);
      border-radius: 12px;
      box-shadow: var(--ch-menu-shadow);
      padding: 5px;
      z-index: 50;
    }
    .chat-view .menu-dropdown[hidden] { display: none !important; }
    .chat-view .menu-dropdown__item {
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
      padding: 11px 14px;
      border: none;
      background: transparent;
      color: var(--ch-title-color);
      font-size: 14.5px;
      text-align: left;
      border-radius: 8px;
      cursor: pointer;
    }
    .chat-view .menu-dropdown__item:hover {
      background: var(--ch-menu-item-hover);
    }
    .chat-view .menu-dropdown__separator {
      height: 1px;
      background: var(--ch-menu-separator);
      margin: 4px 2px;
    }
    .chat-view .menu-dropdown__item--danger {
      color: var(--ch-danger);
    }

    @media (min-width: 900px) {
      .messages-area { padding: 12px 20px 8px; }
      .chat-header { padding: 8px 16px 8px 12px; }
      #composer-host {
        padding: 8px 20px calc(8px + env(safe-area-inset-bottom, 0px));
      }
      #btn-scroll-bottom { bottom: 84px; right: 24px; }
      .messages-list .msg { max-width: min(58%, 460px); }
    }
  `;
  document.head.appendChild(style);
}

function scrollToBottom(el, force) {
  if (!el) return;
  requestAnimationFrame(() => {
    el.scrollTop = el.scrollHeight;
    if (force) {
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight;
      });
    }
  });
}

export function renderChatView(params) {
  const cid = params?.id;
  if (!cid) {
    navigate("chats", { replace: true });
    return () => {};
  }

  const root = document.getElementById("page-root");
  if (!root) return () => {};

  const me = auth.currentUser?.uid;
  const isDesktop = window.matchMedia("(min-width: 900px)").matches;

  if (isDesktop) {
    const listRoot = document.getElementById("list-panel-root");
    if (listRoot && !listRoot.querySelector("#chat-list-rows")) {
      import("./chat-list.js").then((m) => m.renderChatList()).catch(() => {});
    }
  }

  ensureChatStyles();

  root.innerHTML = `
    <div class="chat-view">
      <header class="app-header chat-header">
        <button type="button" class="btn btn--icon" id="btn-back" aria-label="Back"
          ${isDesktop ? 'style="display:none"' : ""}>
          <i class="bi bi-arrow-left" style="font-size:1.2rem"></i>
        </button>
        <div class="chat-avatar" id="chat-avatar" role="button" aria-label="View profile">?</div>
        <div class="chat-header__info" id="chat-header-info">
          <div class="chat-header__title" id="chat-title">Chat</div>
          <div class="chat-header__status" id="chat-status">tap for info</div>
        </div>
        <div class="app-header__actions">
          <button type="button" class="btn btn--icon" id="btn-video" title="Video call" aria-label="Video call">
            <i class="bi bi-camera-video" style="font-size:1.1rem"></i>
          </button>
          <button type="button" class="btn btn--icon" id="btn-audio" title="Voice call" aria-label="Voice call">
            <i class="bi bi-telephone" style="font-size:1.05rem"></i>
          </button>
          <button type="button" class="btn btn--icon" id="btn-chat-menu" title="Menu" aria-label="Menu">
            <i class="bi bi-three-dots-vertical" style="font-size:1.1rem"></i>
          </button>
          <div id="chat-menu" class="menu-dropdown" hidden>
            <button type="button" class="menu-dropdown__item" data-action="info">
              <i class="bi bi-person-circle"></i> Contact info
            </button>
            <button type="button" class="menu-dropdown__item" data-action="search">
              <i class="bi bi-search"></i> Search
            </button>
            <button type="button" class="menu-dropdown__item" data-action="mute">
              <i class="bi bi-bell-slash"></i> Mute notifications
            </button>
            <div class="menu-dropdown__separator"></div>
            <button type="button" class="menu-dropdown__item menu-dropdown__item--danger" data-action="clear">
              <i class="bi bi-trash3"></i> Clear chat
            </button>
          </div>
        </div>
      </header>

      <div class="messages-area" id="messages-scroll">
        <div class="empty-state" id="msg-empty" hidden>
          <div class="empty-state__icon"><i class="bi bi-chat-dots"></i></div>
          <div class="empty-state__title">No messages yet</div>
          <p class="empty-state__desc">Say hello 👋</p>
        </div>
        <div class="messages-spacer" id="messages-spacer" aria-hidden="true"></div>
        <div id="messages-list" class="messages-list"></div>
      </div>

      <button type="button" id="btn-scroll-bottom" aria-label="Scroll to bottom">
        <i class="bi bi-chevron-down" style="font-size:1rem"></i>
      </button>

      <div id="composer-host"></div>
    </div>
  `;

  const listEl = root.querySelector("#messages-list");
  const scrollEl = root.querySelector("#messages-scroll");
  const emptyEl = root.querySelector("#msg-empty");
  const spacerEl = root.querySelector("#messages-spacer");
  const menu = root.querySelector("#chat-menu");
  const fabBtn = root.querySelector("#btn-scroll-bottom");

  let latestMsgs = [];
  let unbindReactions = null;
  let unbindActions = null;

  root.querySelector("#btn-back")?.addEventListener("click", () => navigate("chats"));

  const closeMenu = () => {
    if (menu) menu.hidden = true;
  };

  root.querySelector("#btn-chat-menu")?.addEventListener("click", (e) => {
    e.stopPropagation();
    if (menu) menu.hidden = !menu.hidden;
  });
  document.addEventListener("click", closeMenu);

  menu?.addEventListener("click", (e) => {
    e.stopPropagation();
    const item = e.target.closest("[data-action]");
    if (!item) return;
    menu.hidden = true;
    const a = item.dataset.action;
    if (a === "info") showToast("Contact info — coming soon");
    if (a === "search") showToast("Search in chat — coming soon");
    if (a === "mute") showToast("Mute — coming soon");
    if (a === "clear") showToast("Clear chat — coming soon");
  });

  root.querySelector("#chat-header-info")?.addEventListener("click", () => {
    showToast("Contact info — coming soon");
  });
  root.querySelector("#chat-avatar")?.addEventListener("click", () => {
    showToast("Contact info — coming soon");
  });
  root.querySelector("#btn-video")?.addEventListener("click", () => {
    showToast("Video call — WebRTC next phase");
  });
  root.querySelector("#btn-audio")?.addEventListener("click", () => {
    showToast("Voice call — WebRTC next phase");
  });

  const updateFab = () => {
    if (!scrollEl || !fabBtn) return;
    const dist =
      scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight;
    fabBtn.classList.toggle("visible", dist > 200);
  };
  scrollEl?.addEventListener("scroll", updateFab, { passive: true });
  fabBtn?.addEventListener("click", () => scrollToBottom(scrollEl, true));

  const composer = mountComposer(root.querySelector("#composer-host"), {
    conversationId: cid,
    onSent: () => scrollToBottom(scrollEl, true),
    onAttach: () => {
      openAttachMenu(cid, {
        onSent: () => scrollToBottom(scrollEl, true),
      });
    },
    onEmoji: () => showToast("Emoji picker — coming soon"),
  });

  (async () => {
    const otherUid = String(cid)
      .split("_")
      .find((u) => u && u !== me);
    if (!otherUid) return;
    try {
      const p = await getUserProfile(otherUid);
      if (!p) return;
      const title = p.displayName || p.username || "User";
      const titleEl = root.querySelector("#chat-title");
      const statusEl = root.querySelector("#chat-status");
      const av = root.querySelector("#chat-avatar");
      if (titleEl) titleEl.textContent = title;
      if (statusEl) {
        statusEl.textContent = p.username ? `@${p.username}` : "tap for info";
        if (p.online) statusEl.classList.add("chat-header__status--online");
      }
      if (av) {
        if (p.photoURL) {
          av.innerHTML = `<img src="${escapeHtml(p.photoURL)}" alt="">`;
        } else {
          av.textContent = (title[0] || "?").toUpperCase();
        }
      }
    } catch (_) {}
  })();

  function paintMessages(msgs) {
    latestMsgs = msgs || [];

    if (!latestMsgs.length) {
      if (listEl) {
        listEl.innerHTML = "";
        listEl.hidden = true;
      }
      if (spacerEl) spacerEl.hidden = true;
      if (emptyEl) {
        emptyEl.hidden = false;
        emptyEl.style.display = "";
      }
      return;
    }

    if (emptyEl) {
      emptyEl.hidden = true;
      emptyEl.style.display = "none";
    }
    if (spacerEl) spacerEl.hidden = false;
    if (listEl) listEl.hidden = false;

    const nearBottom =
      scrollEl &&
      scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight < 160;

    listEl.innerHTML = renderMessageListWithDays(latestMsgs, me, {
      groupSender: false,
    });

    if (unbindReactions) unbindReactions();
    if (unbindActions) unbindActions();

    unbindReactions = bindReactionHandlers(listEl, cid, {
      onError: (err) => showToast(err.message || "Could not react"),
    });

    unbindActions = bindMessageActions(
      listEl,
      cid,
      {
        onReply: (msg) => composer.setReply(msg),
        onDelete: () => {},
      },
      () => latestMsgs
    );

    if (nearBottom || latestMsgs.length <= 40) {
      scrollToBottom(scrollEl, true);
    }
    updateFab();
    markConversationRead(cid).catch(() => {});
  }

  if (unsubMessages) {
    unsubMessages();
    unsubMessages = null;
  }

  unsubMessages = listenMessages(cid, 80, (msgs, err) => {
    if (err) {
      console.error(err);
      showToast("Could not load messages");
      return;
    }
    paintMessages(msgs);
  });

  if (isDesktop) setTimeout(() => composer.focus(), 120);

  return () => {
    document.removeEventListener("click", closeMenu);
    scrollEl?.removeEventListener("scroll", updateFab);
    if (unsubMessages) {
      unsubMessages();
      unsubMessages = null;
    }
    if (unbindReactions) unbindReactions();
    if (unbindActions) unbindActions();
    composer.destroy();
    root.innerHTML = "";
  };
}

export default { renderChatView };