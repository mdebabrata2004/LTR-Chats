/**
 * Privacy & Security settings
 * Firestore: userSettings/{uid}.privacy
 */

import { db, auth } from "../config/firebase.js";
import { getState, setState } from "../core/state.js";
import { showToast } from "../components/toast.js";
import { navigate } from "../core/router.js";

const FieldValue = firebase.firestore.FieldValue;

/* ─────────────────────────── defaults ─────────────────────────── */

export const DEFAULT_PRIVACY = {
  lastSeen: "contacts", // everyone | contacts | nobody
  online: "contacts",
  photo: "everyone",
  bio: "everyone",
  phone: "nobody",
  email: "nobody",
  readReceipts: true,
  inviteToGroups: "everyone", // everyone | contacts | nobody
};

const VISIBILITY_OPTS = [
  { v: "everyone", l: "Everyone" },
  { v: "contacts", l: "My contacts" },
  { v: "nobody", l: "Nobody" },
];

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function getPrivacyPrefs() {
  const saved = getState().settings?.privacy || {};
  return { ...DEFAULT_PRIVACY, ...saved };
}

/* ─────────────────────────── Firestore ─────────────────────────── */

export async function savePrivacy(partial) {
  const me = auth.currentUser;
  if (!me) throw new Error("Not authenticated");

  const next = {
    ...getPrivacyPrefs(),
    ...partial,
  };

  await db.collection("userSettings").doc(me.uid).set(
    {
      privacy: next,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  const settings = getState().settings || {};
  setState({
    settings: {
      ...settings,
      privacy: next,
    },
  });

  return next;
}

/* ─────────────────────────── UI helpers ─────────────────────────── */

function optionsHtml(current) {
  return VISIBILITY_OPTS.map(
    (o) =>
      `<option value="${o.v}" ${current === o.v ? "selected" : ""}>${o.l}</option>`
  ).join("");
}

/**
 * HTML block for Settings page
 */
export function privacySectionHtml() {
  const p = getPrivacyPrefs();

  return `
    <div class="tg-section" data-section="privacy">
      <div class="tg-section__label">Privacy and Security</div>

      <div class="tg-row tg-row--select">
        <i class="bi bi-eye tg-row__icon"></i>
        <div class="tg-row__body">
          <div class="tg-row__title">Last seen &amp; online</div>
        </div>
        <select id="priv-lastSeen" class="tg-select" data-privacy="lastSeen">
          ${optionsHtml(p.lastSeen)}
        </select>
      </div>

      <div class="tg-row tg-row--select">
        <i class="bi bi-broadcast tg-row__icon"></i>
        <div class="tg-row__body">
          <div class="tg-row__title">Online status</div>
        </div>
        <select id="priv-online" class="tg-select" data-privacy="online">
          ${optionsHtml(p.online)}
        </select>
      </div>

      <div class="tg-row tg-row--select">
        <i class="bi bi-image tg-row__icon"></i>
        <div class="tg-row__body">
          <div class="tg-row__title">Profile photo</div>
        </div>
        <select id="priv-photo" class="tg-select" data-privacy="photo">
          ${optionsHtml(p.photo)}
        </select>
      </div>

      <div class="tg-row tg-row--select">
        <i class="bi bi-card-text tg-row__icon"></i>
        <div class="tg-row__body">
          <div class="tg-row__title">Bio</div>
        </div>
        <select id="priv-bio" class="tg-select" data-privacy="bio">
          ${optionsHtml(p.bio)}
        </select>
      </div>

      <div class="tg-row tg-row--select">
        <i class="bi bi-telephone tg-row__icon"></i>
        <div class="tg-row__body">
          <div class="tg-row__title">Phone number</div>
        </div>
        <select id="priv-phone" class="tg-select" data-privacy="phone">
          ${optionsHtml(p.phone)}
        </select>
      </div>

      <div class="tg-row tg-row--select">
        <i class="bi bi-envelope tg-row__icon"></i>
        <div class="tg-row__body">
          <div class="tg-row__title">Email</div>
        </div>
        <select id="priv-email" class="tg-select" data-privacy="email">
          ${optionsHtml(p.email)}
        </select>
      </div>

      <div class="tg-row tg-row--select">
        <i class="bi bi-people tg-row__icon"></i>
        <div class="tg-row__body">
          <div class="tg-row__title">Groups</div>
          <div class="tg-row__sub">Who can add you to groups</div>
        </div>
        <select id="priv-groups" class="tg-select" data-privacy="inviteToGroups">
          ${optionsHtml(p.inviteToGroups)}
        </select>
      </div>

      <label class="tg-row tg-row--toggle">
        <i class="bi bi-check2-all tg-row__icon"></i>
        <div class="tg-row__body">
          <div class="tg-row__title">Read receipts</div>
          <div class="tg-row__sub">If off, you won't send or receive read receipts</div>
        </div>
        <input type="checkbox" id="tog-read-receipts" data-privacy-toggle="readReceipts"
          ${p.readReceipts !== false ? "checked" : ""} />
      </label>

      <button type="button" class="tg-row tg-row--btn" id="btn-blocked-users">
        <i class="bi bi-slash-circle tg-row__icon"></i>
        <div class="tg-row__body">
          <div class="tg-row__title">Blocked users</div>
          <div class="tg-row__sub">Manage blocked accounts</div>
        </div>
        <i class="bi bi-chevron-right tg-row__chevron"></i>
      </button>
    </div>
  `;
}

/**
 * Bind selects + toggles inside root
 */
export function bindPrivacyControls(root) {
  if (!root) return;

  root.querySelectorAll("[data-privacy]").forEach((el) => {
    el.addEventListener("change", async () => {
      const key = el.getAttribute("data-privacy");
      if (!key) return;
      try {
        await savePrivacy({ [key]: el.value });
        showToast("Privacy updated");
      } catch (err) {
        console.error(err);
        showToast("Could not save privacy");
      }
    });
  });

  root.querySelectorAll("[data-privacy-toggle]").forEach((el) => {
    el.addEventListener("change", async () => {
      const key = el.getAttribute("data-privacy-toggle");
      if (!key) return;
      try {
        await savePrivacy({ [key]: el.checked });
        showToast("Privacy updated");
      } catch (err) {
        console.error(err);
        showToast("Could not save privacy");
      }
    });
  });

  root.querySelector("#btn-blocked-users")?.addEventListener("click", () => {
    showToast("Blocked users — coming soon");
  });
}

/**
 * Check if viewer may see a field of target user's privacy
 * @param {object} targetPrivacy - their privacy map
 * @param {string} field - lastSeen | photo | bio | phone | email | online
 * @param {{ isSelf?: boolean, isContact?: boolean }} ctx
 */
export function canViewPrivacyField(targetPrivacy, field, ctx = {}) {
  if (ctx.isSelf) return true;
  const p = { ...DEFAULT_PRIVACY, ...(targetPrivacy || {}) };
  const rule = p[field] || "nobody";
  if (rule === "everyone") return true;
  if (rule === "contacts") return !!ctx.isContact;
  return false;
}

/**
 * Optional full page (#privacy)
 */
export function renderPrivacy() {
  const root = document.getElementById("page-root");
  if (!root) return () => {};

  const isDesktop = window.matchMedia("(min-width: 900px)").matches;

  root.innerHTML = `
    <header class="app-header">
      ${
        !isDesktop
          ? `<button type="button" class="btn btn--icon btn--ghost" id="btn-privacy-back" aria-label="Back">
               <i class="bi bi-arrow-left" style="font-size:1.25rem"></i>
             </button>`
          : ""
      }
      <h1 class="app-header__title">Privacy</h1>
    </header>
    <div class="page__scroll">
      ${privacySectionHtml()}
    </div>
  `;

  root.querySelector("#btn-privacy-back")?.addEventListener("click", () => {
    navigate("settings");
  });

  bindPrivacyControls(root);

  return () => {
    root.innerHTML = "";
  };
}

export default {
  DEFAULT_PRIVACY,
  getPrivacyPrefs,
  savePrivacy,
  privacySectionHtml,
  bindPrivacyControls,
  canViewPrivacyField,
  renderPrivacy,
};