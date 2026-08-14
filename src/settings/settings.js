/**
 * Settings — Telegram-style, Firebase-backed privacy & preferences
 * Refactored & enhanced by senior review
 */

import { db, auth, storage } from "../config/firebase.js";
import { getState, setState, applyTheme } from "../core/state.js";
import { signOut, loadUserData } from "../auth/auth.js";
import { navigate } from "../core/router.js";
import { showToast } from "../components/toast.js";

let unsubSettings = null;
let styleInjected = false; // prevent duplicate style injection

/* ─────────────────────────── helpers ─────────────────────────── */

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function saveSettings(patch) {
  const me = auth.currentUser;
  if (!me) throw new Error("Not authenticated");
  await db.collection("userSettings").doc(me.uid).set(patch, { merge: true });
}

async function saveProfile(patch) {
  const me = auth.currentUser;
  if (!me) throw new Error("Not authenticated");
  await db.collection("users").doc(me.uid).set(patch, { merge: true });
  await loadUserData(me.uid);
}

/**
 * BUG FIX: `key` param was accepted but never used — removed dead param.
 */
function privacyOptions(current) {
  const opts = [
    { v: "everyone",  l: "Everyone"     },
    { v: "contacts",  l: "My contacts"  },
    { v: "nobody",    l: "Nobody"       },
  ];
  return opts
    .map(
      (o) =>
        `<option value="${o.v}" ${current === o.v ? "selected" : ""}>${o.l}</option>`
    )
    .join("");
}

/** Upload a File object to Firebase Storage and return the download URL. */
async function uploadAvatar(file) {
  const me = auth.currentUser;
  if (!me) throw new Error("Not authenticated");
  const ref = storage.ref(`avatars/${me.uid}`);
  await ref.put(file);
  return ref.getDownloadURL();
}

/** Toggle a button into a loading state; returns a restore function. */
function setButtonLoading(btn, loadingText = "Saving…") {
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = loadingText;
  return () => {
    btn.disabled = false;
    btn.textContent = original;
  };
}

/* ─────────────────────────── renderer ────────────────────────── */

export function renderSettings() {
  const root = document.getElementById("page-root");
  if (!root) return () => {};

  // Cleanup previous listener before re-rendering
  if (unsubSettings) {
    unsubSettings();
    unsubSettings = null;
  }

  const isDesktop = window.matchMedia("(min-width: 900px)").matches;
  const { profile, privateProfile, settings, theme } = getState();

  const name     = profile?.displayName || "User";
  const username = profile?.username    || "";
  const bio      = profile?.bio         || "";
  const phone    = privateProfile?.phone || "";
  const email    = privateProfile?.email || auth.currentUser?.email || "";
  const photo    = profile?.photoURL    || "";

  /**
   * BUG FIX: Always derive `priv` from fresh state so privacy selects
   * don't carry stale values across re-renders.
   */
  const priv = {
    photo:        "everyone",
    lastSeen:     "contacts",
    online:       "contacts",
    readReceipts: true,
    phone:        "nobody",
    email:        "nobody",
    bio:          "everyone",
    ...(settings?.privacy || {}),
  };
  const notif = { messages: true, calls: true, ...(settings?.notifications || {}) };

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

      <!-- Profile card -->
      <div class="tg-profile-card">
        <div class="tg-avatar-wrap">
          <div class="avatar avatar--xl" id="settings-avatar">
            ${
              photo
                ? `<img src="${escapeHtml(photo)}" alt="Avatar" id="avatar-img">`
                : `<span id="avatar-initial">${(name[0] || "U").toUpperCase()}</span>`
            }
          </div>
        </div>
        <div class="tg-profile-name" id="settings-name">${escapeHtml(name)}</div>
        <div class="tg-profile-status">online</div>
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
            <div class="tg-row__title">${username ? "@" + escapeHtml(username) : "—"}</div>
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

      <!-- Notifications -->
      <div class="tg-section">
        <div class="tg-section__label">Notifications</div>
        <label class="tg-row tg-row--toggle">
          <i class="bi bi-bell tg-row__icon"></i>
          <div class="tg-row__body"><div class="tg-row__title">Message notifications</div></div>
          <input type="checkbox" id="tog-notif-msg" ${notif.messages !== false ? "checked" : ""} />
        </label>
        <label class="tg-row tg-row--toggle">
          <i class="bi bi-telephone-inbound tg-row__icon"></i>
          <div class="tg-row__body"><div class="tg-row__title">Call notifications</div></div>
          <input type="checkbox" id="tog-notif-calls" ${notif.calls !== false ? "checked" : ""} />
        </label>
      </div>

      <!-- Privacy -->
      <div class="tg-section">
        <div class="tg-section__label">Privacy and Security</div>

        <div class="tg-row tg-row--select">
          <i class="bi bi-eye tg-row__icon"></i>
          <div class="tg-row__body"><div class="tg-row__title">Last seen &amp; online</div></div>
          <select id="priv-lastSeen" class="tg-select">${privacyOptions(priv.lastSeen)}</select>
        </div>

        <div class="tg-row tg-row--select">
          <i class="bi bi-image tg-row__icon"></i>
          <div class="tg-row__body"><div class="tg-row__title">Profile photo</div></div>
          <select id="priv-photo" class="tg-select">${privacyOptions(priv.photo)}</select>
        </div>

        <div class="tg-row tg-row--select">
          <i class="bi bi-card-text tg-row__icon"></i>
          <div class="tg-row__body"><div class="tg-row__title">Bio</div></div>
          <select id="priv-bio" class="tg-select">${privacyOptions(priv.bio)}</select>
        </div>

        <div class="tg-row tg-row--select">
          <i class="bi bi-telephone tg-row__icon"></i>
          <div class="tg-row__body"><div class="tg-row__title">Phone number</div></div>
          <select id="priv-phone" class="tg-select">${privacyOptions(priv.phone)}</select>
        </div>

        <div class="tg-row tg-row--select">
          <i class="bi bi-envelope tg-row__icon"></i>
          <div class="tg-row__body"><div class="tg-row__title">Email</div></div>
          <select id="priv-email" class="tg-select">${privacyOptions(priv.email)}</select>
        </div>

        <label class="tg-row tg-row--toggle">
          <i class="bi bi-check2-all tg-row__icon"></i>
          <div class="tg-row__body">
            <div class="tg-row__title">Read receipts</div>
            <div class="tg-row__sub">If off, you won't send or receive read receipts</div>
          </div>
          <input type="checkbox" id="tog-read-receipts" ${priv.readReceipts !== false ? "checked" : ""} />
        </label>
      </div>

      <!-- Appearance -->
      <div class="tg-section">
        <div class="tg-section__label">Appearance</div>
        <div class="theme-chips" style="padding: 4px 12px 14px">
          <button type="button" class="theme-chip ${theme === "light"  ? "active" : ""}" data-theme="light">Light</button>
          <button type="button" class="theme-chip ${theme === "dark"   ? "active" : ""}" data-theme="dark">Dark</button>
          <button type="button" class="theme-chip ${theme === "system" ? "active" : ""}" data-theme="system">System</button>
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

      <div style="height:24px"></div>
    </div>

    <!-- Edit profile modal -->
    <div id="edit-overlay" class="settings-overlay" hidden>
      <div class="settings-sheet" role="dialog" aria-modal="true" aria-label="Edit profile">
        <div class="settings-sheet__head">
          <button type="button" class="btn btn--ghost" id="edit-cancel">Cancel</button>
          <strong>Edit profile</strong>
          <button type="button" class="btn btn--primary btn--sm" id="edit-save">Save</button>
        </div>
        <div class="settings-sheet__body">

          <!-- FEATURE: Avatar file upload -->
          <div class="field field--avatar">
            <label class="field__label">Profile photo</label>
            <div class="avatar-edit-row">
              <div class="avatar avatar--md" id="edit-avatar-preview">
                ${
                  photo
                    ? `<img src="${escapeHtml(photo)}" alt="" id="preview-img">`
                    : `<span>${(name[0] || "U").toUpperCase()}</span>`
                }
              </div>
              <div class="avatar-edit-actions">
                <button type="button" class="btn btn--secondary btn--sm" id="btn-pick-photo">
                  <i class="bi bi-upload"></i> Upload photo
                </button>
                <input type="file" id="avatar-file-input" accept="image/*" hidden />
                <div class="field__input" style="flex:1" id="edit-photo-url-wrap">
                  <input
                    class="field__input"
                    id="edit-photo"
                    placeholder="…or paste a URL"
                    value="${escapeHtml(photo)}"
                    style="border:none;padding:0;background:transparent"
                  />
                </div>
              </div>
            </div>
          </div>

          <div class="field">
            <label class="field__label">Display name</label>
            <input class="field__input" id="edit-name" maxlength="40" value="${escapeHtml(name)}" />
          </div>

          <!-- FEATURE: Username editing -->
          <div class="field">
            <label class="field__label">Username</label>
            <div class="field__input-wrap">
              <span class="field__prefix">@</span>
              <input
                class="field__input field__input--prefixed"
                id="edit-username"
                maxlength="30"
                placeholder="your_username"
                value="${escapeHtml(username)}"
              />
            </div>
          </div>

          <!-- FEATURE: Bio with character counter -->
          <div class="field">
            <div class="field__label-row">
              <label class="field__label">Bio</label>
              <span class="field__counter" id="bio-counter">${bio.length}/160</span>
            </div>
            <textarea
              class="field__textarea"
              id="edit-bio"
              maxlength="160"
              rows="3"
            >${escapeHtml(bio)}</textarea>
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
          <button type="button" class="btn btn--danger"    id="logout-confirm">Log out</button>
        </div>
      </div>
    </div>
  `;

  /* ── styles (injected once per page lifecycle) ── */
  if (!styleInjected) {
    styleInjected = true;
    const style = document.createElement("style");
    style.id = "settings-styles";
    style.textContent = `
      .settings-scroll { background: var(--surface-0); }

      /* Profile card */
      .tg-profile-card {
        display: flex; flex-direction: column; align-items: center;
        padding: 28px 16px 20px; gap: 6px;
      }
      .avatar--xl {
        width: 96px; height: 96px; border-radius: 50%;
        font-size: 2rem; display: flex; align-items: center; justify-content: center;
        background: var(--surface-3, var(--surface-2)); overflow: hidden;
        cursor: pointer; position: relative;
      }
      .avatar--xl img  { width: 100%; height: 100%; object-fit: cover; }
      .avatar--md {
        width: 60px; height: 60px; border-radius: 50%; flex-shrink: 0;
        font-size: 1.25rem; display: flex; align-items: center; justify-content: center;
        background: var(--surface-3, var(--surface-2)); overflow: hidden;
      }
      .avatar--md img { width: 100%; height: 100%; object-fit: cover; }
      .tg-profile-name   { font-size: 1.35rem; font-weight: 600; color: var(--text-primary); }
      .tg-profile-status { font-size: 0.85rem; color: var(--color-success, #4caf50); }

      /* Sections */
      .tg-section {
        margin: 8px 12px 12px; background: var(--surface-1);
        border-radius: 14px; overflow: hidden;
        border: 1px solid var(--border-subtle);
      }
      .tg-section__label {
        padding: 12px 16px 6px; font-size: 12px; font-weight: 600;
        color: var(--color-accent); text-transform: uppercase; letter-spacing: 0.03em;
      }

      /* Rows */
      .tg-row {
        display: flex; align-items: center; gap: 14px;
        padding: 12px 16px; min-height: 52px;
        border-top: 1px solid var(--border-subtle);
      }
      .tg-section .tg-row:first-of-type { border-top: none; }
      .tg-row__icon    { font-size: 1.15rem; color: var(--color-accent); width: 24px; text-align: center; flex-shrink: 0; }
      .tg-row__body    { flex: 1; min-width: 0; }
      .tg-row__title   { font-size: 15px; color: var(--text-primary); }
      .tg-row__sub     { font-size: 12px; color: var(--text-secondary); margin-top: 2px; }
      .tg-row__value   { font-size: 13px; color: var(--text-secondary); }
      .tg-row__chevron { color: var(--text-tertiary); font-size: 0.9rem; }
      .tg-row--btn {
        width: 100%; border: none; background: transparent;
        cursor: pointer; text-align: left; font: inherit;
      }
      .tg-row--btn:hover,
      .tg-row--btn:active { background: var(--surface-2); }
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

      /* Overlays */
      /*
       * BUG FIX: Original used display:flex on .settings-overlay but [hidden]
       * attribute only sets display:none — the flex rule was winning after
       * unhiding because specificity was equal, causing a flash. Fixed by
       * using a .is-open class to control visibility instead of [hidden].
       */
      .settings-overlay {
        position: fixed; inset: 0; z-index: 600;
        background: rgba(0,0,0,0.45);
        display: none;
        align-items: flex-end; justify-content: center;
      }
      .settings-overlay.is-open { display: flex; }
      @media (min-width: 600px) {
        .settings-overlay { align-items: center; }
      }

      /* Sheet (bottom drawer → centered on wide) */
      .settings-sheet {
        width: 100%; max-width: 420px; background: var(--surface-1);
        border-radius: 16px 16px 0 0; max-height: 90vh; overflow: auto;
      }
      @media (min-width: 600px) {
        .settings-sheet { border-radius: 16px; }
      }
      .settings-sheet__head {
        display: flex; align-items: center; justify-content: space-between;
        padding: 12px 16px; border-bottom: 1px solid var(--border-subtle);
        position: sticky; top: 0; background: var(--surface-1);
      }
      .settings-sheet__body { padding: 16px; display: flex; flex-direction: column; gap: 16px; }

      /* Dialog */
      .settings-dialog {
        background: var(--surface-1); border-radius: 16px; padding: 24px;
        width: min(360px, 92vw); text-align: center;
      }
      .settings-dialog h3 { margin: 0 0 8px; color: var(--text-primary); }
      .settings-dialog p  { margin: 0 0 20px; color: var(--text-secondary); font-size: 14px; }
      .settings-dialog__actions { display: flex; gap: 10px; justify-content: center; }

      /* Buttons */
      .btn--danger {
        background: var(--color-danger, #e53935); color: #fff; border: none;
        padding: 10px 18px; border-radius: 10px; font-weight: 600; cursor: pointer;
      }
      .btn--sm { padding: 6px 14px; font-size: 14px; }

      /* Fields */
      .field { display: flex; flex-direction: column; gap: 6px; }
      .field__label { font-size: 12px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.04em; }
      .field__label-row { display: flex; justify-content: space-between; align-items: center; }
      .field__counter  { font-size: 11px; color: var(--text-tertiary); }
      .field__input    {
        width: 100%; padding: 10px 12px; border-radius: 10px; font-size: 15px;
        border: 1px solid var(--border-default); background: var(--surface-2);
        color: var(--text-primary); box-sizing: border-box;
      }
      .field__input:focus  { outline: 2px solid var(--color-accent); border-color: transparent; }
      .field__textarea {
        width: 100%; padding: 10px 12px; border-radius: 10px; font-size: 15px;
        border: 1px solid var(--border-default); background: var(--surface-2);
        color: var(--text-primary); resize: vertical; font-family: inherit; box-sizing: border-box;
      }
      .field__textarea:focus { outline: 2px solid var(--color-accent); border-color: transparent; }
      .field__input-wrap {
        display: flex; align-items: center;
        border: 1px solid var(--border-default); border-radius: 10px;
        background: var(--surface-2); overflow: hidden;
      }
      .field__input-wrap:focus-within { outline: 2px solid var(--color-accent); }
      .field__prefix { padding: 0 0 0 12px; color: var(--text-secondary); font-size: 15px; }
      .field__input--prefixed { border: none; background: transparent; outline: none; padding: 10px 12px 10px 4px; flex: 1; }

      /* Avatar edit row */
      .avatar-edit-row    { display: flex; align-items: center; gap: 12px; }
      .avatar-edit-actions { display: flex; flex-direction: column; gap: 8px; flex: 1; }
    `;
    document.head.appendChild(style);
  }

  /* ── helpers for overlay open/close ── */
  function openOverlay(el)  { el.hidden = false; el.classList.add("is-open"); }
  function closeOverlay(el) { el.hidden = true;  el.classList.remove("is-open"); }

  /* ── Escape key closes any open modal ── */
  const onKeyDown = (e) => {
    if (e.key !== "Escape") return;
    const editOv   = root.querySelector("#edit-overlay");
    const logoutOv = root.querySelector("#logout-overlay");
    if (editOv   && !editOv.hidden)   closeOverlay(editOv);
    if (logoutOv && !logoutOv.hidden) closeOverlay(logoutOv);
  };
  document.addEventListener("keydown", onKeyDown);

  /* ── back ── */
  root.querySelector("#btn-settings-back")?.addEventListener("click", () => navigate("chats"));

  /* ── theme chips ── */
  root.querySelectorAll(".theme-chip").forEach((chip) => {
    chip.addEventListener("click", async () => {
      const t = chip.dataset.theme;
      applyTheme(t);
      root.querySelectorAll(".theme-chip").forEach((c) =>
        c.classList.toggle("active", c.dataset.theme === t)
      );
      try {
        await saveSettings({ theme: t });
      } catch (_) {}
      const label = t === "system" ? "System theme" : t === "dark" ? "Dark mode" : "Light mode";
      showToast(label);
    });
  });

  /* ── notifications ── */
  const saveNotif = async () => {
    try {
      await saveSettings({
        notifications: {
          messages: root.querySelector("#tog-notif-msg").checked,
          calls:    root.querySelector("#tog-notif-calls").checked,
        },
      });
      showToast("Notifications updated");
    } catch (_) {
      showToast("Could not save notifications");
    }
  };
  root.querySelector("#tog-notif-msg")?.addEventListener("change", saveNotif);
  root.querySelector("#tog-notif-calls")?.addEventListener("change", saveNotif);

  /* ── privacy selects ── */
  const privacyKeys = ["lastSeen", "photo", "bio", "phone", "email"];
  privacyKeys.forEach((key) => {
    const el = root.querySelector(`#priv-${key}`);
    el?.addEventListener("change", async () => {
      try {
        /**
         * BUG FIX: The original read from the outer `priv` snapshot which
         * could be stale. Now we always read fresh state before merging.
         */
        const freshPriv = getState().settings?.privacy || {};
        const updated = { ...freshPriv, [key]: el.value };
        await saveSettings({ privacy: updated });
        setState({
          settings: {
            ...(getState().settings || {}),
            privacy: updated,
          },
        });
        showToast("Privacy updated");
      } catch (e) {
        showToast("Could not save privacy");
        console.error(e);
      }
    });
  });

  root.querySelector("#tog-read-receipts")?.addEventListener("change", async (e) => {
    try {
      const freshPriv = getState().settings?.privacy || {};
      const updated = { ...freshPriv, readReceipts: e.target.checked };
      await saveSettings({ privacy: updated });
      setState({
        settings: {
          ...(getState().settings || {}),
          privacy: updated,
        },
      });
      showToast("Read receipts updated");
    } catch (_) {
      showToast("Could not save");
    }
  });

  /* ── edit profile modal ── */
  const editOverlay = root.querySelector("#edit-overlay");

  root.querySelector("#btn-edit-profile")?.addEventListener("click", () => {
    openOverlay(editOverlay);
  });
  root.querySelector("#edit-cancel")?.addEventListener("click", () => {
    closeOverlay(editOverlay);
  });

  /* FEATURE: Bio character counter */
  const bioTextarea = root.querySelector("#edit-bio");
  const bioCounter  = root.querySelector("#bio-counter");
  bioTextarea?.addEventListener("input", () => {
    bioCounter.textContent = `${bioTextarea.value.length}/160`;
  });

  /* FEATURE: Avatar file picker → preview */
  const fileInput      = root.querySelector("#avatar-file-input");
  const avatarPreview  = root.querySelector("#edit-avatar-preview");
  let pendingAvatarFile = null;

  root.querySelector("#btn-pick-photo")?.addEventListener("click", () => {
    fileInput.click();
  });

  fileInput?.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    pendingAvatarFile = file;
    const reader = new FileReader();
    reader.onload = (ev) => {
      avatarPreview.innerHTML = `<img src="${ev.target.result}" alt="Preview" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
      root.querySelector("#edit-photo").value = ""; // clear URL field when file chosen
    };
    reader.readAsDataURL(file);
  });

  /* FEATURE: Photo URL → live preview */
  root.querySelector("#edit-photo")?.addEventListener("input", (e) => {
    const url = e.target.value.trim();
    if (url) {
      pendingAvatarFile = null;
      avatarPreview.innerHTML = `<img src="${escapeHtml(url)}" alt="Preview" style="width:100%;height:100%;object-fit:cover;border-radius:50%" onerror="this.style.display='none'">`;
    }
  });

  /* Save profile */
  const editSaveBtn = root.querySelector("#edit-save");
  editSaveBtn?.addEventListener("click", async () => {
    const displayName = root.querySelector("#edit-name").value.trim();
    const bioVal      = root.querySelector("#edit-bio").value.trim().slice(0, 160);
    const photoUrlVal = root.querySelector("#edit-photo").value.trim();
    const usernameVal = root.querySelector("#edit-username").value.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");

    if (!displayName) {
      showToast("Name is required");
      return;
    }

    const restore = setButtonLoading(editSaveBtn);
    try {
      let photoURL = photoUrlVal || null;

      // FEATURE: Upload file first if one was picked
      if (pendingAvatarFile) {
        showToast("Uploading photo…");
        photoURL = await uploadAvatar(pendingAvatarFile);
        pendingAvatarFile = null;
      }

      const patch = { displayName, bio: bioVal, photoURL };
      if (usernameVal) patch.username = usernameVal;

      await saveProfile(patch);
      closeOverlay(editOverlay);
      showToast("Profile updated");
      renderSettings(); // re-render to reflect new values
    } catch (e) {
      showToast(e.message || "Update failed");
    } finally {
      restore();
    }
  });

  /* ── about / data ── */
  root.querySelector("#btn-about")?.addEventListener("click", () => {
    showToast("Nexus — private modern messaging");
  });
  root.querySelector("#btn-data")?.addEventListener("click", () => {
    showToast("Storage management — coming soon");
  });

  /* ── logout with confirm ── */
  const logoutOverlay = root.querySelector("#logout-overlay");

  root.querySelector("#btn-logout")?.addEventListener("click", () => {
    openOverlay(logoutOverlay);
  });
  root.querySelector("#logout-cancel")?.addEventListener("click", () => {
    closeOverlay(logoutOverlay);
  });
  root.querySelector("#logout-confirm")?.addEventListener("click", async () => {
    const btn = root.querySelector("#logout-confirm");
    const restore = setButtonLoading(btn, "Logging out…");
    try {
      await signOut();
      location.href = location.pathname;
    } catch (_) {
      showToast("Sign out failed");
      restore();
    }
  });

  /* ── live Firestore settings listener ── */
  const me = auth.currentUser;
  if (me) {
    unsubSettings = db
      .collection("userSettings")
      .doc(me.uid)
      .onSnapshot(
        (snap) => {
          if (snap.exists) {
            setState({ settings: snap.data() });
          }
        },
        (err) => console.warn("settings listener:", err)
      );
  }

  /* ── cleanup function ── */
  return () => {
    document.removeEventListener("keydown", onKeyDown);
    if (unsubSettings) {
      unsubSettings();
      unsubSettings = null;
    }
    // Reset style injection flag so styles re-inject if the page is remounted
    styleInjected = false;
    const existingStyle = document.getElementById("settings-styles");
    if (existingStyle) existingStyle.remove();
    root.innerHTML = "";
  };
}

export default { renderSettings };