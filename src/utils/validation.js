/**
 * Validation helpers
 */

export function normalizeUsername(raw) {
  return (raw || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 32);
}

export function isValidUsername(username) {
  return /^[a-z0-9_]{3,32}$/.test(username);
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || "");
}

export function isValidPassword(password) {
  return typeof password === "string" && password.length >= 8;
}

export function isValidDisplayName(name) {
  const t = (name || "").trim();
  return t.length >= 1 && t.length <= 40;
}

export default {
  normalizeUsername,
  isValidUsername,
  isValidEmail,
  isValidPassword,
  isValidDisplayName,
};