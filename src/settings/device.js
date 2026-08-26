/**
 * Devices — linked sessions / this device
 * Firestore: userDevices/{uid}/devices/{deviceId}
 */

import { db, auth } from "../config/firebase.js";
import { showToast } from "../components/toast.js";
import { navigate } from "../core/router.js";

const FieldValue = firebase.firestore.FieldValue;

const DEVICE_KEY = "nexus_device_id";

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Stable id for this browser profile */
export function getDeviceId() {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id =
      "web_" +
      Math.random().toString(36).slice(2) +
      "_" +
      Date.now().toString(36);
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

function detectPlatform() {
  const ua = navigator.userAgent || "";
  if (/android/i.test(ua)) return "Android";
  if (/iphone|ipad|ipod/i.test(ua)) return "iOS";
  if (/mac/i.test(ua)) return "macOS";
  if (/win/i.test(ua)) return "Windows";
  if (/linux/i.test(ua)) return "Linux";
  return "Web";
}

function detectBrowser() {
  const ua = navigator.userAgent || "";
  if (/edg/i.test(ua)) return "Edge";
  if (/chrome|crios/i.test(ua) && !/edg/i.test(ua)) return "Chrome";
  if (/firefox|fxios/i.test(ua)) return "Firefox";
  if (/safari/i.test(ua) && !/chrome|crios/i.test(ua)) return "Safari";
  return "Browser";
}

/**
 * Register / heartbeat current device
 */
export async function registerCurrentDevice() {
  const me = auth.currentUser;
  if (!me) return null;

  const deviceId = getDeviceId();
  const ref = db
    .collection("userDevices")
    .doc(me.uid)
    .collection("devices")
    .doc(deviceId);

  const payload = {
    deviceId,
    platform: detectPlatform(),
    browser: detectBrowser(),
    userAgent: (navigator.userAgent || "").slice(0, 240),
    lastActive: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
    current: true,
  };

  await ref.set(payload, { merge: true });
  return deviceId;
}

/**
 * List devices for current user
 */
export async function listDevices() {
  const me = auth.currentUser;
  if (!me) return [];

  const snap = await db
    .collection("userDevices")
    .doc(me.uid)
    .collection("devices")
    .orderBy("lastActive", "desc")
    .limit(30)
    .get();

  const list = [];
  snap.forEach((doc) => list.push({ id: doc.id, ...doc.data() }));
  return list;
}

/**
 * Remove a device session (not self — or allow self = logout elsewhere)
 */
export async function removeDevice(deviceId) {
  const me = auth.currentUser;
  if (!me) throw new Error("Not authenticated");
  if (!deviceId) throw new Error("Missing device id");

  await db
    .collection("userDevices")
    .doc(me.uid)
    .collection("devices")
    .doc(deviceId)
    .delete();
}

/**
 * Remove all other devices
 */
export async function removeOtherDevices() {
  const me = auth.currentUser;
  if (!me) throw new Error("Not authenticated");

  const currentId = getDeviceId();
  const devices = await listDevices();
  const batch = db.batch();
  let count = 0;

  devices.forEach((d) => {
    if (d.id === currentId) return;
    const ref = db
      .collection("userDevices")
      .doc(me.uid)
      .collection("devices")
      .doc(d.id);
    batch.delete(ref);
    count += 1;
  });

  if (count > 0) await batch.commit();
  return count;
}

function formatLastActive(ts) {
  if (!ts) return "Unknown";
  const ms = ts.toMillis ? ts.toMillis() : ts;
  if (!ms) return "Unknown";
  const diff = Date.now() - ms;
  if (diff < 60_000) return "Active now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} hr ago`;
  return new Date(ms).toLocaleDateString();
}

function deviceIcon(platform) {
  const p = (platform || "").toLowerCase();
  if (p.includes("android") || p.includes("ios")) return "bi-phone";
  if (p.includes("mac") || p.includes("windows") || p.includes("linux"))
    return "bi-laptop";
  return "bi-globe";
}

/**
 * Settings subsection HTML
 */
export function devicesSectionHtml(devices, currentId) {
  const rows = (devices || [])
    .map((d) => {
      const isCurrent = d.id === currentId;
      const title = `${d.browser || "Browser"} · ${d.platform || "Web"}`;
      const sub = isCurrent ? "This device" : formatLastActive(d.lastActive);
      return `
        <div class="tg-row device-row" data-device-id="${escapeHtml(d.id)}">
          <i class="bi ${deviceIcon(d.platform)} tg-row__icon"></i>
          <div class="tg-row__body">
            <div class="tg-row__title">${escapeHtml(title)}</div>
            <div class="tg-row__sub">${escapeHtml(sub)}</div>
          </div>
          ${
            isCurrent
              ? `<span class="tg-row__value">Current</span>`
              : `<button type="button" class="btn btn--ghost btn--sm device-remove" data-remove="${escapeHtml(d.id)}" title="Remove">
                   <i class="bi bi-x-lg"></i>
                 </button>`
          }
        </div>
      `;
    })
    .join("");

  return `
    <div class="tg-section" data-section="devices">
      <div class="tg-section__label">Devices</div>
      <div id="device-list">
        ${rows || `<div class="tg-row"><div class="tg-row__body"><div class="tg-row__sub">No devices yet</div></div></div>`}
      </div>
      <button type="button" class="tg-row tg-row--btn" id="btn-terminate-others">
        <i class="bi bi-shield-x tg-row__icon"></i>
        <div class="tg-row__body">
          <div class="tg-row__title">Terminate all other sessions</div>
          <div class="tg-row__sub">Log out from every device except this one</div>
        </div>
      </button>
    </div>
  `;
}

/**
 * Bind device list actions inside settings root
 */
export function bindDeviceControls(root) {
  if (!root) return;

  root.querySelectorAll("[data-remove]").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const id = btn.getAttribute("data-remove");
      if (!id || !confirm("Remove this device session?")) return;
      try {
        await removeDevice(id);
        btn.closest(".device-row")?.remove();
        showToast("Device removed");
      } catch (err) {
        showToast(err.message || "Could not remove device");
      }
    });
  });

  root.querySelector("#btn-terminate-others")?.addEventListener("click", async () => {
    if (!confirm("Log out from all other devices?")) return;
    try {
      const n = await removeOtherDevices();
      showToast(n ? `Removed ${n} session(s)` : "No other sessions");
      // re-paint list
      const list = root.querySelector("#device-list");
      if (list) {
        const devices = await listDevices();
        const currentId = getDeviceId();
        const tmp = document.createElement("div");
        tmp.innerHTML = devicesSectionHtml(devices, currentId);
        const next = tmp.querySelector("#device-list");
        if (next) list.innerHTML = next.innerHTML;
        bindDeviceControls(root);
      }
    } catch (err) {
      showToast(err.message || "Failed");
    }
  });
}

/**
 * Full page (optional route #devices)
 */
export async function renderDevices() {
  const root = document.getElementById("page-root");
  if (!root) return () => {};

  const isDesktop = window.matchMedia("(min-width: 900px)").matches;

  root.innerHTML = `
    <header class="app-header">
      ${
        !isDesktop
          ? `<button type="button" class="btn btn--icon btn--ghost" id="btn-devices-back" aria-label="Back">
               <i class="bi bi-arrow-left" style="font-size:1.25rem"></i>
             </button>`
          : ""
      }
      <h1 class="app-header__title">Devices</h1>
    </header>
    <div class="page__scroll">
      <div class="empty-state" id="devices-loading">
        <div class="empty-state__title">Loading devices…</div>
      </div>
      <div id="devices-host" hidden></div>
    </div>
  `;

  root.querySelector("#btn-devices-back")?.addEventListener("click", () => {
    navigate("settings");
  });

  try {
    await registerCurrentDevice();
    const devices = await listDevices();
    const host = root.querySelector("#devices-host");
    const loading = root.querySelector("#devices-loading");
    if (loading) loading.hidden = true;
    if (host) {
      host.hidden = false;
      host.innerHTML = devicesSectionHtml(devices, getDeviceId());
      bindDeviceControls(host);
    }
  } catch (err) {
    console.error(err);
    showToast("Could not load devices");
  }

  return () => {
    root.innerHTML = "";
  };
}

export default {
  getDeviceId,
  registerCurrentDevice,
  listDevices,
  removeDevice,
  removeOtherDevices,
  devicesSectionHtml,
  bindDeviceControls,
  renderDevices,
};