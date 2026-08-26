/**
 * Notifications — message / call prefs + browser permission
 * Firestore: userSettings/{uid}.notifications
 */

import { db, auth } from "../config/firebase.js";
import { getState, setState } from "../core/state.js";
import { showToast } from "../components/toast.js";
import { navigate } from "../core/router.js";

const FieldValue = firebase.firestore.FieldValue;

/* ─────────────────────────── defaults ─────────────────────────── */

export const DEFAULT_NOTIFICATIONS = {
  messages: true,
  calls: true,
  preview: true,
  sound: true,
  vibration: true,
};

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function getNotificationPrefs() {
  const saved = getState().settings?.notifications || {};
  return { ...DEFAULT_NOTIFICATIONS, ...saved };
}

/* ─────────────────────────── Firestore ─────────────────────────── */

export async function saveNotifications(partial) {
  const me = auth.currentUser;
  if (!me) throw new Error("Not authenticated");

  const next = {
    ...getNotificationPrefs(),
    ...partial,
  };

  await db.collection("userSettings").doc(me.uid).set(
    {
      notifications: next,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  const settings = getState().settings || {};
  setState({
    settings: {
      ...settings,
      notifications: next,
    },
  });

  return next;
}

/* ─────────────────────────── Browser Permission ─────────────────────────── */

export function getBrowserPermission() {
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission;
}

export async function requestBrowserPermission() {
  if (!("Notification" in window)) {
    showToast("Notifications not supported in this browser");
    return "unsupported";
  }
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") {
    showToast("Permission denied — enable from browser settings");
    return "denied";
  }
  try {
    return await Notification.requestPermission();
  } catch (err) {
    console.warn(err);
    return Notification.permission;
  }
}

export function notifyLocal({ title, body, tag } = {}) {
  const prefs = getNotificationPrefs();
  if (!prefs.messages) return;
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  try {
    const n = new Notification(title || "Nexus", {
      body: prefs.preview ? body || "" : "New message",
      tag: tag || "nexus-msg",
      silent: !prefs.sound,
      icon: "/public/icons/icon.png",
    });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch (err) {
    console.warn("notifyLocal:", err);
  }
}

/* ─────────────────────────── UI ─────────────────────────── */

function permissionLabel(status) {
  if (status === "granted") return "Allowed";
  if (status === "denied") return "Blocked";
  if (status === "unsupported") return "Unsupported";
  return "Not set";
}

export function notificationsSectionHtml() {
  const n = getNotificationPrefs();
  const perm = getBrowserPermission();

  return `
    <div class="tg-section" data-section="notifications">
      <div class="tg-section__label">Notifications</div>

      <div class="tg-row">
        <i class="bi bi-phone tg-row__icon"></i>
        <div class="tg-row__body">
          <div class="tg-row__title">Browser permission</div>
          <div class="tg-row__sub" id="notif-perm-label">${escapeHtml(permissionLabel(perm))}</div>
        </div>
        ${
          perm !== "granted" && perm !== "unsupported"
            ? `<button type="button" class="btn btn--secondary btn--sm" id="btn-notif-permission">Enable</button>`
            : `<span class="tg-row__value" id="notif-perm-value">${escapeHtml(permissionLabel(perm))}</span>`
        }
      </div>

      <label class="tg-row tg-row--toggle">
        <i class="bi bi-bell tg-row__icon"></i>
        <div class="tg-row__body">
          <div class="tg-row__title">Message notifications</div>
        </div>
        <input type="checkbox" id="tog-notif-msg" ${n.messages !== false ? "checked" : ""} />
      </label>

      <label class="tg-row tg-row--toggle">
        <i class="bi bi-telephone-inbound tg-row__icon"></i>
        <div class="tg-row__body">
          <div class="tg-row__title">Call notifications</div>
        </div>
        <input type="checkbox" id="tog-notif-calls" ${n.calls !== false ? "checked" : ""} />
      </label>

      <label class="tg-row tg-row--toggle">
        <i class="bi bi-chat-quote tg-row__icon"></i>
        <div class="tg-row__body">
          <div class="tg-row__title">Message preview</div>
          <div class="tg-row__sub">Show text inside notifications</div>
        </div>
        <input type="checkbox" id="tog-notif-preview" ${n.preview !== false ? "checked" : ""} />
      </label>

      <label class="tg-row tg-row--toggle">
        <i class="bi bi-volume-up tg-row__icon"></i>
        <div class="tg-row__body">
          <div class="tg-row__title">Sound</div>
        </div>
        <input type="checkbox" id="tog-notif-sound" ${n.sound !== false ? "checked" : ""} />
      </label>

      <label class="tg-row tg-row--toggle">
        <i class="bi bi-phone-vibrate tg-row__icon"></i>
        <div class="tg-row__body">
          <div class="tg-row__title">Vibration</div>
          <div class="tg-row__sub">Mobile devices only</div>
        </div>
        <input type="checkbox" id="tog-notif-vibration" ${n.vibration !== false ? "checked" : ""} />
      </label>
    </div>
  `;
}

export function bindNotificationControls(root) {
  if (!root) return;

  const persist = async (partial, okMsg) => {
    try {
      await saveNotifications(partial);
      if (okMsg) showToast(okMsg);
    } catch (err) {
      console.error(err);
      showToast("Could not save notifications");
    }
  };

  root.querySelector("#btn-notif-permission")?.addEventListener("click", async () => {
    const result = await requestBrowserPermission();
    const label = root.querySelector("#notif-perm-label");
    const value = root.querySelector("#notif-perm-value");
    const text = permissionLabel(result);
    if (label) label.textContent = text;
    if (value) value.textContent = text;
    if (result === "granted") showToast("Notifications enabled");
  });

  root.querySelector("#tog-notif-msg")?.addEventListener("change", (e) => {
    persist({ messages: e.target.checked }, "Message notifications updated");
  });
  root.querySelector("#tog-notif-calls")?.addEventListener("change", (e) => {
    persist({ calls: e.target.checked }, "Call notifications updated");
  });
  root.querySelector("#tog-notif-preview")?.addEventListener("change", (e) => {
    persist({ preview: e.target.checked }, "Preview updated");
  });
  root.querySelector("#tog-notif-sound")?.addEventListener("change", (e) => {
    persist({ sound: e.target.checked }, "Sound updated");
  });
  root.querySelector("#tog-notif-vibration")?.addEventListener("change", (e) => {
    persist({ vibration: e.target.checked }, "Vibration updated");
  });
}

export function renderNotifications() {
  const root = document.getElementById("page-root");
  if (!root) return () => {};

  const isDesktop = window.matchMedia("(min-width: 900px)").matches;

  root.innerHTML = `
    <header class="app-header">
      ${
        !isDesktop
          ? `<button type="button" class="btn btn--icon btn--ghost" id="btn-notif-back" aria-label="Back">
               <i class="bi bi-arrow-left" style="font-size:1.25rem"></i>
             </button>`
          : ""
      }
      <h1 class="app-header__title">Notifications</h1>
    </header>
    <div class="page__scroll">
      ${notificationsSectionHtml()}
    </div>
  `;

  root.querySelector("#btn-notif-back")?.addEventListener("click", () => {
    navigate("settings");
  });

  bindNotificationControls(root);

  return () => {
    root.innerHTML = "";
  };
}

export default {
  DEFAULT_NOTIFICATIONS,
  getNotificationPrefs,
  saveNotifications,
  getBrowserPermission,
  requestBrowserPermission,
  notifyLocal,
  notificationsSectionHtml,
  bindNotificationControls,
  renderNotifications,
};