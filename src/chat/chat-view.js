/**
 * Chat conversation view — WhatsApp-style, realtime
 */

import {
  listenMessages,
  sendTextMessage,
  markConversationRead,
  getUserProfile,
  deleteMessageForEveryone,
} from "../firebase/firestore.js";
import { auth } from "../config/firebase.js";
import { navigate } from "../core/router.js";
import { formatMessageTime, isWithin24Hours } from "../utils/date.js";
import { getDraft, setDraft } from "../core/state.js";
import { showToast } from "../components/toast.js";

let unsubMessages = null;

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderMessage(msg, me) {
  if (msg.deleted) {
    return `
      <div class="msg deleted ${msg.senderId === me ? "out" : "in"}" data-mid="${msg.id}">
        <span class="msg-deleted-label"><i class="bi bi-slash-circle"></i> This message was deleted</span>
      </div>
    `;
  }

  const isOut = msg.senderId === me;
  const time = msg.createdAt ? formatMessageTime(msg.createdAt) : "";
  const canDelete = isOut && isWithin24Hours(msg.createdAt);

  return `
    <div class="msg ${isOut ? "out" : "in"}"
         data-mid="${msg.id}"
         data-can-delete="${canDelete ? "1" : "0"}">
      <div class="msg-body">${escapeHtml(msg.text || "")}</div>
      <div class="msg-meta">
        <span class="msg-time">${time}</span>
        ${isOut ? '<span class="msg-ticks" title="Sent"><i class="bi bi-check2-all"></i></span>' : ""}
      </div>
    </div>
  `;
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

  // Keep chat list alive on desktop
  if (isDesktop) {
    const listRoot = document.getElementById("list-panel-root");
    if (listRoot && !listRoot.querySelector("#chat-list-rows")) {
      import("./chat-list.js").then((m) => m.renderChatList());
    }
  }

  root.innerHTML = `
    <header class="app-header chat-header">
      <button type="button" class="btn btn--icon btn--ghost" id="btn-back" aria-label="Back" ${isDesktop ? 'style="display:none"' : ""}>
        <i class="bi bi-arrow-left" style="font-size:1.25rem"></i>
      </button>
      <div class="avatar avatar--sm" id="chat-avatar">?</div>
      <div class="chat-header__info">
        <div class="app-header__title" id="chat-title">Chat</div>
        <div class="chat-header__status" id="chat-status">tap for info</div>
      </div>
      <div class="app-header__actions">
        <button type="button" class="btn btn--icon btn--ghost" id="btn-video" title="Video call" aria-label="Video call">
          <i class="bi bi-camera-video" style="font-size:1.2rem"></i>
        </button>
        <button type="button" class="btn btn--icon btn--ghost" id="btn-audio" title="Voice call" aria-label="Voice call">
          <i class="bi bi-telephone" style="font-size:1.15rem"></i>
        </button>
        <button type="button" class="btn btn--icon btn--ghost" id="btn-chat-menu" title="Menu" aria-label="Menu">
          <i class="bi bi-three-dots-vertical" style="font-size:1.2rem"></i>
        </button>
        <div id="chat-menu" class="menu-dropdown" hidden>
          <button type="button" class="menu-dropdown__item" data-action="info">
            <i class="bi bi-info-circle"></i> Contact info
          </button>
          <button type="button" class="menu-dropdown__item" data-action="search">
            <i class="bi bi-search"></i> Search
          </button>
          <button type="button" class="menu-dropdown__item" data-action="mute">
            <i class="bi bi-bell-slash"></i> Mute
          </button>
          <button type="button" class="menu-dropdown__item menu-dropdown__item--danger" data-action="clear">
            <i class="bi bi-trash"></i> Clear chat
          </button>
        </div>
      </div>
    </header>

    <div class="messages-area" id="messages-scroll">
      <div class="empty-state" id="msg-empty" hidden>
        <div class="empty-state__title">No messages yet</div>
        <p class="empty-state__desc">Say hello 👋</p>
      </div>
      <div id="messages-list" class="messages-list"></div>
    </div>

    <div class="composer-bar" id="composer">
      <button type="button" class="btn btn--icon btn--ghost composer-btn" id="btn-emoji" title="Emoji" aria-label="Emoji">
        <i class="bi bi-emoji-smile" style="font-size:1.35rem"></i>
      </button>
      <button type="button" class="btn btn--icon btn--ghost composer-btn" id="btn-attach" title="Attach" aria-label="Attach">
        <i class="bi bi-paperclip" style="font-size:1.25rem"></i>
      </button>
      <textarea
        id="msg-input"
        class="composer-input"
        rows="1"
        placeholder="Type a message"
        enterkeyhint="send"
        autocomplete="off"
      ></textarea>
      <button type="button" class="btn btn--primary btn--icon composer-send" id="btn-send" disabled aria-label="Send">
        <i class="bi bi-send-fill" style="font-size:1.1rem"></i>
      </button>
    </div>
  `;

  // Inject chat-specific styles once per mount
  const style = document.createElement("style");
  style.setAttribute("data-chat-view", "1");
  style.textContent = `
    .chat-header { gap: 10px; }
    .chat-header__info { flex: 1; min-width: 0; }
    .chat-header__status {
      font-size: 12px;
      color: var(--text-secondary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .messages-area {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      -webkit-overflow-scrolling: touch;
      overscroll-behavior-y: contain;
      padding: 12px 10px 8px;
      display: flex;
      flex-direction: column;
      background: var(--surface-0);
      background-image: radial-gradient(var(--border-subtle) 1px, transparent 1px);
      background-size: 18px 18px;
      background-position: 0 0;
    }

    .messages-list {
      display: flex;
      flex-direction: column;
      gap: 3px;
      margin-top: auto;
    }

    .msg {
      max-width: min(78%, 420px);
      padding: 6px 10px 4px;
      border-radius: 10px;
      font-size: 14.5px;
      line-height: 1.4;
      position: relative;
      word-break: break-word;
      box-shadow: 0 1px 0.5px rgba(0,0,0,0.08);
      user-select: text;
      -webkit-user-select: text;
    }
    .msg.out {
      align-self: flex-end;
      background: var(--bubble-out);
      color: var(--bubble-out-text);
      border-bottom-right-radius: 3px;
    }
    .msg.in {
      align-self: flex-start;
      background: var(--bubble-in);
      color: var(--bubble-in-text);
      border-bottom-left-radius: 3px;
    }
    .msg.deleted {
      opacity: 0.65;
      box-shadow: none;
    }
    .msg-deleted-label {
      font-size: 13px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .msg-body { white-space: pre-wrap; }
    .msg-meta {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      float: right;
      margin: 2px 0 0 12px;
      font-size: 11px;
      opacity: 0.7;
      line-height: 1;
    }
    .msg-ticks { font-size: 14px; line-height: 1; }

    .composer-bar {
      display: flex;
      align-items: flex-end;
      gap: 4px;
      padding: 6px 8px;
      padding-bottom: max(6px, env(safe-area-inset-bottom));
      background: var(--surface-1);
      border-top: 1px solid var(--border-subtle);
      flex-shrink: 0;
    }
    .composer-btn { flex-shrink: 0; color: var(--text-secondary); }
    .composer-input {
      flex: 1;
      min-height: 42px;
      max-height: 120px;
      border: none;
      border-radius: 22px;
      padding: 10px 16px;
      resize: none;
      background: var(--surface-2);
      color: var(--text-primary);
      font-size: 15px;
      line-height: 1.35;
      outline: none;
      font-family: inherit;
    }
    .composer-input:focus {
      box-shadow: 0 0 0 2px var(--color-accent-muted);
    }
    .composer-send {
      flex-shrink: 0;
      width: 44px;
      height: 44px;
      border-radius: 50%;
    }
    .composer-send:disabled {
      opacity: 0.45;
    }

    @media (min-width: 900px) {
      .messages-area { padding: 16px 24px; }
      .msg { max-width: min(65%, 480px); }
    }
  `;
  root.appendChild(style);

  /* ── elements ── */
  const input = document.getElementById("msg-input");
  const sendBtn = document.getElementById("btn-send");
  const listEl = document.getElementById("messages-list");
  const scrollEl = document.getElementById("messages-scroll");
  const emptyEl = document.getElementById("msg-empty");
  const menu = document.getElementById("chat-menu");

  /* ── back ── */
  document.getElementById("btn-back")?.addEventListener("click", () => {
    navigate("chats");
  });

  /* ── header menu ── */
  document.getElementById("btn-chat-menu")?.addEventListener("click", (e) => {
    e.stopPropagation();
    menu.hidden = !menu.hidden;
  });
  document.addEventListener("click", closeMenu);
  function closeMenu() {
    if (menu) menu.hidden = true;
  }

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

  /* ── call buttons (architecture ready) ── */
  document.getElementById("btn-video")?.addEventListener("click", () => {
    showToast("Video call — WebRTC coming in next phase");
  });
  document.getElementById("btn-audio")?.addEventListener("click", () => {
    showToast("Voice call — WebRTC coming in next phase");
  });

  /* ── emoji / attach ── */
  document.getElementById("btn-emoji")?.addEventListener("click", () => {
    showToast("Emoji picker — coming soon");
  });
  document.getElementById("btn-attach")?.addEventListener("click", () => {
    showToast("Media attach — Storage phase next");
  });

  /* ── composer ── */
  input.value = getDraft(cid) || "";
  sendBtn.disabled = !input.value.trim();
  autoGrow();

  input.addEventListener("input", () => {
    sendBtn.disabled = !input.value.trim();
    autoGrow();
    setDraft(cid, input.value);
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      doSend();
    }
  });

  sendBtn.addEventListener("click", doSend);

  function autoGrow() {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 120) + "px";
  }

  async function doSend() {
    const text = input.value.trim();
    if (!text) return;
    sendBtn.disabled = true;
    try {
      await sendTextMessage(cid, text);
      input.value = "";
      input.style.height = "auto";
      setDraft(cid, "");
      sendBtn.disabled = true;
    } catch (err) {
      console.error(err);
      showToast(err.message || "Failed to send");
      sendBtn.disabled = !input.value.trim();
    }
  }

  /* ── load peer profile ── */
  (async () => {
    const otherUid = cid.split("_").find((u) => u !== me);
    if (!otherUid) return;
    try {
      const p = await getUserProfile(otherUid);
      if (!p) return;
      const title = p.displayName || p.username || "User";
      document.getElementById("chat-title").textContent = title;
      document.getElementById("chat-status").textContent = p.username
        ? `@${p.username}`
        : "tap for info";
      const av = document.getElementById("chat-avatar");
      if (p.photoURL) {
        av.innerHTML = `<img src="${escapeHtml(p.photoURL)}" alt="">`;
      } else {
        av.textContent = (title[0] || "?").toUpperCase();
      }
    } catch (_) {}
  })();

  /* ── messages listener ── */
  if (unsubMessages) {
    unsubMessages();
    unsubMessages = null;
  }

  unsubMessages = listenMessages(cid, 60, (msgs, err) => {
    if (err) {
      showToast("Could not load messages");
      return;
    }

    if (!msgs.length) {
      listEl.innerHTML = "";
      emptyEl.hidden = false;
      return;
    }

    emptyEl.hidden = true;
    const nearBottom =
      scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight < 120;

    listEl.innerHTML = msgs.map((m) => renderMessage(m, me)).join("");

    if (nearBottom || msgs.length < 5) {
      requestAnimationFrame(() => {
        scrollEl.scrollTop = scrollEl.scrollHeight;
      });
    }

    // Long-press / right-click delete for everyone
    listEl.querySelectorAll(".msg.out[data-can-delete='1']").forEach((el) => {
      el.addEventListener("contextmenu", onDeleteContext);
      let pressTimer;
      el.addEventListener("touchstart", (e) => {
        pressTimer = setTimeout(() => onDeleteContext(e, el), 550);
      }, { passive: true });
      el.addEventListener("touchend", () => clearTimeout(pressTimer));
      el.addEventListener("touchmove", () => clearTimeout(pressTimer));
    });

    markConversationRead(cid).catch(() => {});
  });

  async function onDeleteContext(e, el) {
    if (e && e.preventDefault) e.preventDefault();
    const node = el || e.currentTarget;
    if (!confirm("Delete message for everyone?")) return;
    try {
      await deleteMessageForEveryone(cid, node.dataset.mid);
    } catch (err) {
      showToast(err.message || "Cannot delete");
    }
  }

  // Focus input on desktop
  if (isDesktop) {
    setTimeout(() => input.focus(), 100);
  }

  /* ── cleanup ── */
  return () => {
    document.removeEventListener("click", closeMenu);
    if (unsubMessages) {
      unsubMessages();
      unsubMessages = null;
    }
    if (input) setDraft(cid, input.value);
    root.innerHTML = "";
  };
}

export default { renderChatView };