/**
 * Per-conversation message drafts
 * Backed by core/state (localStorage) — works offline
 */

import {
  getDraft as storeGetDraft,
  setDraft as storeSetDraft,
  clearDraft as storeClearDraft,
  getState,
} from "../core/state.js";

/**
 * Get draft text for a conversation
 * @param {string} conversationId
 * @returns {string}
 */
export function getDraft(conversationId) {
  if (!conversationId) return "";
  return storeGetDraft(conversationId) || "";
}

/**
 * Save draft (empty string clears)
 * @param {string} conversationId
 * @param {string} text
 */
export function saveDraft(conversationId, text) {
  if (!conversationId) return;
  storeSetDraft(conversationId, text || "");
}

/**
 * Clear one conversation draft
 */
export function clearDraft(conversationId) {
  if (!conversationId) return;
  if (typeof storeClearDraft === "function") {
    storeClearDraft(conversationId);
  } else {
    storeSetDraft(conversationId, "");
  }
}

/**
 * All drafts map { [cid]: text }
 */
export function getAllDrafts() {
  return { ...(getState().drafts || {}) };
}

/**
 * Whether conversation has non-empty draft
 */
export function hasDraft(conversationId) {
  return !!(getDraft(conversationId) || "").trim();
}

/**
 * Preview for chat list (truncated)
 * @param {string} conversationId
 * @param {number} [max=40]
 */
export function draftPreview(conversationId, max = 40) {
  const t = getDraft(conversationId).trim().replace(/\s+/g, " ");
  if (!t) return "";
  if (t.length <= max) return t;
  return t.slice(0, max - 1) + "…";
}

/**
 * Bind textarea ↔ draft auto-save
 * @param {HTMLTextAreaElement|HTMLInputElement} input
 * @param {string} conversationId
 * @param {{ debounceMs?: number, onChange?: (text: string) => void }} [opts]
 * @returns {() => void} cleanup — flushes draft on destroy
 */
export function bindDraftInput(input, conversationId, opts = {}) {
  if (!input || !conversationId) return () => {};

  const debounceMs = opts.debounceMs ?? 200;
  let timer = null;

  // Restore
  const existing = getDraft(conversationId);
  if (existing && !input.value) {
    input.value = existing;
  }

  const persist = () => {
    saveDraft(conversationId, input.value);
    opts.onChange?.(input.value);
  };

  const onInput = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(persist, debounceMs);
  };

  input.addEventListener("input", onInput);

  return () => {
    if (timer) clearTimeout(timer);
    // flush latest on unmount
    saveDraft(conversationId, input.value);
    input.removeEventListener("input", onInput);
  };
}

/**
 * Call after successful send
 */
export function onMessageSent(conversationId, input) {
  clearDraft(conversationId);
  if (input) {
    input.value = "";
    if (typeof input.style !== "undefined") {
      input.style.height = "auto";
    }
  }
}

/**
 * Chat list subtitle: prefer last message, else draft hint
 * @param {{ lastMessage?: { text?: string } }} conv
 * @param {string} conversationId
 */
export function listSubtitle(conv, conversationId) {
  const draft = getDraft(conversationId).trim();
  if (draft) {
    return { text: draft, isDraft: true };
  }
  const last = conv?.lastMessage?.text || "No messages yet";
  return { text: last, isDraft: false };
}

/**
 * HTML snippet for list row draft indicator
 */
export function draftLabelHtml(conversationId) {
  if (!hasDraft(conversationId)) return "";
  return `<span class="draft-label">Draft: </span>${escapeHtml(draftPreview(conversationId))}`;
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export const DRAFT_CSS = `
  .draft-label {
    color: var(--color-danger, #e53935);
    font-weight: 600;
  }
  .list-row__subtitle .draft-label {
    margin-right: 2px;
  }
`;

export default {
  getDraft,
  saveDraft,
  clearDraft,
  getAllDrafts,
  hasDraft,
  draftPreview,
  bindDraftInput,
  onMessageSent,
  listSubtitle,
  draftLabelHtml,
  DRAFT_CSS,
};