/**
 * Date / time helpers for chat UI
 */

/**
 * @param {firebase.firestore.Timestamp|Date|number|null} ts
 * @returns {number|null} ms
 */
export function toMillis(ts) {
  if (ts == null) return null;
  if (typeof ts === "number") return ts;
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts.toMillis === "function") return ts.toMillis();
  if (typeof ts.seconds === "number") return ts.seconds * 1000;
  return null;
}

/**
 * Message bubble / list time label (WhatsApp-style)
 */
export function formatMessageTime(ts) {
  const ms = toMillis(ts);
  if (ms == null) return "";

  const d = new Date(ms);
  const now = new Date();

  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();

  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  if (sameDay) return time;
  if (isYesterday) return "Yesterday";

  const weekAgo = now.getTime() - 6 * 24 * 60 * 60 * 1000;
  if (ms >= weekAgo) {
    return d.toLocaleDateString([], { weekday: "short" });
  }

  if (d.getFullYear() === now.getFullYear()) {
    return d.toLocaleDateString([], { day: "numeric", month: "short" });
  }

  return d.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Delete-for-everyone window (24h)
 */
export function isWithin24Hours(ts) {
  const ms = toMillis(ts);
  if (ms == null) return false;
  return Date.now() - ms <= 24 * 60 * 60 * 1000;
}

/**
 * Relative short label
 */
export function formatRelative(ts) {
  const ms = toMillis(ts);
  if (ms == null) return "";
  const diff = Date.now() - ms;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return formatMessageTime(ts);
}

export default {
  toMillis,
  formatMessageTime,
  isWithin24Hours,
  formatRelative,
};