/**
 * File utilities — validate, format, read, upload helpers
 * Used by profile avatar, chat media, attachments
 */

/** Max sizes (bytes) */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50 MB
export const MAX_VOICE_BYTES = 10 * 1024 * 1024; // 10 MB

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
const AUDIO_TYPES = ["audio/mpeg", "audio/mp4", "audio/webm", "audio/ogg", "audio/wav"];

/**
 * Human-readable size
 * @param {number} bytes
 */
export function formatFileSize(bytes) {
  if (bytes == null || isNaN(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Extension from filename (lowercase, no dot)
 */
export function getExtension(filename = "") {
  const parts = String(filename).split(".");
  if (parts.length < 2) return "";
  return parts.pop().toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8);
}

/**
 * Safe storage object name
 */
export function sanitizeFilename(name = "file") {
  return String(name)
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .slice(0, 80) || "file";
}

export function isImageType(mime) {
  return IMAGE_TYPES.includes(mime) || String(mime || "").startsWith("image/");
}

export function isVideoType(mime) {
  return VIDEO_TYPES.includes(mime) || String(mime || "").startsWith("video/");
}

export function isAudioType(mime) {
  return AUDIO_TYPES.includes(mime) || String(mime || "").startsWith("audio/");
}

/**
 * Classify file for chat attachment UI
 * @returns {"image"|"video"|"audio"|"file"}
 */
export function getFileKind(file) {
  if (!file) return "file";
  const mime = file.type || "";
  if (isImageType(mime)) return "image";
  if (isVideoType(mime)) return "video";
  if (isAudioType(mime)) return "audio";
  return "file";
}

/**
 * Validate image for avatar / photo share
 * @throws {Error}
 */
export function assertValidImage(file, maxBytes = MAX_IMAGE_BYTES) {
  if (!file) throw new Error("No file selected");
  if (!isImageType(file.type)) throw new Error("Please choose an image (JPG, PNG, WebP, GIF)");
  if (file.size > maxBytes) {
    throw new Error(`Image must be under ${formatFileSize(maxBytes)}`);
  }
  return true;
}

/**
 * Validate general attachment
 * @throws {Error}
 */
export function assertValidAttachment(file, maxBytes = MAX_FILE_BYTES) {
  if (!file) throw new Error("No file selected");
  if (file.size > maxBytes) {
    throw new Error(`File must be under ${formatFileSize(maxBytes)}`);
  }
  return true;
}

/**
 * Read file as data URL (preview)
 * @param {File|Blob} file
 * @returns {Promise<string>}
 */
export function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

/**
 * Read as ArrayBuffer
 */
export function readAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Storage path helpers (align with storage.rules)
 */
export function avatarStoragePath(uid, filename = "avatar.jpg") {
  const ext = getExtension(filename) || "jpg";
  return `users/${uid}/profile/avatar.${ext}`;
}

export function conversationFilePath(conversationId, uploaderUid, filename) {
  const safe = sanitizeFilename(filename);
  const stamp = Date.now().toString(36);
  return `conversations/${conversationId}/${uploaderUid}/${stamp}_${safe}`;
}

/**
 * Open hidden file picker
 * @param {{ accept?: string, multiple?: boolean }} opts
 * @returns {Promise<File[]>}
 */
export function pickFiles(opts = {}) {
  const { accept = "*/*", multiple = false } = opts;
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.multiple = !!multiple;
    input.style.display = "none";
    document.body.appendChild(input);

    const cleanup = () => {
      input.remove();
    };

    input.addEventListener("change", () => {
      const files = Array.from(input.files || []);
      cleanup();
      resolve(files);
    });

    // User cancelled — no reliable event; resolve empty on window focus fallback
    const onFocus = () => {
      setTimeout(() => {
        if (!input.files?.length) {
          cleanup();
          resolve([]);
        }
        window.removeEventListener("focus", onFocus);
      }, 300);
    };
    window.addEventListener("focus", onFocus);

    input.click();
  });
}

export function pickImage() {
  return pickFiles({ accept: "image/*", multiple: false }).then((f) => f[0] || null);
}

/**
 * Compress image in browser (canvas) — optional quality helper
 * @param {File} file
 * @param {{ maxWidth?: number, quality?: number }} opts
 * @returns {Promise<Blob>}
 */
export async function compressImage(file, opts = {}) {
  const maxWidth = opts.maxWidth || 1280;
  const quality = opts.quality ?? 0.82;

  assertValidImage(file, MAX_FILE_BYTES);

  const dataUrl = await readAsDataURL(file);
  const img = await loadImage(dataUrl);

  let { width, height } = img;
  if (width > maxWidth) {
    height = Math.round((height * maxWidth) / width);
    width = maxWidth;
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, width, height);

  const mime = file.type === "image/png" ? "image/png" : "image/jpeg";

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error("Compression failed"));
        else resolve(blob);
      },
      mime,
      quality
    );
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Invalid image"));
    img.src = src;
  });
}

/**
 * Firebase Storage upload with progress callback
 * @param {firebase.storage.Reference} ref
 * @param {Blob|File} data
 * @param {{ contentType?: string, onProgress?: (pct: number) => void }} opts
 * @returns {Promise<string>} download URL
 */
export function uploadWithProgress(ref, data, opts = {}) {
  const metadata = opts.contentType ? { contentType: opts.contentType } : undefined;
  const task = ref.put(data, metadata);

  return new Promise((resolve, reject) => {
    task.on(
      "state_changed",
      (snap) => {
        if (opts.onProgress && snap.totalBytes) {
          const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
          opts.onProgress(pct);
        }
      },
      (err) => reject(err),
      async () => {
        try {
          const url = await task.snapshot.ref.getDownloadURL();
          resolve(url);
        } catch (e) {
          reject(e);
        }
      }
    );
  });
}

export default {
  MAX_IMAGE_BYTES,
  MAX_FILE_BYTES,
  MAX_VOICE_BYTES,
  formatFileSize,
  getExtension,
  sanitizeFilename,
  isImageType,
  isVideoType,
  isAudioType,
  getFileKind,
  assertValidImage,
  assertValidAttachment,
  readAsDataURL,
  readAsArrayBuffer,
  avatarStoragePath,
  conversationFilePath,
  pickFiles,
  pickImage,
  compressImage,
  uploadWithProgress,
};