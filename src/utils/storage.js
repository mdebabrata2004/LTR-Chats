/**
 * Firebase Storage helpers
 * Paths aligned with storage.rules:
 *   users/{uid}/profile/*
 *   conversations/{cid}/{uid}/*
 */

import { storage, auth } from "../config/firebase.js";
import {
  assertValidImage,
  assertValidAttachment,
  avatarStoragePath,
  conversationFilePath,
  getFileKind,
  sanitizeFilename,
  formatFileSize,
  MAX_IMAGE_BYTES,
  MAX_FILE_BYTES,
} from "./file.js";

/**
 * @param {string} path
 * @returns {firebase.storage.Reference}
 */
export function ref(path) {
  return storage.ref(path);
}

/**
 * Upload blob/file with optional progress
 * @param {string} path
 * @param {Blob|File} data
 * @param {{ contentType?: string, customMetadata?: object, onProgress?: (pct: number) => void }} [opts]
 * @returns {Promise<{ url: string, path: string, contentType: string, size: number }>}
 */
export function uploadFile(path, data, opts = {}) {
  const contentType =
    opts.contentType || data.type || "application/octet-stream";
  const metadata = {
    contentType,
    customMetadata: opts.customMetadata || {},
  };

  const task = storage.ref(path).put(data, metadata);

  return new Promise((resolve, reject) => {
    task.on(
      "state_changed",
      (snap) => {
        if (opts.onProgress && snap.totalBytes > 0) {
          const pct = Math.round(
            (snap.bytesTransferred / snap.totalBytes) * 100
          );
          opts.onProgress(pct);
        }
      },
      (err) => reject(err),
      async () => {
        try {
          const url = await task.snapshot.ref.getDownloadURL();
          resolve({
            url,
            path,
            contentType,
            size: task.snapshot.totalBytes || data.size || 0,
          });
        } catch (e) {
          reject(e);
        }
      }
    );
  });
}

/**
 * Upload current user's avatar
 * @param {File} file
 * @param {{ onProgress?: (pct: number) => void }} [opts]
 */
export async function uploadAvatar(file, opts = {}) {
  const me = auth.currentUser;
  if (!me) throw new Error("Not authenticated");

  assertValidImage(file, MAX_IMAGE_BYTES);
  const path = avatarStoragePath(me.uid, file.name);

  return uploadFile(path, file, {
    contentType: file.type,
    onProgress: opts.onProgress,
    customMetadata: { purpose: "avatar", uid: me.uid },
  });
}

/**
 * Upload chat attachment into conversation folder
 * @param {string} conversationId
 * @param {File} file
 * @param {{ onProgress?: (pct: number) => void }} [opts]
 */
export async function uploadConversationFile(conversationId, file, opts = {}) {
  const me = auth.currentUser;
  if (!me) throw new Error("Not authenticated");
  if (!conversationId) throw new Error("Missing conversation id");

  assertValidAttachment(file, MAX_FILE_BYTES);

  const path = conversationFilePath(conversationId, me.uid, file.name);
  const kind = getFileKind(file);

  const result = await uploadFile(path, file, {
    contentType: file.type || "application/octet-stream",
    onProgress: opts.onProgress,
    customMetadata: {
      purpose: "message",
      kind,
      originalName: sanitizeFilename(file.name),
      uid: me.uid,
    },
  });

  return {
    ...result,
    kind,
    name: file.name,
    sizeLabel: formatFileSize(result.size),
  };
}

/**
 * Get download URL for a path (if allowed by rules)
 * @param {string} path
 */
export async function getDownloadURL(path) {
  return storage.ref(path).getDownloadURL();
}

/**
 * Delete object by path (owner rules must allow)
 * @param {string} path
 */
export async function deleteFile(path) {
  if (!path) throw new Error("Missing path");
  await storage.ref(path).delete();
}

/**
 * Delete by full download URL (best-effort; prefers path API)
 * @param {string} url
 */
export async function deleteByURL(url) {
  if (!url) return;
  try {
    const r = storage.refFromURL(url);
    await r.delete();
  } catch (err) {
    // object may already be gone
    if (err?.code !== "storage/object-not-found") throw err;
  }
}

/**
 * List files under a prefix (debug / management)
 * @param {string} prefix
 * @param {number} [max=50]
 */
export async function listFiles(prefix, max = 50) {
  const res = await storage.ref(prefix).list({ maxResults: max });
  return {
    items: res.items.map((i) => i.fullPath),
    prefixes: res.prefixes.map((p) => p.fullPath),
  };
}

/**
 * Friendly error message
 */
export function storageErrorMessage(err) {
  const code = err?.code || "";
  if (code.includes("unauthorized") || code.includes("unauthenticated")) {
    return "You don't have permission to access this file";
  }
  if (code.includes("canceled")) return "Upload canceled";
  if (code.includes("retry-limit")) return "Network error — try again";
  if (code.includes("invalid-checksum")) return "File corrupted during upload";
  if (code.includes("object-not-found")) return "File not found";
  if (code.includes("quota")) return "Storage quota exceeded";
  return err?.message || "Storage error";
}

export default {
  ref,
  uploadFile,
  uploadAvatar,
  uploadConversationFile,
  getDownloadURL,
  deleteFile,
  deleteByURL,
  listFiles,
  storageErrorMessage,
};