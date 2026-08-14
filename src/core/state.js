/**
 * Lightweight observable store for Nexus Chat
 * Auth · theme · drafts · presence · typing · conversations cache
 */

const listeners = new Set();

const THEME_KEY = "nexus-theme";
const DRAFTS_KEY = "nexus-drafts";

function loadDrafts() {
  try {
    return JSON.parse(localStorage.getItem(DRAFTS_KEY) || "{}");
  } catch {
    return {};
  }
}

function loadTheme() {
  return localStorage.getItem(THEME_KEY) || "system";
}

const initialState = {
  // Auth
  user: null,
  profile: null,
  privateProfile: null,
  settings: null,
  onboardingComplete: false,

  // Connection
  connectionStatus: "online", // online | connecting | offline

  // Theme: light | dark | system
  theme: loadTheme(),

  // Navigation
  currentRoute: "chats",
  activeConversationId: null,

  // Caches
  conversations: {},
  conversationList: [],
  messages: {},
  messageOrder: {},
  users: {},
  contacts: {},
  typing: {},
  presence: {},

  // UI
  isLoading: true,
  toasts: [],
  activeCall: null,
  drafts: loadDrafts(),

  // Preferences (mirrored from userSettings when loaded)
  mutedConversations: JSON.parse(localStorage.getItem("nexus-muted") || "{}"),
  pinnedConversations: JSON.parse(localStorage.getItem("nexus-pinned") || "[]"),
};

let state = { ...initialState };

/* ──────────────────────────────────────────────
   Core
────────────────────────────────────────────── */

export function getState() {
  return state;
}

export function setState(partial) {
  state = { ...state, ...partial };
  listeners.forEach((fn) => {
    try {
      fn(state);
    } catch (e) {
      console.error("State listener error:", e);
    }
  });
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Nested path update: updateState("presence.uid123", { online: true }) */
export function updateState(path, value) {
  const keys = path.split(".");
  const next = { ...state };
  let cursor = next;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    cursor[k] = { ...(cursor[k] || {}) };
    cursor = cursor[k];
  }
  cursor[keys[keys.length - 1]] = value;
  state = next;
  listeners.forEach((fn) => {
    try {
      fn(state);
    } catch (e) {
      console.error("State listener error:", e);
    }
  });
}

/* ──────────────────────────────────────────────
   Drafts
────────────────────────────────────────────── */

export function setDraft(conversationId, text) {
  const drafts = { ...state.drafts };
  if (text && text.trim()) {
    drafts[conversationId] = text;
  } else {
    delete drafts[conversationId];
  }
  try {
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
  } catch (_) {}
  setState({ drafts });
}

export function getDraft(conversationId) {
  return state.drafts[conversationId] || "";
}

export function clearDraft(conversationId) {
  setDraft(conversationId, "");
}

/* ──────────────────────────────────────────────
   Theme
────────────────────────────────────────────── */

function resolveTheme(theme) {
  if (theme === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return theme;
}

export function applyTheme(theme) {
  const root = document.documentElement;
  const resolved = resolveTheme(theme);
  root.setAttribute("data-theme", resolved);
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch (_) {}
  setState({ theme });
}

export function getResolvedTheme() {
  return resolveTheme(state.theme);
}

// React to OS theme changes when mode is "system"
try {
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", () => {
      if (state.theme === "system") applyTheme("system");
    });
} catch (_) {}

// Apply on load
applyTheme(state.theme);

/* ──────────────────────────────────────────────
   User profile cache
────────────────────────────────────────────── */

export function cacheUser(uid, profile) {
  if (!uid || !profile) return;
  setState({
    users: { ...state.users, [uid]: { ...profile, uid } },
  });
}

export function getCachedUser(uid) {
  return state.users[uid] || null;
}

/* ──────────────────────────────────────────────
   Conversations helpers
────────────────────────────────────────────── */

export function setConversations(list) {
  const map = {};
  const ids = [];
  (list || []).forEach((c) => {
    map[c.id] = c;
    ids.push(c.id);
  });
  setState({ conversations: map, conversationList: ids });
}

export function getConversation(cid) {
  return state.conversations[cid] || null;
}

/* ──────────────────────────────────────────────
   Pin / Mute (local + ready for cloud sync)
────────────────────────────────────────────── */

export function togglePin(cid) {
  let pinned = [...(state.pinnedConversations || [])];
  if (pinned.includes(cid)) {
    pinned = pinned.filter((id) => id !== cid);
  } else {
    pinned.unshift(cid);
  }
  try {
    localStorage.setItem("nexus-pinned", JSON.stringify(pinned));
  } catch (_) {}
  setState({ pinnedConversations: pinned });
  return pinned.includes(cid);
}

export function isPinned(cid) {
  return (state.pinnedConversations || []).includes(cid);
}

export function toggleMute(cid) {
  const muted = { ...(state.mutedConversations || {}) };
  if (muted[cid]) {
    delete muted[cid];
  } else {
    muted[cid] = true;
  }
  try {
    localStorage.setItem("nexus-muted", JSON.stringify(muted));
  } catch (_) {}
  setState({ mutedConversations: muted });
  return !!muted[cid];
}

export function isMuted(cid) {
  return !!(state.mutedConversations || {})[cid];
}

/* ──────────────────────────────────────────────
   Typing indicators (in-memory; RTDB can drive this)
────────────────────────────────────────────── */

export function setTyping(cid, uid, isTyping) {
  const typing = { ...(state.typing || {}) };
  const room = { ...(typing[cid] || {}) };
  if (isTyping) {
    room[uid] = Date.now();
  } else {
    delete room[uid];
  }
  if (Object.keys(room).length === 0) {
    delete typing[cid];
  } else {
    typing[cid] = room;
  }
  setState({ typing });
}

export function getTypingUids(cid) {
  const room = state.typing[cid] || {};
  const now = Date.now();
  return Object.entries(room)
    .filter(([, ts]) => now - ts < 6000)
    .map(([uid]) => uid);
}

/* ──────────────────────────────────────────────
   Presence
────────────────────────────────────────────── */

export function setPresence(uid, data) {
  setState({
    presence: {
      ...state.presence,
      [uid]: { ...(state.presence[uid] || {}), ...data },
    },
  });
}

export function getPresence(uid) {
  return state.presence[uid] || null;
}

/* ──────────────────────────────────────────────
   Reset on logout
────────────────────────────────────────────── */

export function resetState() {
  const theme = state.theme;
  const drafts = {};
  state = {
    ...initialState,
    theme,
    drafts,
    isLoading: false,
    connectionStatus: navigator.onLine ? "online" : "offline",
  };
  try {
    localStorage.setItem(DRAFTS_KEY, "{}");
  } catch (_) {}
  listeners.forEach((fn) => {
    try {
      fn(state);
    } catch (_) {}
  });
  applyTheme(theme);
}

/* ──────────────────────────────────────────────
   Default export
────────────────────────────────────────────── */

export default {
  getState,
  setState,
  subscribe,
  updateState,
  setDraft,
  getDraft,
  clearDraft,
  applyTheme,
  getResolvedTheme,
  cacheUser,
  getCachedUser,
  setConversations,
  getConversation,
  togglePin,
  isPinned,
  toggleMute,
  isMuted,
  setTyping,
  getTypingUids,
  setPresence,
  getPresence,
  resetState,
};