/**
 * Permissions utilities
 * - Browser: notification, camera, microphone, geolocation
 * - App privacy field visibility (lastSeen, photo, etc.)
 */

import { getState } from "../core/state.js";

/* ─────────────────────────── Browser permissions ─────────────────────────── */

/**
 * @returns {"granted"|"denied"|"prompt"|"unsupported"}
 */
export async function queryPermission(name) {
  if (!navigator.permissions?.query) {
    // Fallback hints
    if (name === "notifications" && "Notification" in window) {
      const p = Notification.permission;
      if (p === "default") return "prompt";
      return p; // granted | denied
    }
    return "unsupported";
  }
  try {
    const status = await navigator.permissions.query({ name });
    return status.state; // granted | denied | prompt
  } catch {
    return "unsupported";
  }
}

export function getNotificationPermission() {
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission; // granted | denied | default
}

/**
 * Request browser notification permission
 * @returns {Promise<"granted"|"denied"|"default"|"unsupported">}
 */
export async function requestNotificationPermission() {
  if (!("Notification" in window)) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

/**
 * Camera + microphone via getUserMedia (WebRTC prep)
 * @param {{ video?: boolean, audio?: boolean }} opts
 * @returns {Promise<MediaStream>}
 */
export async function requestMediaStream(opts = { video: true, audio: true }) {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Media devices not supported in this browser");
  }
  return navigator.mediaDevices.getUserMedia({
    video: opts.video ?? false,
    audio: opts.audio ?? false,
  });
}

export async function requestMicrophone() {
  return requestMediaStream({ video: false, audio: true });
}

export async function requestCamera() {
  return requestMediaStream({ video: true, audio: false });
}

/**
 * Stop all tracks on a stream
 * @param {MediaStream|null} stream
 */
export function stopMediaStream(stream) {
  if (!stream) return;
  stream.getTracks().forEach((t) => {
    try {
      t.stop();
    } catch (_) {}
  });
}

/**
 * Geolocation (optional features)
 * @returns {Promise<GeolocationPosition>}
 */
export function requestGeolocation(options = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation not supported"));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 60_000,
      ...options,
    });
  });
}

/**
 * Snapshot of common browser permission states
 */
export async function getPermissionsSummary() {
  const [notifications, camera, microphone] = await Promise.all([
    queryPermission("notifications"),
    queryPermission("camera"),
    queryPermission("microphone"),
  ]);
  return {
    notifications:
      notifications === "unsupported"
        ? getNotificationPermission()
        : notifications,
    camera,
    microphone,
  };
}

/* ─────────────────────────── App privacy rules ─────────────────────────── */

export const PRIVACY_DEFAULTS = {
  lastSeen: "contacts",
  online: "contacts",
  photo: "everyone",
  bio: "everyone",
  phone: "nobody",
  email: "nobody",
  readReceipts: true,
  inviteToGroups: "everyone",
};

/**
 * Whether viewer can see a privacy-controlled field
 * @param {object|null} targetPrivacy - userSettings.privacy of target
 * @param {string} field - lastSeen | online | photo | bio | phone | email
 * @param {{ isSelf?: boolean, isContact?: boolean }} ctx
 */
export function canViewField(targetPrivacy, field, ctx = {}) {
  if (ctx.isSelf) return true;
  const rule =
    (targetPrivacy && targetPrivacy[field]) ||
    PRIVACY_DEFAULTS[field] ||
    "nobody";
  if (rule === "everyone") return true;
  if (rule === "contacts") return !!ctx.isContact;
  return false; // nobody
}

/**
 * Read receipts: both sides typically need it enabled to show ticks
 * @param {object|null} myPrivacy
 * @param {object|null} theirPrivacy
 */
export function shouldShowReadReceipts(myPrivacy, theirPrivacy) {
  const mine =
    myPrivacy?.readReceipts !== undefined
      ? !!myPrivacy.readReceipts
      : PRIVACY_DEFAULTS.readReceipts;
  const theirs =
    theirPrivacy?.readReceipts !== undefined
      ? !!theirPrivacy.readReceipts
      : PRIVACY_DEFAULTS.readReceipts;
  return mine && theirs;
}

/**
 * Who can add me to groups
 */
export function canInviteToGroup(targetPrivacy, ctx = {}) {
  return canViewField(
    { inviteToGroups: targetPrivacy?.inviteToGroups },
    "inviteToGroups",
    ctx
  );
}

/**
 * Convenience: current user's privacy from store
 */
export function getMyPrivacy() {
  return {
    ...PRIVACY_DEFAULTS,
    ...(getState().settings?.privacy || {}),
  };
}

/**
 * Filter public profile fields for a viewer
 * @param {object} profile - users/{uid} doc
 * @param {object|null} privacy - their privacy map
 * @param {{ isSelf?: boolean, isContact?: boolean }} ctx
 */
export function filterProfileForViewer(profile, privacy, ctx = {}) {
  if (!profile) return null;
  if (ctx.isSelf) return { ...profile };

  const out = {
    uid: profile.uid,
    displayName: profile.displayName || "User",
    username: profile.username || null,
  };

  if (canViewField(privacy, "photo", ctx)) {
    out.photoURL = profile.photoURL || null;
  }
  if (canViewField(privacy, "bio", ctx)) {
    out.bio = profile.bio || "";
  }
  // phone/email live in privateUsers — never expose from public profile
  return out;
}

/* ─────────────────────────── Auth gate helpers ─────────────────────────── */

export function requireAuth() {
  const { user } = getState();
  if (!user) throw new Error("Not authenticated");
  return user;
}

export function requireOnboarding() {
  const { user, onboardingComplete } = getState();
  if (!user) throw new Error("Not authenticated");
  if (!onboardingComplete) throw new Error("Onboarding incomplete");
  return user;
}

export default {
  queryPermission,
  getNotificationPermission,
  requestNotificationPermission,
  requestMediaStream,
  requestMicrophone,
  requestCamera,
  stopMediaStream,
  requestGeolocation,
  getPermissionsSummary,
  PRIVACY_DEFAULTS,
  canViewField,
  shouldShowReadReceipts,
  canInviteToGroup,
  getMyPrivacy,
  filterProfileForViewer,
  requireAuth,
  requireOnboarding,
};