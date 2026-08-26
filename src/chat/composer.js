/**
 * Chat composer — input, send, attach, reply bar, drafts
 */

import { sendTextMessage } from "../firebase/firestore.js";
import { showToast } from "../components/toast.js";
import {
  bindDraftInput,
  onMessageSent,
  getDraft,
} from "./drafts.js";

/**
 * @typedef {object} ComposerOptions
 * @property {string} conversationId
 * @property {(msg: object) => void} [onSent]
 * @property {() => void} [onAttach]
 * @property {() => void} [onEmoji]
 * @property {(text: string) => void} [onTyping] - debounced by caller if needed
 */

/**
 * Composer HTML
 */
export function composerHtml() {
  return `
    <div class="composer" id="composer">
      <div class="composer-reply" id="composer-reply" hidden>
        <div class="composer-reply__body">
          <div class="composer-reply__label">Reply</div>
          <div class="composer-reply__text" id="composer-reply-text"></div>
        </div>
        <button type="button" class="btn btn--icon btn--ghost" id="composer-reply-close" aria-label="Cancel reply">
          <i class="bi bi-x-lg"></i>
        </button>
      </div>

      <div class="composer-bar">
        <button type="button" class="btn btn--icon btn--ghost composer-btn" id="composer-emoji" title="Emoji" aria-label="Emoji">
          <i class="bi bi-emoji-smile" style="font-size:1.35rem"></i>
        </button>
        <button type="button" class="btn btn--icon btn--ghost composer-btn" id="composer-attach" title="Attach" aria-label="Attach">
          <i class="bi bi-paperclip" style="font-size:1.25rem"></i>
        </button>
        <textarea
          id="composer-input"
          class="composer-input"
          rows="1"
          placeholder="Type a message"
          enterkeyhint="send"
          autocomplete="off"
        ></textarea>
        <button type="button" class="btn btn--primary btn--icon composer-send" id="composer-send" disabled aria-label="Send">
          <i class="bi bi-send-fill" style="font-size:1.1rem"></i>
        </button>
      </div>
    </div>
  `;
}

/**
 * Mount composer into host element (e.g. page root footer area)
 * @param {HTMLElement} host - element that will contain composer HTML
 * @param {ComposerOptions} options
 * @returns {{ setReply: Function, clearReply: Function, focus: Function, destroy: Function, getText: Function }}
 */
export function mountComposer(host, options) {
  const cid = options?.conversationId;
  if (!host || !cid) {
    return {
      setReply() {},
      clearReply() {},
      focus() {},
      destroy() {},
      getText: () => "",
    };
  }

  host.innerHTML = composerHtml();

  const input = host.querySelector("#composer-input");
  const sendBtn = host.querySelector("#composer-send");
  const replyBar = host.querySelector("#composer-reply");
  const replyText = host.querySelector("#composer-reply-text");

  let replyTo = null;
  let sending = false;

  // Restore draft
  const draft = getDraft(cid);
  if (input && draft) {
    input.value = draft;
    autoGrow(input);
  }
  updateSendEnabled();

  const unbindDraft = bindDraftInput(input, cid, {
    onChange: () => {
      updateSendEnabled();
      options.onTyping?.(input.value);
    },
  });

  function updateSendEnabled() {
    if (sendBtn) sendBtn.disabled = sending || !input?.value.trim();
  }

  function autoGrow(el) {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }

  input?.addEventListener("input", () => {
    autoGrow(input);
    updateSendEnabled();
  });

  input?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      doSend();
    }
  });

  sendBtn?.addEventListener("click", doSend);

  host.querySelector("#composer-emoji")?.addEventListener("click", () => {
    if (options.onEmoji) options.onEmoji();
    else showToast("Emoji picker — coming soon");
  });

  host.querySelector("#composer-attach")?.addEventListener("click", () => {
    if (options.onAttach) options.onAttach();
    else showToast("Attachments — coming soon");
  });

  host.querySelector("#composer-reply-close")?.addEventListener("click", () => {
    clearReply();
  });

  async function doSend() {
    const text = (input?.value || "").trim();
    if (!text || sending) return;

    sending = true;
    updateSendEnabled();

    try {
      const payload = {
        replyTo: replyTo
          ? {
              id: replyTo.id,
              text: (replyTo.text || "").slice(0, 200),
              senderId: replyTo.senderId || null,
              senderName: replyTo.senderName || null,
            }
          : null,
      };

      // firestore helper — text only API; pass reply if your sendTextMessage supports it
      if (payload.replyTo) {
        await sendTextMessage(cid, text, payload.replyTo);
      } else {
        await sendTextMessage(cid, text);
      }

      onMessageSent(cid, input);
      clearReply();
      autoGrow(input);
      options.onSent?.({ text });
    } catch (err) {
      console.error(err);
      showToast(err.message || "Failed to send");
    } finally {
      sending = false;
      updateSendEnabled();
      input?.focus();
    }
  }

  function setReply(msg) {
    if (!msg || msg.deleted) return;
    replyTo = msg;
    if (replyBar) replyBar.hidden = false;
    if (replyText) {
      replyText.textContent = (msg.text || "Message").slice(0, 120);
    }
    input?.focus();
  }

  function clearReply() {
    replyTo = null;
    if (replyBar) replyBar.hidden = true;
    if (replyText) replyText.textContent = "";
  }

  function focus() {
    input?.focus();
  }

  function getText() {
    return input?.value || "";
  }

  function destroy() {
    unbindDraft?.();
    // flush draft already in bindDraftInput cleanup
    host.innerHTML = "";
  }

  return { setReply, clearReply, focus, destroy, getText };
}

export const COMPOSER_CSS = `
  .composer {
    flex-shrink: 0;
    background: var(--surface-1);
    border-top: 1px solid var(--border-subtle);
  }
  .composer-reply {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px 0;
  }
  .composer-reply[hidden] { display: none !important; }
  .composer-reply__body {
    flex: 1;
    min-width: 0;
    border-left: 3px solid var(--color-accent);
    padding-left: 10px;
  }
  .composer-reply__label {
    font-size: 12px;
    font-weight: 600;
    color: var(--color-accent);
  }
  .composer-reply__text {
    font-size: 13px;
    color: var(--text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .composer-bar {
    display: flex;
    align-items: flex-end;
    gap: 4px;
    padding: 6px 8px;
    padding-bottom: max(6px, env(safe-area-inset-bottom));
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
  .composer-send:disabled { opacity: 0.45; }
`;

export default {
  composerHtml,
  mountComposer,
  COMPOSER_CSS,
};