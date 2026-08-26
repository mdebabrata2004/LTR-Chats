/**
 * Chat attachments — pick, upload, send as message
 * Storage: conversations/{cid}/{uid}/...
 * Firestore message fields: type, text, mediaURL, mediaPath, fileName, fileSize
 */

import { db, auth } from "../config/firebase.js";
import { uploadConversationFile, storageErrorMessage } from "../utils/storage.js";
import {
  pickFiles,
  assertValidImage,
  assertValidAttachment,
  getFileKind,
  formatFileSize,
  MAX_IMAGE_BYTES,
  MAX_FILE_BYTES,
} from "../utils/file.js";
import { showToast } from "../components/toast.js";

const FieldValue = firebase.firestore.FieldValue;

/**
 * Open picker and return selected files
 * @param {"image"|"any"} mode
 */
export async function pickAttachment(mode = "any") {
  const accept = mode === "image" ? "image/*" : "*/*";
  const files = await pickFiles({ accept, multiple: false });
  return files[0] || null;
}

/**
 * Validate before upload
 * @param {File} file
 */
export function validateAttachment(file) {
  const kind = getFileKind(file);
  if (kind === "image") {
    assertValidImage(file, MAX_IMAGE_BYTES);
  } else {
    assertValidAttachment(file, MAX_FILE_BYTES);
  }
  return kind;
}

/**
 * Upload file + create message doc
 * @param {string} conversationId
 * @param {File} file
 * @param {{ caption?: string, onProgress?: (pct: number) => void }} [opts]
 * @returns {Promise<{ messageId: string, url: string, kind: string }>}
 */
export async function sendAttachment(conversationId, file, opts = {}) {
  const me = auth.currentUser;
  if (!me) throw new Error("Not authenticated");
  if (!conversationId) throw new Error("Missing conversation");
  if (!file) throw new Error("No file");

  const kind = validateAttachment(file);

  const uploaded = await uploadConversationFile(conversationId, file, {
    onProgress: opts.onProgress,
  });

  const msgRef = db
    .collection("messages")
    .doc(conversationId)
    .collection("messages")
    .doc();

  const caption = (opts.caption || "").trim().slice(0, 2000);

  const message = {
    id: msgRef.id,
    type: kind === "image" ? "image" : kind === "audio" ? "audio" : kind === "video" ? "video" : "file",
    text: caption || "",
    mediaURL: uploaded.url,
    mediaPath: uploaded.path,
    fileName: file.name || "file",
    fileSize: uploaded.size || file.size || 0,
    fileSizeLabel: formatFileSize(uploaded.size || file.size || 0),
    contentType: uploaded.contentType || file.type || "application/octet-stream",
    senderId: me.uid,
    createdAt: FieldValue.serverTimestamp(),
    deleted: false,
    reactions: {},
  };

  const batch = db.batch();
  batch.set(msgRef, message);
  batch.set(
    db.collection("conversations").doc(conversationId),
    {
      updatedAt: FieldValue.serverTimestamp(),
      lastMessage: {
        text:
          caption ||
          (message.type === "image"
            ? "📷 Photo"
            : message.type === "audio"
              ? "🎵 Audio"
              : message.type === "video"
                ? "🎬 Video"
                : `📎 ${file.name || "File"}`),
        senderId: me.uid,
        type: message.type,
        createdAt: FieldValue.serverTimestamp(),
      },
    },
    { merge: true }
  );
  await batch.commit();

  return {
    messageId: msgRef.id,
    url: uploaded.url,
    kind: message.type,
  };
}

/**
 * UI: attach menu HTML
 */
export function attachMenuHtml() {
  return `
    <div class="attach-menu" role="menu" id="attach-menu">
      <button type="button" class="attach-menu__item" data-attach="image" role="menuitem">
        <span class="attach-menu__icon attach-menu__icon--image"><i class="bi bi-image"></i></span>
        <span>Photo</span>
      </button>
      <button type="button" class="attach-menu__item" data-attach="file" role="menuitem">
        <span class="attach-menu__icon attach-menu__icon--file"><i class="bi bi-file-earmark"></i></span>
        <span>Document</span>
      </button>
      <button type="button" class="attach-menu__item" data-attach="cancel" role="menuitem">
        <span class="attach-menu__icon"><i class="bi bi-x-lg"></i></span>
        <span>Cancel</span>
      </button>
    </div>
  `;
}

/**
 * Open attach menu and handle pick → upload → send
 * @param {string} conversationId
 * @param {{ onProgress?: (pct: number) => void, onSent?: (result: object) => void, anchorEl?: HTMLElement }} [opts]
 */
export function openAttachMenu(conversationId, opts = {}) {
  closeAttachMenu();

  const wrap = document.createElement("div");
  wrap.id = "attach-menu-overlay";
  wrap.className = "attach-menu-overlay is-open";
  wrap.innerHTML = `
    <div class="attach-menu-backdrop" data-attach="cancel"></div>
    ${attachMenuHtml()}
  `;

  const onClick = async (e) => {
    const btn = e.target.closest("[data-attach]");
    if (!btn) return;
    const action = btn.getAttribute("data-attach");

    if (action === "cancel") {
      closeAttachMenu();
      return;
    }

    closeAttachMenu();

    try {
      const mode = action === "image" ? "image" : "any";
      const file = await pickAttachment(mode);
      if (!file) return;

      showToast("Uploading…");
      const result = await sendAttachment(conversationId, file, {
        onProgress: opts.onProgress,
      });
      showToast(result.kind === "image" ? "Photo sent" : "File sent");
      opts.onSent?.(result);
    } catch (err) {
      console.error(err);
      showToast(storageErrorMessage(err) || err.message || "Upload failed");
    }
  };

  wrap.addEventListener("click", onClick);
  document.body.appendChild(wrap);

  const onKey = (e) => {
    if (e.key === "Escape") closeAttachMenu();
  };
  document.addEventListener("keydown", onKey);
  wrap._onKey = onKey;
}

export function closeAttachMenu() {
  const el = document.getElementById("attach-menu-overlay");
  if (el) {
    if (el._onKey) document.removeEventListener("keydown", el._onKey);
    el.remove();
  }
}

/**
 * Wire composer attach button
 * @param {HTMLElement} attachBtn
 * @param {string} conversationId
 * @param {object} [opts]
 * @returns {() => void} cleanup
 */
export function bindAttachButton(attachBtn, conversationId, opts = {}) {
  if (!attachBtn) return () => {};

  const handler = (e) => {
    e.preventDefault();
    openAttachMenu(conversationId, opts);
  };

  attachBtn.addEventListener("click", handler);
  return () => {
    attachBtn.removeEventListener("click", handler);
    closeAttachMenu();
  };
}

export const ATTACHMENTS_CSS = `
  .attach-menu-overlay {
    position: fixed; inset: 0; z-index: 750;
    display: flex; align-items: flex-end; justify-content: center;
  }
  .attach-menu-backdrop {
    position: absolute; inset: 0;
    background: rgba(0,0,0,0.4);
  }
  .attach-menu {
    position: relative;
    width: min(400px, 100%);
    background: var(--surface-1);
    border-radius: 16px 16px 0 0;
    padding: 12px 8px calc(12px + env(safe-area-inset-bottom));
    display: flex; flex-direction: column; gap: 4px;
    box-shadow: 0 -8px 32px rgba(0,0,0,0.3);
  }
  @media (min-width: 600px) {
    .attach-menu-overlay { align-items: center; }
    .attach-menu { border-radius: 16px; padding-bottom: 12px; }
  }
  .attach-menu__item {
    display: flex; align-items: center; gap: 14px;
    padding: 14px 16px; border: none; background: transparent;
    color: var(--text-primary); font-size: 16px;
    text-align: left; cursor: pointer; border-radius: 12px;
    width: 100%;
  }
  .attach-menu__item:hover { background: var(--surface-2); }
  .attach-menu__icon {
    width: 40px; height: 40px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    background: var(--surface-2); font-size: 1.2rem;
  }
  .attach-menu__icon--image { background: rgba(76, 175, 80, 0.2); color: #4caf50; }
  .attach-menu__icon--file { background: rgba(91, 106, 240, 0.2); color: var(--color-accent); }
`;

export default {
  pickAttachment,
  validateAttachment,
  sendAttachment,
  attachMenuHtml,
  openAttachMenu,
  closeAttachMenu,
  bindAttachButton,
  ATTACHMENTS_CSS,
};