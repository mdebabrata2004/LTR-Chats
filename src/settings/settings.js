/**
 * Settings — Telegram-style hub
 * Modules: appearance · notifications · privacy · security · device
 * Firestore: users + userSettings
 * Storage: users/{uid}/profile/avatar
 */

import { db, auth, storage } from "../config/firebase.js";
import { getState, setState, resetState } from "../core/state.js";
import { signOut, loadUserData } from "../auth/auth.js";
import { navigate } from "../core/router.js";
import { showToast } from "../components/toast.js";

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

let unsubSettings = null;
let unsubProfile = null;

/* ─────────────────────────── helpers ─────────────────────────── */

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
    const oldRef = oldUsername ? db.collection("usernames").doc(oldUsername) : null;

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

async function uploadAvatar(file) {
  const me = auth.currentUser;
  if (!me) throw new Error("Not authenticated");
  if (!file.type?.startsWith("image/")) throw new Error("Please choose an image file");
  if (file.size > 5 * 1024 * 1024) throw new Error("Image must be under 5 MB");

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().slice(0, 5);
  const path = `users/${me.uid}/profile/avatar.${ext}`;
  const ref = storage.ref(path);
  await ref.put(file, { contentType: file.type });
  return ref.getDownloadURL();
}

function setButtonLoading(btn, loadingText = "Saving…") {
  if (!btn) return () => {};
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = loadingText;
  return () => {
    btn.disabled = false;
    btn.textContent = original;
  };
}

function ensureStyles() {
  if (document.getElementById("settings-styles")) return;
  const style = document.createElement("style");
  style.id = "settings-styles";
  style.textContent = `
    .settings-scroll { background: var(--surface-0); flex: 1; min-height: 0; }
    .tg-profile-card {
      display: flex; flex-direction: column; align-items: center;
      padding: 28px 16px 18px; gap: 6px;
    }
    .avatar--xl {
      width: 100px; height: 100px; border-radius: 50%;
      font-size: 2.1rem; display: flex; align-items: center; justify-content: center;
      background: var(--surface-2); overflow: hidden;
      box-shadow: 0 4px 20px rgba(0,0,0,0.25);
    }
    .avatar--xl img, .avatar--md img { width: 100%; height: 100%; object-fit: cover; }
    .avatar--md {
      width: 64px; height: 64px; border-radius: 50%; flex-shrink: 0;
      font-size: 1.3rem; display: flex; align-items: center; justify-content: center;
      background: var(--surface-2); overflow: hidden;
    }
    .tg-profile-name { font-size: 1.4rem; font-weight: 600; color: var(--text-primary); }
    .tg-profile-status { font-size: 0.85rem; color: var(--color-success, #4caf50); }
    .tg-profile-bio {
      max-width: 280px; text-align: center; font-size: 13px;
      color: var(--text-secondary); margin-top: 4px; line-height: 1.4;
    }
    .tg-section {
      margin: 8px 12px 12px; background: var(--surface-1);
      border-radius: 14px; overflow: hidden;
      border: 1px solid var(--border-subtle);
    }
    .tg-section__label {
      padding: 12px 16px 6px; font-size: 12px; font-weight: 600;
      color: var(--color-accent); text-transform: uppercase; letter-spacing: 0.03em;
    }
    .tg-row {
      display: flex; align-items: center; gap: 14px;
      padding: 12px 16px; min-height: 52px;
      border-top: 1px solid var(--border-subtle);
    }
    .tg-section .tg-row:first-of-type { border-top: none; }
    .tg-row__icon { font-size: 1.15rem; color: var(--color-accent); width: 24px; text-align: center; flex-shrink: 0; }
    .tg-row__body { flex: 1; min-width: 0; }
    .tg-row__title { font-size: 15px; color: var(--text-primary); }
    .tg-row__sub { font-size: 12px; color: var(--text-secondary); margin-top: 2px; }
    .tg-row__value { font-size: 13px; color: var(--text-secondary); }
    .tg-row__chevron { color: var(--text-tertiary); font-size: 0.9rem; }
    .tg-row--btn {
      width: 100%; border: none; background: transparent;
      cursor: pointer; text-align: left; font: inherit; color: inherit;
    }
    .tg-row--btn:hover, .tg-row--btn:active { background: var(--surface-2); }
    .tg-row--danger .tg-row__title,
    .tg-row--danger .tg-row__icon { color: var(--color-danger, #e53935); }
    .tg-row--toggle input[type="checkbox"] {
      width: 42px; height: 24px; accent-color: var(--color-accent);
      cursor: pointer; flex-shrink: 0;
    }
    .tg-select {
      max-width: 140px; height: 34px; border-radius: 8px;
      border: 1px solid var(--border-default); background: var(--surface-2);
      color: var(--text-primary); font-size: 13px; padding: 0 8px; cursor: pointer;
    }
    .settings-overlay {
      position: fixed; inset: 0; z-index: 600;
      background: rgba(0,0,0,0.5);
      display: none;
      align-items: flex-end; justify-content: center;
      backdrop-filter: blur(2px);
    }
    .settings-overlay.is-open { display: flex; }
    @media (min-width: 600px) {
      .settings-overlay { align-items: center; }
    }
    .settings-sheet {
      width: 100%; max-width: 420px; background: var(--surface-1);
      border-radius: 16px 16px 0 0; max-height: 90vh; overflow: auto;
      animation: sheet-up 0.2s ease-out;
    }
    @media (min-width: 600px) {
      .settings-sheet { border-radius: 16px; }
    }
    @keyframes sheet-up {
      from { transform: translateY(16px); opacity: 0.6; }
      to { transform: translateY(0); opacity: 1; }
    }
    .settings-sheet__head {
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 16px; border-bottom: 1px solid var(--border-subtle);
      position: sticky; top: 0; background: var(--surface-1); z-index: 1;
    }
    .settings-sheet__body {
      padding: 16px; display: flex; flex-direction: column; gap: 16px;
    }
    .settings-dialog {
      background: var(--surface-1); border-radius: 16px; padding: 24px;
      width: min(360px, 92vw); text-align: center;
      box-shadow: 0 16px 48px rgba(0,0,0,0.35);
    }
    .settings-dialog h3 { margin: 0 0 8px; color: var(--text-primary); }
    .settings-dialog p { margin: 0 0 20px; color: var(--text-secondary); font-size: 14px; line-height: 1.45; }
    .settings-dialog__actions { display: flex; gap: 10px; justify-content: center; }
    .btn--danger {
      background: var(--color-danger, #e53935); color: #fff; border: none;
      padding: 10px 18px; border-radius: 10px; font-weight: 600; cursor: pointer;
    }
    .btn--sm { padding: 6px 14px; font-size: 14px; }
    .field { display: flex; flex-direction: column; gap: 6px; }
    .field__label {
      font-size: 12px; font-weight: 600; color: var(--text-secondary);
      text-transform: uppercase; letter-spacing: 0.04em;
    }
    .field__label-row { display: flex; justify-content: space-between; align-items: center; }
    .field__counter { font-size: 11px; color: var(--text-tertiary); }
    .field__input, .field__textarea {
      width: 100%; padding: 10px 12px; border-radius: 10px; font-size: 15px;
      border: 1px solid var(--border-default); background: var(--surface-2);
      color: var(--text-primary); box-sizing: border-box; font-family: inherit;
    }
    .field__textarea { resize: vertical; min-height: 72px; }
    .field__input:focus, .field__textarea:focus {
      outline: 2px solid var(--color-accent); border-color: transparent;
    }
    .field__input-wrap {
      display: flex; align-items: center;
      border: 1px solid var(--border-default); border-radius: 10px;
      background: var(--surface-2); overflow: hidden;
    }
    .field__input-wrap:focus-within { outline: 2px solid var(--color-accent); }
    .field__prefix { padding: 0 0 0 12px; color: var(--text-secondary); font-size: 15px; }
    .field__input--prefixed {
      border: none; background: transparent; outline: none;
      padding: 10px 12px 10px 4px; flex: 1; color: var(--text-primary); font-size: 15px;
    }
    .avatar-edit-row { display: flex; align-items: center; gap: 12px; }
    .avatar-edit-actions { display: flex; flex-direction: column; gap: 8px; flex: 1; }
    .theme-chips { display: flex; gap: 8px; flex-wrap: wrap; }
    .theme-chip {
      flex: 1; min-width: 88px; padding: 12px; border-radius: 10px;
      border: 1px solid var(--border-default); background: var(--surface-2);
      color: var(--text-secondary); font-weight: 600; font-size: 13px; cursor: pointer;
    }
    .theme-chip.active {
      border-color: var(--color-accent); color: var(--color-accent);
      background: var(--color-accent-muted);
    }
  `;
  document.head.appendChild(style);
}

/* ─────────────────────────── renderer ────────────────────────── */

export function renderSettings() {
  const root = document.getElementById("page-root");
  if (!root) return () => {};

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

  // Devices load async — placeholder first
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
      <!-- Profile -->
      <div class="tg-profile-card">
        <div class="avatar avatar--xl" id="settings-avatar">
          ${
            photo
              ? `<img src="${escapeHtml(photo)}" alt="Avatar">`
              : `<span>${(name[0] || "U").toUpperCase()}</span>`
          }
        </div>
        <div class="tg-profile-name" id="settings-name">${escapeHtml(name)}</div>
        <div class="tg-profile-status" id="settings-online">online</div>
        ${
          bio
            ? `<div class="tg-profile-bio" id="settings-bio">${escapeHtml(bio)}</div>`
            : `<div class="tg-profile-bio" id="settings-bio" hidden></div>`
        }
      </div>

      <!-- Identity -->
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
            <div class="tg-row__title" id="settings-username">${username ? "@" + escapeHtml(username) : "—"}</div>
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

      <!-- Notifications module -->
      ${notificationsSectionHtml()}

      <!-- Privacy module -->
      ${privacySectionHtml()}

      <!-- Appearance module -->
      ${appearanceSectionHtml()}

      <!-- Security module (includes password overlay markup) -->
      ${securitySectionHtml()}

      <!-- Devices (filled async) -->
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

      <!-- General -->
      <div class="tg-section">
        <div class="tg-section__label">General</div>
        <button type="button" class="tg-row tg-row--btn" id="btn-data">
          <i class="bi bi-database tg-row__icon"></i>
          <div class="tg-row__body"><div class="tg-row__title">Data and Storage</div></div>
          <i class="bi bi-chevron-right tg-row__chevron"></i>
        </button>
        <button type="button" class="tg-row tg-row--btn" id="btn-about">
          <i class="bi bi-info-circle tg-row__icon"></i>
          <div class="tg-row__body"><div class="tg-row__title">About Nexus</div></div>
          <span class="tg-row__value">v1.0</span>
        </button>
      </div>

      <!-- Logout -->
      <div class="tg-section">
        <button type="button" class="tg-row tg-row--btn tg-row--danger" id="btn-logout">
          <i class="bi bi-box-arrow-right tg-row__icon"></i>
          <div class="tg-row__body"><div class="tg-row__title">Log out</div></div>
        </button>
      </div>
      <div style="height:28px"></div>
    </div>

    <!-- Edit profile overlay -->
    <div id="edit-overlay" class="settings-overlay" hidden>
      <div class="settings-sheet" role="dialog" aria-modal="true" aria-label="Edit profile">
        <div class="settings-sheet__head">
          <button type="button" class="btn btn--ghost" id="edit-cancel">Cancel</button>
          <strong>Edit profile</strong>
          <button type="button" class="btn btn--primary btn--sm" id="edit-save">Save</button>
        </div>
        <div class="settings-sheet__body">
          <div class="field">
            <label class="field__label">Profile photo</label>
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
                <input class="field__input" id="edit-photo" placeholder="…or paste image URL" value="${escapeHtml(photo)}" />
              </div>
            </div>
          </div>
          <div class="field">
            <label class="field__label">Display name</label>
            <input class="field__input" id="edit-name" maxlength="40" value="${escapeHtml(name)}" />
          </div>
          <div class="field">
            <label class="field__label">Username</label>
            <div class="field__input-wrap">
              <span class="field__prefix">@</span>
              <input class="field__input field__input--prefixed" id="edit-username"
                     maxlength="32" placeholder="your_username" value="${escapeHtml(username)}" />
            </div>
          </div>
          <div class="field">
            <div class="field__label-row">
              <label class="field__label">Bio</label>
              <span class="field__counter" id="bio-counter">${bio.length}/160</span>
            </div>
            <textarea class="field__textarea" id="edit-bio" maxlength="160" rows="3">${escapeHtml(bio)}</textarea>
          </div>
        </div>
      </div>
    </div>

    <!-- Logout confirm -->
    <div id="logout-overlay" class="settings-overlay" hidden>
      <div class="settings-dialog" role="alertdialog" aria-modal="true">
        <h3>Log out?</h3>
        <p>You will need to sign in again to use Nexus on this device.</p>
        <div class="settings-dialog__actions">
          <button type="button" class="btn btn--secondary" id="logout-cancel">Cancel</button>
          <button type="button" class="btn btn--danger" id="logout-confirm">Log out</button>
        </div>
      </div>
    </div>
  `;

  const editOverlay = root.querySelector("#edit-overlay");
  const logoutOverlay = root.querySelector("#logout-overlay");

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

  const onKeyDown = (e) => {
    if (e.key !== "Escape") return;
    closeOverlay(editOverlay);
    closeOverlay(logoutOverlay);
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
  logoutOverlay?.addEventListener("click", (e) => {
    if (e.target === logoutOverlay) closeOverlay(logoutOverlay);
  });

  root.querySelector("#btn-settings-back")?.addEventListener("click", () => navigate("chats"));

  /* ── Module binders ── */
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

  /* ── Edit profile ── */
  let pendingAvatarFile = null;
  const fileInput = root.querySelector("#avatar-file-input");
  const avatarPreview = root.querySelector("#edit-avatar-preview");

  root.querySelector("#btn-edit-profile")?.addEventListener("click", () => openOverlay(editOverlay));
  root.querySelector("#edit-cancel")?.addEventListener("click", () => {
    pendingAvatarFile = null;
    closeOverlay(editOverlay);
  });

  const bioTextarea = root.querySelector("#edit-bio");
  const bioCounter = root.querySelector("#bio-counter");
  bioTextarea?.addEventListener("input", () => {
    if (bioCounter) bioCounter.textContent = `${bioTextarea.value.length}/160`;
  });

  const usernameInput = root.querySelector("#edit-username");
  usernameInput?.addEventListener("input", () => {
    const pos = usernameInput.selectionStart;
    const n = normalizeUsername(usernameInput.value);
    if (usernameInput.value !== n) {
      usernameInput.value = n;
      usernameInput.setSelectionRange(Math.max(0, pos - 1), Math.max(0, pos - 1));
    }
  });

  root.querySelector("#btn-pick-photo")?.addEventListener("click", () => fileInput?.click());
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
    const displayName = root.querySelector("#edit-name")?.value.trim() || "";
    const bioVal = root.querySelector("#edit-bio")?.value.trim().slice(0, 160) || "";
    const photoUrlVal = root.querySelector("#edit-photo")?.value.trim() || "";
    const usernameVal = normalizeUsername(root.querySelector("#edit-username")?.value || "");

    if (!displayName) {
      showToast("Name is required");
      return;
    }
    if (usernameVal && !isValidUsername(usernameVal)) {
      showToast("Username must be 3–32 characters (a–z, 0–9, _)");
      return;
    }

    const btn = root.querySelector("#edit-save");
    const restore = setButtonLoading(btn, "Saving…");
    try {
      let photoURL = photoUrlVal || null;
      if (pendingAvatarFile) {
        showToast("Uploading photo…");
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
      showToast("Profile updated");

      const n = getState().profile?.displayName || displayName;
      const u = getState().profile?.username || usernameVal;
      const b = getState().profile?.bio || bioVal;
      const p = getState().profile?.photoURL || photoURL;
      const nameEl = root.querySelector("#settings-name");
      const userEl = root.querySelector("#settings-username");
      const bioEl = root.querySelector("#settings-bio");
      const av = root.querySelector("#settings-avatar");
      if (nameEl) nameEl.textContent = n;
      if (userEl) userEl.textContent = u ? `@${u}` : "—";
      if (bioEl) {
        if (b) {
          bioEl.hidden = false;
          bioEl.textContent = b;
        } else {
          bioEl.hidden = true;
          bioEl.textContent = "";
        }
      }
      if (av) {
        av.innerHTML = p
          ? `<img src="${escapeHtml(p)}" alt="Avatar">`
          : `<span>${(n[0] || "U").toUpperCase()}</span>`;
      }
    } catch (e) {
      console.error(e);
      showToast(e.message || "Update failed");
    } finally {
      restore();
    }
  });

  root.querySelector("#btn-about")?.addEventListener("click", () => {
    showToast("Nexus — private modern messaging");
  });
  root.querySelector("#btn-data")?.addEventListener("click", () => {
    showToast("Storage management — coming soon");
  });

  /* Logout */
  root.querySelector("#btn-logout")?.addEventListener("click", () => openOverlay(logoutOverlay));
  root.querySelector("#logout-cancel")?.addEventListener("click", () => closeOverlay(logoutOverlay));
  root.querySelector("#logout-confirm")?.addEventListener("click", async () => {
    const btn = root.querySelector("#logout-confirm");
    const restore = setButtonLoading(btn, "Logging out…");
    try {
      await signOut();
      try {
        resetState();
      } catch (_) {}
      location.href = location.pathname + location.search;
    } catch (_) {
      showToast("Sign out failed");
      restore();
    }
  });

  /* Realtime listeners */
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
          const nameEl = root.querySelector("#settings-name");
          const userEl = root.querySelector("#settings-username");
          const bioEl = root.querySelector("#settings-bio");
          const av = root.querySelector("#settings-avatar");
          if (nameEl && data.displayName) nameEl.textContent = data.displayName;
          if (userEl) userEl.textContent = data.username ? `@${data.username}` : "—";
          if (bioEl) {
            if (data.bio) {
              bioEl.hidden = false;
              bioEl.textContent = data.bio;
            } else {
              bioEl.hidden = true;
            }
          }
          if (av && data.photoURL) {
            av.innerHTML = `<img src="${escapeHtml(data.photoURL)}" alt="Avatar">`;
          }
        },
        (err) => console.warn("profile listener:", err)
      );
  }

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