/**
 * Settings — Telegram-style hub
 *
 * Modules:  appearance · notifications · privacy · security · device
 * Components: avatar · modal · loader · input · button
 * Firebase: users · userSettings · Storage avatar · usernames txn
 */

import { db, auth, storage } from "../config/firebase.js";
import { getState, setState, resetState } from "../core/state.js";
import { signOut, loadUserData } from "../auth/auth.js";
import { navigate } from "../core/router.js";
import { showToast } from "../components/toast.js";

/* ── UI components ─────────────────────────────────────────── */
import {
  avatarHtml,
  updateAvatar,
  ensureAvatarStyles,
} from "../components/avatar.js";
import { confirmDialog } from "../components/modal.js";
import { setButtonLoading as setBtnLoading } from "../components/loader.js";
import {
  textFieldHtml,
  textareaFieldHtml,
  bindCharCounter,
  bindNormalize,
  getFieldValue,
  setFieldError,
  clearFieldError,
  ensureInputStyles,
} from "../components/input.js";
import { ensureButtonStyles } from "../components/button.js";

/* ── Settings sub-modules ──────────────────────────────────── */
import {
  appearanceSectionHtml,
  bindAppearanceControls,
} from "./appearance.js";
import {
  notificationsSectionHtml,
  bindNotificationControls,
} from "./notifications.js";
import {
  privacySectionHtml,
  bindPrivacyControls,
} from "./privacy.js";
import {
  securitySectionHtml,
  bindSecurityControls,
} from "./security.js";
import {
  registerCurrentDevice,
  listDevices,
  getDeviceId,
  devicesSectionHtml,
  bindDeviceControls,
} from "./device.js";

const FieldValue = firebase.firestore.FieldValue;

/* ── Module-level listener handles (cleanup on leave) ──────── */
let unsubSettings = null;
let unsubProfile = null;

/* ═══════════════════════════════════════════════════════════
   HELPERS — escape, username, profile save, avatar upload
═══════════════════════════════════════════════════════════ */

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normalizeUsername(u) {
  return String(u || "")
    .toLowerCase()
    .trim()
    .replace(/^@/, "")
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 32);
}

function isValidUsername(u) {
  return /^[a-z0-9_]{3,32}$/.test(u);
}

/**
 * Public profile write.
 * Username changes go through atomic usernames/ transaction.
 */
async function saveProfile({ displayName, bio, photoURL, username }) {
  const me = auth.currentUser;
  if (!me) throw new Error("Not authenticated");

  const userRef = db.collection("users").doc(me.uid);
  const current = getState().profile || {};
  const oldUsername = current.username || null;
  const nextUsername = username ? normalizeUsername(username) : oldUsername;

  if (nextUsername && !isValidUsername(nextUsername)) {
    throw new Error("Username must be 3–32 chars (a–z, 0–9, _)");
  }

  if (nextUsername && nextUsername !== oldUsername) {
    const newRef = db.collection("usernames").doc(nextUsername);
    const oldRef = oldUsername
      ? db.collection("usernames").doc(oldUsername)
      : null;

    await db.runTransaction(async (tx) => {
      const taken = await tx.get(newRef);
      if (taken.exists && taken.data()?.uid !== me.uid) {
        throw new Error("Username is already taken");
      }
      if (oldRef) {
        const oldSnap = await tx.get(oldRef);
        if (oldSnap.exists && oldSnap.data()?.uid === me.uid) {
          tx.delete(oldRef);
        }
      }
      tx.set(newRef, {
        uid: me.uid,
        createdAt: FieldValue.serverTimestamp(),
      });
      tx.set(
        userRef,
        {
          displayName: displayName.trim(),
          bio: (bio || "").trim().slice(0, 160),
          photoURL: photoURL || null,
          username: nextUsername,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });
  } else {
    await userRef.set(
      {
        displayName: displayName.trim(),
        bio: (bio || "").trim().slice(0, 160),
        photoURL: photoURL || null,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }

  await loadUserData(me.uid);
}

/** Storage path: users/{uid}/profile/avatar.* */
async function uploadAvatar(file) {
  const me = auth.currentUser;
  if (!me) throw new Error("Not authenticated");
  if (!file.type?.startsWith("image/")) {
    throw new Error("Please choose an image file");
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Image must be under 5 MB");
  }

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().slice(0, 5);
  const path = `users/${me.uid}/profile/avatar.${ext}`;
  const ref = storage.ref(path);
  await ref.put(file, { contentType: file.type });
  return ref.getDownloadURL();
}

/* ═══════════════════════════════════════════════════════════
   STYLES — Telegram-like settings chrome
═══════════════════════════════════════════════════════════ */

function ensureStyles() {
  ensureAvatarStyles();
  ensureInputStyles();
  ensureButtonStyles();

  if (document.getElementById("settings-styles")) return;

  const style = document.createElement("style");
  style.id = "settings-styles";
  style.textContent = `
    .settings-scroll {
      background: var(--surface-0);
      flex: 1;
      min-height: 0;
    }

    /* Profile card */
    .tg-profile-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 28px 16px 18px;
      gap: 6px;
    }
    .tg-profile-name {
      font-size: 1.4rem;
      font-weight: 600;
      color: var(--text-primary);
    }
    .tg-profile-status {
      font-size: 0.85rem;
      color: var(--color-success, #4caf50);
    }
    .tg-profile-bio {
      max-width: 280px;
      text-align: center;
      font-size: 13px;
      color: var(--text-secondary);
      margin-top: 4px;
      line-height: 1.4;
    }

    /* XL avatar fallback (when not using nx-avatar) */
    .avatar--xl {
      width: 100px;
      height: 100px;
      border-radius: 50%;
      font-size: 2.1rem;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--surface-2);
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(0,0,0,0.25);
    }
    .avatar--xl img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    /* Sections / rows */
    .tg-section {
      margin: 8px 12px 12px;
      background: var(--surface-1);
      border-radius: 14px;
      overflow: hidden;
      border: 1px solid var(--border-subtle);
    }
    .tg-section__label {
      padding: 12px 16px 6px;
      font-size: 12px;
      font-weight: 600;
      color: var(--color-accent);
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    .tg-row {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 12px 16px;
      min-height: 52px;
      border-top: 1px solid var(--border-subtle);
    }
    .tg-section .tg-row:first-of-type { border-top: none; }
    .tg-row__icon {
      font-size: 1.15rem;
      color: var(--color-accent);
      width: 24px;
      text-align: center;
      flex-shrink: 0;
    }
    .tg-row__body { flex: 1; min-width: 0; }
    .tg-row__title { font-size: 15px; color: var(--text-primary); }
    .tg-row__sub {
      font-size: 12px;
      color: var(--text-secondary);
      margin-top: 2px;
    }
    .tg-row__value { font-size: 13px; color: var(--text-secondary); }
    .tg-row__chevron { color: var(--text-tertiary); font-size: 0.9rem; }
    .tg-row--btn {
      width: 100%;
      border: none;
      background: transparent;
      cursor: pointer;
      text-align: left;
      font: inherit;
      color: inherit;
    }
    .tg-row--btn:hover,
    .tg-row--btn:active { background: var(--surface-2); }
    .tg-row--danger .tg-row__title,
    .tg-row--danger .tg-row__icon {
      color: var(--color-danger, #e53935);
    }
    .tg-row--toggle input[type="checkbox"] {
      width: 42px;
      height: 24px;
      accent-color: var(--color-accent);
      cursor: pointer;
      flex-shrink: 0;
    }
    .tg-select {
      max-width: 140px;
      height: 34px;
      border-radius: 8px;
      border: 1px solid var(--border-default);
      background: var(--surface-2);
      color: var(--text-primary);
      font-size: 13px;
      padding: 0 8px;
      cursor: pointer;
    }

    /* Theme chips (appearance module may also style) */
    .theme-chips {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      padding: 8px 12px 14px;
    }
    .theme-chip {
      flex: 1;
      min-width: 88px;
      padding: 12px;
      border-radius: 10px;
      border: 1px solid var(--border-default);
      background: var(--surface-2);
      color: var(--text-secondary);
      font-weight: 600;
      font-size: 13px;
      cursor: pointer;
    }
    .theme-chip.active {
      border-color: var(--color-accent);
      color: var(--color-accent);
      background: var(--color-accent-muted);
    }

    /* Legacy edit overlay (profile sheet) */
    .settings-overlay {
      position: fixed;
      inset: 0;
      z-index: 600;
      background: rgba(0,0,0,0.5);
      display: none;
      align-items: flex-end;
      justify-content: center;
      backdrop-filter: blur(2px);
    }
    .settings-overlay.is-open { display: flex; }
    @media (min-width: 600px) {
      .settings-overlay { align-items: center; }
    }
    .settings-sheet {
      width: 100%;
      max-width: 420px;
      background: var(--surface-1);
      border-radius: 16px 16px 0 0;
      max-height: 90vh;
      overflow: auto;
      animation: settings-sheet-up 0.2s ease-out;
    }
    @media (min-width: 600px) {
      .settings-sheet { border-radius: 16px; }
    }
    @keyframes settings-sheet-up {
      from { transform: translateY(16px); opacity: 0.6; }
      to { transform: translateY(0); opacity: 1; }
    }
    .settings-sheet__head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      border-bottom: 1px solid var(--border-subtle);
      position: sticky;
      top: 0;
      background: var(--surface-1);
      z-index: 1;
    }
    .settings-sheet__body {
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .avatar-edit-row {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .avatar-edit-actions {
      display: flex;
      flex-direction: column;
      gap: 8px;
      flex: 1;
    }
    .avatar--md {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      flex-shrink: 0;
      font-size: 1.3rem;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--surface-2);
      overflow: hidden;
    }
    .avatar--md img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  `;
  document.head.appendChild(style);
}

/* ═══════════════════════════════════════════════════════════
   DOM helpers — overlay open/close, profile card paint
═══════════════════════════════════════════════════════════ */

function openOverlay(el) {
  if (!el) return;
  el.hidden = false;
  el.classList.add("is-open");
}

function closeOverlay(el) {
  if (!el) return;
  el.hidden = true;
  el.classList.remove("is-open");
}

function paintProfileCard(root, data) {
  const name = data.displayName || "User";
  const username = data.username || "";
  const bio = data.bio || "";
  const photo = data.photoURL || "";

  const nameEl = root.querySelector("#settings-name");
  const userEl = root.querySelector("#settings-username");
  const bioEl = root.querySelector("#settings-bio");

  if (nameEl) nameEl.textContent = name;
  if (userEl) userEl.textContent = username ? `@${username}` : "—";

  if (bioEl) {
    if (bio) {
      bioEl.hidden = false;
      bioEl.textContent = bio;
    } else {
      bioEl.hidden = true;
      bioEl.textContent = "";
    }
  }

  updateAvatar("settings-avatar", {
    name,
    photoURL: photo,
    uid: auth.currentUser?.uid || name,
    size: "xl",
  });
}

/* ═══════════════════════════════════════════════════════════
   RENDER — main settings page
═══════════════════════════════════════════════════════════ */

export function renderSettings() {
  const root = document.getElementById("page-root");
  if (!root) return () => {};

  /* Clear previous listeners if remounting */
  if (unsubSettings) {
    unsubSettings();
    unsubSettings = null;
  }
  if (unsubProfile) {
    unsubProfile();
    unsubProfile = null;
  }

  ensureStyles();

  const isDesktop = window.matchMedia("(min-width: 900px)").matches;
  const { profile, privateProfile } = getState();

  const name = profile?.displayName || "User";
  const username = profile?.username || "";
  const bio = profile?.bio || "";
  const phone = privateProfile?.phone || "";
  const email = privateProfile?.email || auth.currentUser?.email || "";
  const photo = profile?.photoURL || "";
  const uid = auth.currentUser?.uid || "me";

  /* ── Page structure ── */
  root.innerHTML = `
    <header class="app-header">
      ${
        !isDesktop
          ? `<button type="button" class="btn btn--icon btn--ghost" id="btn-settings-back" aria-label="Back">
               <i class="bi bi-arrow-left" style="font-size:1.25rem"></i>
             </button>`
          : ""
      }
      <h1 class="app-header__title">Settings</h1>
    </header>

    <div class="page__scroll settings-scroll">

      <!-- ══ PROFILE CARD ══ -->
      <div class="tg-profile-card">
        ${avatarHtml({
          id: "settings-avatar",
          name,
          photoURL: photo,
          uid,
          size: "xl",
          className: "avatar--xl",
        })}
        <div class="tg-profile-name" id="settings-name">${escapeHtml(name)}</div>
        <div class="tg-profile-status" id="settings-online">online</div>
        ${
          bio
            ? `<div class="tg-profile-bio" id="settings-bio">${escapeHtml(bio)}</div>`
            : `<div class="tg-profile-bio" id="settings-bio" hidden></div>`
        }
      </div>

      <!-- ══ IDENTITY ══ -->
      <div class="tg-section">
        ${
          phone
            ? `<div class="tg-row">
                 <i class="bi bi-telephone tg-row__icon"></i>
                 <div class="tg-row__body">
                   <div class="tg-row__title">${escapeHtml(phone)}</div>
                   <div class="tg-row__sub">Phone</div>
                 </div>
               </div>`
            : ""
        }
        ${
          email
            ? `<div class="tg-row">
                 <i class="bi bi-envelope tg-row__icon"></i>
                 <div class="tg-row__body">
                   <div class="tg-row__title">${escapeHtml(email)}</div>
                   <div class="tg-row__sub">Email</div>
                 </div>
               </div>`
            : ""
        }
        <div class="tg-row">
          <i class="bi bi-at tg-row__icon"></i>
          <div class="tg-row__body">
            <div class="tg-row__title" id="settings-username">${
              username ? "@" + escapeHtml(username) : "—"
            }</div>
            <div class="tg-row__sub">Username</div>
          </div>
        </div>
        <button type="button" class="tg-row tg-row--btn" id="btn-edit-profile">
          <i class="bi bi-pencil tg-row__icon"></i>
          <div class="tg-row__body">
            <div class="tg-row__title">Edit profile</div>
            <div class="tg-row__sub">Name, username, bio, photo</div>
          </div>
          <i class="bi bi-chevron-right tg-row__chevron"></i>
        </button>
      </div>

      <!-- ══ MODULE SECTIONS ══ -->
      ${notificationsSectionHtml()}
      ${privacySectionHtml()}
      ${appearanceSectionHtml()}
      ${securitySectionHtml()}

      <!-- ══ DEVICES (async fill) ══ -->
      <div id="devices-section-host">
        <div class="tg-section">
          <div class="tg-section__label">Devices</div>
          <div class="tg-row">
            <div class="tg-row__body">
              <div class="tg-row__sub">Loading devices…</div>
            </div>
          </div>
        </div>
      </div>

      <!-- ══ GENERAL ══ -->
      <div class="tg-section">
        <div class="tg-section__label">General</div>
        <button type="button" class="tg-row tg-row--btn" id="btn-data">
          <i class="bi bi-database tg-row__icon"></i>
          <div class="tg-row__body">
            <div class="tg-row__title">Data and Storage</div>
          </div>
          <i class="bi bi-chevron-right tg-row__chevron"></i>
        </button>
        <button type="button" class="tg-row tg-row--btn" id="btn-about">
          <i class="bi bi-info-circle tg-row__icon"></i>
          <div class="tg-row__body">
            <div class="tg-row__title">About Nexus</div>
          </div>
          <span class="tg-row__value">v1.0</span>
        </button>
      </div>

      <!-- ══ LOGOUT ══ -->
      <div class="tg-section">
        <button type="button" class="tg-row tg-row--btn tg-row--danger" id="btn-logout">
          <i class="bi bi-box-arrow-right tg-row__icon"></i>
          <div class="tg-row__body">
            <div class="tg-row__title">Log out</div>
          </div>
        </button>
      </div>

      <div style="height:28px"></div>
    </div>

    <!-- ══ EDIT PROFILE SHEET ══ -->
    <div id="edit-overlay" class="settings-overlay" hidden>
      <div class="settings-sheet" role="dialog" aria-modal="true" aria-label="Edit profile">
        <div class="settings-sheet__head">
          <button type="button" class="btn btn--ghost" id="edit-cancel">Cancel</button>
          <strong>Edit profile</strong>
          <button type="button" class="btn btn--primary btn--sm" id="edit-save">Save</button>
        </div>
        <div class="settings-sheet__body">
          <div class="avatar-edit-row">
            <div class="avatar avatar--md" id="edit-avatar-preview">
              ${
                photo
                  ? `<img src="${escapeHtml(photo)}" alt="">`
                  : `<span>${(name[0] || "U").toUpperCase()}</span>`
              }
            </div>
            <div class="avatar-edit-actions">
              <button type="button" class="btn btn--secondary btn--sm" id="btn-pick-photo">
                <i class="bi bi-upload"></i> Upload photo
              </button>
              <input type="file" id="avatar-file-input" accept="image/*" hidden />
            </div>
          </div>

          ${textFieldHtml({
            id: "edit-name",
            label: "Display name",
            value: name,
            maxlength: 40,
            placeholder: "Your name",
          })}

          ${textFieldHtml({
            id: "edit-username",
            label: "Username",
            value: username,
            maxlength: 32,
            prefix: "@",
            placeholder: "your_username",
            hint: "3–32 characters · letters, numbers, underscore",
          })}

          ${textareaFieldHtml({
            id: "edit-bio",
            label: "Bio",
            value: bio,
            maxlength: 160,
            rows: 3,
            placeholder: "A short introduction",
          })}

          ${textFieldHtml({
            id: "edit-photo",
            label: "Or image URL",
            value: photo,
            placeholder: "https://…",
          })}
        </div>
      </div>
    </div>
  `;

  /* ═══════════════════════════════════════════════════════════
     EVENT BINDINGS
  ═══════════════════════════════════════════════════════════ */

  const editOverlay = root.querySelector("#edit-overlay");

  const onKeyDown = (e) => {
    if (e.key !== "Escape") return;
    closeOverlay(editOverlay);
    const pw = root.querySelector("#password-overlay");
    if (pw) {
      pw.hidden = true;
      pw.classList.remove("is-open");
    }
  };
  document.addEventListener("keydown", onKeyDown);

  editOverlay?.addEventListener("click", (e) => {
    if (e.target === editOverlay) closeOverlay(editOverlay);
  });

  root.querySelector("#btn-settings-back")?.addEventListener("click", () => {
    navigate("chats");
  });

  /* ── Sub-module binders ── */
  bindNotificationControls(root);
  bindPrivacyControls(root);
  bindAppearanceControls(root);
  bindSecurityControls(root);

  /* ── Devices (async) ── */
  (async () => {
    const host = root.querySelector("#devices-section-host");
    if (!host) return;
    try {
      await registerCurrentDevice();
      const devices = await listDevices();
      host.innerHTML = devicesSectionHtml(devices, getDeviceId());
      bindDeviceControls(host);
    } catch (err) {
      console.warn("devices:", err);
      host.innerHTML = `
        <div class="tg-section">
          <div class="tg-section__label">Devices</div>
          <div class="tg-row">
            <div class="tg-row__body">
              <div class="tg-row__sub">Could not load devices</div>
            </div>
          </div>
        </div>`;
    }
  })();

  /* ── Edit profile form ── */
  let pendingAvatarFile = null;
  const fileInput = root.querySelector("#avatar-file-input");
  const avatarPreview = root.querySelector("#edit-avatar-preview");

  bindCharCounter("edit-bio");
  bindNormalize(root.querySelector("#edit-username"), normalizeUsername);

  root.querySelector("#btn-edit-profile")?.addEventListener("click", () => {
    openOverlay(editOverlay);
  });

  root.querySelector("#edit-cancel")?.addEventListener("click", () => {
    pendingAvatarFile = null;
    clearFieldError("edit-name");
    clearFieldError("edit-username");
    closeOverlay(editOverlay);
  });

  root.querySelector("#btn-pick-photo")?.addEventListener("click", () => {
    fileInput?.click();
  });

  fileInput?.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    pendingAvatarFile = file;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (avatarPreview) {
        avatarPreview.innerHTML = `<img src="${ev.target.result}" alt="Preview">`;
      }
      const urlField = root.querySelector("#edit-photo");
      if (urlField) urlField.value = "";
    };
    reader.readAsDataURL(file);
  });

  root.querySelector("#edit-photo")?.addEventListener("input", (e) => {
    const url = e.target.value.trim();
    if (!url) return;
    pendingAvatarFile = null;
    if (avatarPreview) {
      avatarPreview.innerHTML = `<img src="${escapeHtml(url)}" alt="Preview" onerror="this.remove()">`;
    }
  });

  root.querySelector("#edit-save")?.addEventListener("click", async () => {
    clearFieldError("edit-name");
    clearFieldError("edit-username");

    const displayName = getFieldValue("edit-name").trim();
    const bioVal = getFieldValue("edit-bio").trim().slice(0, 160);
    const photoUrlVal = getFieldValue("edit-photo").trim();
    const usernameVal = normalizeUsername(getFieldValue("edit-username"));

    if (!displayName) {
      setFieldError("edit-name", "Name is required");
      return;
    }
    if (usernameVal && !isValidUsername(usernameVal)) {
      setFieldError(
        "edit-username",
        "Username must be 3–32 characters (a–z, 0–9, _)"
      );
      return;
    }

    const btn = root.querySelector("#edit-save");
    const restore = setBtnLoading(btn, "Saving…");

    try {
      let photoURL = photoUrlVal || null;
      if (pendingAvatarFile) {
        showToast("Uploading photo…", { type: "info" });
        photoURL = await uploadAvatar(pendingAvatarFile);
        pendingAvatarFile = null;
      }

      await saveProfile({
        displayName,
        bio: bioVal,
        photoURL,
        username: usernameVal || undefined,
      });

      closeOverlay(editOverlay);
      showToast("Profile updated", { type: "success" });

      paintProfileCard(root, {
        displayName,
        username: usernameVal,
        bio: bioVal,
        photoURL,
      });
    } catch (e) {
      console.error(e);
      showToast(e.message || "Update failed", { type: "error" });
    } finally {
      restore();
    }
  });

  /* ── General ── */
  root.querySelector("#btn-about")?.addEventListener("click", () => {
    showToast("Nexus — private modern messaging", { type: "info" });
  });
  root.querySelector("#btn-data")?.addEventListener("click", () => {
    showToast("Storage management — coming soon");
  });

  /* ── Logout (confirmDialog component) ── */
  root.querySelector("#btn-logout")?.addEventListener("click", async () => {
    const ok = await confirmDialog({
      title: "Log out?",
      message: "You will need to sign in again to use Nexus on this device.",
      confirmLabel: "Log out",
      cancelLabel: "Cancel",
      danger: true,
    });
    if (!ok) return;

    try {
      await signOut();
      try {
        resetState();
      } catch (_) {}
      location.href = location.pathname + location.search;
    } catch (_) {
      showToast("Sign out failed", { type: "error" });
    }
  });

  /* ═══════════════════════════════════════════════════════════
     REALTIME — userSettings + public profile
  ═══════════════════════════════════════════════════════════ */

  const me = auth.currentUser;
  if (me) {
    unsubSettings = db
      .collection("userSettings")
      .doc(me.uid)
      .onSnapshot(
        (snap) => {
          if (snap.exists) setState({ settings: snap.data() });
        },
        (err) => console.warn("settings listener:", err)
      );

    unsubProfile = db
      .collection("users")
      .doc(me.uid)
      .onSnapshot(
        (snap) => {
          if (!snap.exists) return;
          const data = snap.data();
          setState({ profile: data });
          paintProfileCard(root, data);
        },
        (err) => console.warn("profile listener:", err)
      );
  }

  /* ── Cleanup ── */
  return () => {
    document.removeEventListener("keydown", onKeyDown);
    if (unsubSettings) {
      unsubSettings();
      unsubSettings = null;
    }
    if (unsubProfile) {
      unsubProfile();
      unsubProfile = null;
    }
    root.innerHTML = "";
  };
}

export default { renderSettings };