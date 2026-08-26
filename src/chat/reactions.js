/**
 * Message reactions
 * Firestore: messages/{cid}/messages/{mid}.reactions = { [emoji]: [uid, ...] }
 * Rules must allow members to update only the reactions field (or merge map)
 */

import { db, auth } from "../config/firebase.js";
import { showToast } from "../components/toast.js";

const FieldValue = firebase.firestore.FieldValue;

/** Quick-pick strip (Telegram-style) */
export const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🔥", "👏", "🎉"];

/**
 * Toggle reaction for current user on a message
 * - If user already used this emoji → remove
 * - Else add emoji (and optionally remove their other emoji — single reaction mode)
 *
 * @param {string} conversationId
 * @param {string} messageId
 * @param {string} emoji
 * @param {{ exclusive?: boolean }} [opts] exclusive=true → one reaction per user
 */
export async function toggleReaction(conversationId, messageId, emoji, opts = {}) {
  const me = auth.currentUser;
  if (!me) throw new Error("Not authenticated");
  if (!conversationId || !messageId || !emoji) {
    throw new Error("Missing reaction params");
  }

  const exclusive = opts.exclusive !== false; // default: one reaction per user
  const ref = db
    .collection("messages")
    .doc(conversationId)
    .collection("messages")
    .doc(messageId);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error("Message not found");

    const data = snap.data() || {};
    if (data.deleted === true) throw new Error("Cannot react to deleted message");

    const reactions = { ...(data.reactions || {}) };
    const list = Array.isArray(reactions[emoji]) ? [...reactions[emoji]] : [];
    const has = list.includes(me.uid);

    if (has) {
      // remove
      const next = list.filter((id) => id !== me.uid);
      if (next.length) reactions[emoji] = next;
      else delete reactions[emoji];
    } else {
      if (exclusive) {
        // remove user from all other emoji lists
        Object.keys(reactions).forEach((key) => {
          reactions[key] = (reactions[key] || []).filter((id) => id !== me.uid);
          if (!reactions[key].length) delete reactions[key];
        });
      }
      reactions[emoji] = [...(reactions[emoji] || []), me.uid];
    }

    tx.update(ref, {
      reactions,
      // do not touch updatedAt of message content; optional:
      // reactionsUpdatedAt: FieldValue.serverTimestamp(),
    });
  });
}

/**
 * Summarize reactions for UI
 * @param {object} reactions map emoji → uid[]
 * @param {string} [myUid]
 * @returns {{ emoji: string, count: number, mine: boolean, uids: string[] }[]}
 */
export function summarizeReactions(reactions, myUid) {
  if (!reactions || typeof reactions !== "object") return [];
  return Object.entries(reactions)
    .map(([emoji, uids]) => {
      const list = Array.isArray(uids) ? uids : [];
      return {
        emoji,
        count: list.length,
        mine: myUid ? list.includes(myUid) : false,
        uids: list,
      };
    })
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count || a.emoji.localeCompare(b.emoji));
}

/**
 * HTML chips under a message bubble
 */
export function reactionsHtml(reactions, myUid) {
  const items = summarizeReactions(reactions, myUid);
  if (!items.length) return "";

  return `
    <div class="msg-reactions" role="group" aria-label="Reactions">
      ${items
        .map(
          (r) => `
        <button type="button"
          class="msg-reaction ${r.mine ? "is-mine" : ""}"
          data-react-emoji="${escapeAttr(r.emoji)}"
          title="${r.count}">
          <span class="msg-reaction__emoji">${r.emoji}</span>
          <span class="msg-reaction__count">${r.count}</span>
        </button>`
        )
        .join("")}
    </div>
  `;
}

/**
 * Quick reaction picker HTML
 */
export function reactionPickerHtml() {
  return `
    <div class="reaction-picker" role="menu" aria-label="React">
      ${QUICK_REACTIONS.map(
        (e) =>
          `<button type="button" class="reaction-picker__btn" data-pick-emoji="${e}" role="menuitem">${e}</button>`
      ).join("")}
    </div>
  `;
}

/**
 * Bind reaction chips + long-press picker on a messages container
 * @param {ParentNode} container - #messages-list
 * @param {string} conversationId
 * @param {{ onError?: (err: Error) => void }} [opts]
 */
export function bindReactionHandlers(container, conversationId, opts = {}) {
  if (!container || !conversationId) return () => {};

  const onClick = async (e) => {
    const chip = e.target.closest("[data-react-emoji]");
    if (chip) {
      e.preventDefault();
      e.stopPropagation();
      const emoji = chip.getAttribute("data-react-emoji");
      const msg = chip.closest("[data-mid]");
      const mid = msg?.getAttribute("data-mid");
      if (!mid || !emoji) return;
      try {
        await toggleReaction(conversationId, mid, emoji);
      } catch (err) {
        console.error(err);
        if (opts.onError) opts.onError(err);
        else showToast(err.message || "Could not react");
      }
      return;
    }

    const pick = e.target.closest("[data-pick-emoji]");
    if (pick) {
      e.preventDefault();
      e.stopPropagation();
      const emoji = pick.getAttribute("data-pick-emoji");
      const picker = pick.closest(".reaction-picker");
      const mid = picker?.getAttribute("data-mid");
      closePickers(container);
      if (!mid || !emoji) return;
      try {
        await toggleReaction(conversationId, mid, emoji);
      } catch (err) {
        console.error(err);
        if (opts.onError) opts.onError(err);
        else showToast(err.message || "Could not react");
      }
    }
  };

  // Long-press / right-click → picker
  let pressTimer = null;

  const openPickerFor = (msgEl, clientX, clientY) => {
    closePickers(container);
    if (!msgEl || msgEl.classList.contains("deleted")) return;
    const mid = msgEl.getAttribute("data-mid");
    if (!mid) return;

    const wrap = document.createElement("div");
    wrap.className = "reaction-picker-wrap";
    wrap.innerHTML = reactionPickerHtml();
    const picker = wrap.querySelector(".reaction-picker");
    if (picker) picker.setAttribute("data-mid", mid);

    // position near message
    wrap.style.position = "fixed";
    wrap.style.zIndex = "700";
    wrap.style.left = Math.min(window.innerWidth - 280, Math.max(8, clientX - 120)) + "px";
    wrap.style.top = Math.max(8, clientY - 56) + "px";

    document.body.appendChild(wrap);
  };

  const onContext = (e) => {
    const msg = e.target.closest(".msg[data-mid]");
    if (!msg || !container.contains(msg)) return;
    e.preventDefault();
    openPickerFor(msg, e.clientX, e.clientY);
  };

  const onTouchStart = (e) => {
    const msg = e.target.closest(".msg[data-mid]");
    if (!msg || !container.contains(msg)) return;
    const t = e.touches[0];
    pressTimer = setTimeout(() => {
      openPickerFor(msg, t.clientX, t.clientY);
    }, 480);
  };
  const onTouchEnd = () => {
    if (pressTimer) clearTimeout(pressTimer);
    pressTimer = null;
  };

  const onDocClick = (e) => {
    if (!e.target.closest(".reaction-picker-wrap")) {
      closePickers(container);
    }
  };

  container.addEventListener("click", onClick);
  container.addEventListener("contextmenu", onContext);
  container.addEventListener("touchstart", onTouchStart, { passive: true });
  container.addEventListener("touchend", onTouchEnd);
  container.addEventListener("touchmove", onTouchEnd);
  document.addEventListener("click", onDocClick);

  return () => {
    container.removeEventListener("click", onClick);
    container.removeEventListener("contextmenu", onContext);
    container.removeEventListener("touchstart", onTouchStart);
    container.removeEventListener("touchend", onTouchEnd);
    container.removeEventListener("touchmove", onTouchEnd);
    document.removeEventListener("click", onDocClick);
    closePickers(container);
  };
}

function closePickers() {
  document.querySelectorAll(".reaction-picker-wrap").forEach((el) => el.remove());
}

function escapeAttr(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

/**
 * Minimal CSS (inject once from chat-view if needed)
 */
export const REACTIONS_CSS = `
  .msg-reactions {
    display: flex; flex-wrap: wrap; gap: 4px;
    margin-top: 4px; clear: both;
  }
  .msg-reaction {
    border: 1px solid var(--border-subtle);
    background: var(--surface-1);
    border-radius: 12px;
    padding: 2px 8px;
    font-size: 13px;
    cursor: pointer;
    display: inline-flex; align-items: center; gap: 4px;
    color: var(--text-primary);
  }
  .msg-reaction.is-mine {
    border-color: var(--color-accent);
    background: var(--color-accent-muted);
  }
  .reaction-picker {
    display: flex; gap: 4px;
    padding: 8px;
    background: var(--surface-1);
    border: 1px solid var(--border-default);
    border-radius: 24px;
    box-shadow: 0 8px 28px rgba(0,0,0,0.35);
  }
  .reaction-picker__btn {
    border: none; background: transparent;
    font-size: 22px; width: 40px; height: 40px;
    border-radius: 50%; cursor: pointer;
  }
  .reaction-picker__btn:hover { background: var(--surface-2); }
`;

export default {
  QUICK_REACTIONS,
  toggleReaction,
  summarizeReactions,
  reactionsHtml,
  reactionPickerHtml,
  bindReactionHandlers,
  REACTIONS_CSS,
};