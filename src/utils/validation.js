/**
 * Validation helpers — auth, profile, messages
 */

/** Username: lowercase, a-z 0-9 _, length 3–32 */
export function normalizeUsername(raw) {
  return String(raw || "")
    .toLowerCase()
    .trim()
    .replace(/^@+/, "")
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 32);
}

export function isValidUsername(username) {
  return /^[a-z0-9_]{3,32}$/.test(String(username || ""));
}

export function isValidEmail(email) {
  const e = String(email || "").trim();
  // Practical check (not full RFC)
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length <= 254;
}

/** Min 8 chars (match Firebase-friendly policy) */
export function isValidPassword(password) {
  return typeof password === "string" && password.length >= 8 && password.length <= 128;
}

/** Stronger optional check */
export function isStrongPassword(password) {
  if (!isValidPassword(password)) return false;
  // at least 1 letter and 1 number
  return /[A-Za-z]/.test(password) && /[0-9]/.test(password);
}

export function isValidDisplayName(name) {
  const t = String(name || "").trim();
  return t.length >= 1 && t.length <= 40;
}

export function isValidBio(bio) {
  return String(bio || "").length <= 160;
}

/** E.164-ish or local digits (basic) */
export function normalizePhone(raw) {
  return String(raw || "").replace(/[^\d+]/g, "").slice(0, 16);
}

export function isValidPhone(phone) {
  const p = normalizePhone(phone);
  // + and 8–15 digits, or 10–15 digits without +
  return /^\+?\d{8,15}$/.test(p);
}

export function isValidMessageText(text, max = 4000) {
  const t = String(text || "").trim();
  return t.length >= 1 && t.length <= max;
}

export function isValidUrl(url) {
  try {
    const u = new URL(String(url || "").trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Return first error message or null if ok */
export function validateOnboarding({ displayName, username, bio }) {
  if (!isValidDisplayName(displayName)) {
    return "Enter a display name (1–40 characters)";
  }
  const u = normalizeUsername(username);
  if (!isValidUsername(u)) {
    return "Username must be 3–32 characters (a–z, 0–9, _)";
  }
  if (!isValidBio(bio)) {
    return "Bio must be at most 160 characters";
  }
  return null;
}

export default {
  normalizeUsername,
  isValidUsername,
  isValidEmail,
  isValidPassword,
  isStrongPassword,
  isValidDisplayName,
  isValidBio,
  normalizePhone,
  isValidPhone,
  isValidMessageText,
  isValidUrl,
  validateOnboarding,
};