/**
 * Message actions — copy, reply, delete for everyone, react entry
 */

import { deleteMessageForEveryone } from "../firebase/firestore.js";
import { isWithin24Hours } from "../utils/date.js";
import { showToast } from "../components/toast.js";
import { auth } from "../config/firebase.js";
import { toggleReaction, QUICK_REACTIONS } from "./reactions.js";

/**
 * @typedef {object} MessageActionHandlers
 * @property {(msg: object) => void} [onReply]
 * @property {(msg: object) => void} [onDelete]
 * @property {(msg: object) => void} [onInfo]
 */

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Can current user delete this message for everyone?
 */
export function canDeleteForEveryone(msg, meUid = auth.currentUser?.uid) {
  if (!msg || !meUid) return false;
  if (msg.deleted) return false;
  if (msg.senderId !== meUid) return false;
  return isWithin24Hours(msg.createdAt);
}

/**
 * Copy message text to clipboard
 */
export async function copyMessageText(msg) {
  const text = (msg?.text || "").trim();
  if (!text) {
    showToast("Nothing to copy");
    return false;
  }
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    showToast("Copied");
    return true;
  } catch {
    showToast("Could not copy");
    return false;
  }
}

/**
 * Delete for everyone (Firestore soft-delete)
 */
export async function deleteForEveryone(conversationId, messageId) {
  if (!conversationId || !messageId) throw new Error("Missing ids");
  await deleteMessageForEveryone(conversationId, messageId);
}

/**
 * Action sheet HTML
 */
export function messageActionsSheetHtml(msg, meUid) {
  const mine = msg?.senderId === meUid;
  const del = canDeleteForEveryone(msg, meUid);
  const hasText = !!(msg?.text && msg.text.trim()) && !msg?.deleted;

  return `
    <div class="msg-action-sheet" role="menu" data-mid="${escapeHtml(msg?.id || "")}">
      <div class="msg-action-sheet__react">
        ${QUICK_REACTIONS.map(
          (e) =>
            `<button type="button" class="msg-action-sheet__emoji" data-action="react" data-emoji="${e}">${e}</button>`
        ).join("")}
      </div>
      ${
        hasText
          ? `<button type="button" class="msg-action-sheet__item" data-action="copy">
               <i class="bi bi-clipboard"></i> Copy
             </button>`
          : ""
      }
      ${
        !msg?.deleted
          ? `<button type="button" class="msg-action-sheet__item" data-action="reply">
               <i class="bi bi-reply"></i> Reply
             </button>`
          : ""
      }
      ${
        del
          ? `<button type="button" class="msg-action-sheet__item msg-action-sheet__item--danger" data-action="delete">
               <i class="bi bi-trash"></i> Delete for everyone
             </button>`
          : ""
      }
      <button type="button" class="msg-action-sheet__item" data-action="cancel">
        Cancel
      </button>
    </div>
  `;
}

/**
 * Show floating action sheet near coordinates
 * @returns {() => void} close
 */
export function openMessageActions({
  msg,
  conversationId,
  x,
  y,
  handlers = {},
}) {
  closeMessageActions();

  const me = auth.currentUser?.uid;
  const wrap = document.createElement("div");
  wrap.id = "msg-action-overlay";
  wrap.className = "msg-action-overlay is-open";
  wrap.innerHTML = `
    <div class="msg-action-backdrop" data-action="cancel"></div>
    <div class="msg-action-anchor">
      ${messageActionsSheetHtml(msg, me)}
    </div>
  `;

  const anchor = wrap.querySelector(".msg-action-anchor");
  if (anchor) {
    const left = Math.min(window.innerWidth - 280, Math.max(12, (x || 0) - 120));
    const top = Math.min(window.innerHeight - 320, Math.max(12, (y || 0) - 20));
    anchor.style.left = left + "px";
    anchor.style.top = top + "px";
  }

  const onClick = async (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const action = btn.getAttribute("data-action");

    if (action === "cancel") {
      closeMessageActions();
      return;
    }

    if (action === "copy") {
      await copyMessageText(msg);
      closeMessageActions();
      return;
    }

    if (action === "reply") {
      closeMessageActions();
      handlers.onReply?.(msg);
      return;
    }

    if (action === "react") {
      const emoji = btn.getAttribute("data-emoji");
      try {
        await toggleReaction(conversationId, msg.id, emoji);
      } catch (err) {
        showToast(err.message || "Could not react");
      }
      closeMessageActions();
      return;
    }

    if (action === "delete") {
      if (!canDeleteForEveryone(msg, me)) {
        showToast("Cannot delete this message");
        closeMessageActions();
        return;
      }
      if (!confirm("Delete message for everyone?")) return;
      try {
        await deleteForEveryone(conversationId, msg.id);
        handlers.onDelete?.(msg);
        showToast("Message deleted");
      } catch (err) {
        showToast(err.message || "Could not delete");
      }
      closeMessageActions();
    }
  };

  wrap.addEventListener("click", onClick);
  document.body.appendChild(wrap);

  const onKey = (e) => {
    if (e.key === "Escape") closeMessageActions();
  };
  document.addEventListener("keydown", onKey);
  wrap._onKey = onKey;

  return closeMessageActions;
}

export function closeMessageActions() {
  const el = document.getElementById("msg-action-overlay");
  if (el) {
    if (el._onKey) document.removeEventListener("keydown", el._onKey);
    el.remove();
  }
}

/**
 * Bind long-press / contextmenu on message list
 * @param {ParentNode} listEl
 * @param {string} conversationId
 * @param {MessageActionHandlers} handlers
 * @param {() => object[]} getMessages - returns current messages array
 */
export function bindMessageActions(listEl, conversationId, handlers = {}, getMessages) {
  if (!listEl) return () => {};

  let pressTimer = null;

  const findMsg = (mid) => {
    const list = typeof getMessages === "function" ? getMessages() : [];
    return list.find((m) => m.id === mid) || { id: mid };
  };

  const openAt = (mid, x, y) => {
    const msg = findMsg(mid);
    openMessageActions({
      msg,
      conversationId,
      x,
      y,
      handlers,
    });
  };

  const onContext = (e) => {
    const node = e.target.closest(".msg[data-mid]");
    if (!node || !listEl.contains(node)) return;
    e.preventDefault();
    openAt(node.getAttribute("data-mid"), e.clientX, e.clientY);
  };

  const onTouchStart = (e) => {
    const node = e.target.closest(".msg[data-mid]");
    if (!node || !listEl.contains(node)) return;
    const t = e.touches[0];
    pressTimer = setTimeout(() => {
      openAt(node.getAttribute("data-mid"), t.clientX, t.clientY);
    }, 500);
  };

  const clearPress = () => {
    if (pressTimer) clearTimeout(pressTimer);
    pressTimer = null;
  };

  listEl.addEventListener("contextmenu", onContext);
  listEl.addEventListener("touchstart", onTouchStart, { passive: true });
  listEl.addEventListener("touchend", clearPress);
  listEl.addEventListener("touchmove", clearPress);

  return () => {
    clearPress();
    closeMessageActions();
    listEl.removeEventListener("contextmenu", onContext);
    listEl.removeEventListener("touchstart", onTouchStart);
    listEl.removeEventListener("touchend", clearPress);
    listEl.removeEventListener("touchmove", clearPress);
  };
}

export const MESSAGE_ACTIONS_CSS = `
  .msg-action-overlay {
    position: fixed; inset: 0; z-index: 800;
  }
  .msg-action-backdrop {
    position: absolute; inset: 0;
    background: rgba(0,0,0,0.35);
  }
  .msg-action-anchor {
    position: fixed;
    width: min(280px, calc(100vw - 24px));
  }
  .msg-action-sheet {
    background: var(--surface-1);
    border: 1px solid var(--border-default);
    border-radius: 14px;
    overflow: hidden;
    box-shadow: 0 12px 40px rgba(0,0,0,0.4);
  }
  .msg-action-sheet__react {
    display: flex; gap: 2px; justify-content: space-between;
    padding: 10px 8px; border-bottom: 1px solid var(--border-subtle);
  }
  .msg-action-sheet__emoji {
    border: none; background: transparent;
    font-size: 22px; width: 36px; height: 36px;
    border-radius: 50%; cursor: pointer;
  }
  .msg-action-sheet__emoji:hover { background: var(--surface-2); }
  .msg-action-sheet__item {
    display: flex; align-items: center; gap: 12px;
    width: 100%; padding: 14px 16px;
    border: none; background: transparent;
    color: var(--text-primary); font-size: 15px;
    text-align: left; cursor: pointer;
  }
  .msg-action-sheet__item:hover { background: var(--surface-2); }
  .msg-action-sheet__item--danger { color: var(--color-danger, #e53935); }
`;

export default {
  canDeleteForEveryone,
  copyMessageText,
  deleteForEveryone,
  messageActionsSheetHtml,
  openMessageActions,
  closeMessageActions,
  bindMessageActions,
  MESSAGE_ACTIONS_CSS,
};