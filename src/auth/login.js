/**
 * Login — email/password, Google, phone (OTP)
 * UI-agnostic; pair with auth-ui.js
 */

import { auth } from "../config/firebase.js";
import { showToast } from "../components/toast.js";

const GoogleAuthProvider = firebase.auth.GoogleAuthProvider;
const PhoneAuthProvider = firebase.auth.PhoneAuthProvider;
const RecaptchaVerifier = firebase.auth.RecaptchaVerifier;

/** @type {firebase.auth.RecaptchaVerifier|null} */
let recaptchaVerifier = null;
/** @type {string|null} */
let phoneConfirmationResult = null;

/* ═══════════════════════════════════════════════════════════
   VALIDATION
═══════════════════════════════════════════════════════════ */

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

export function isValidPassword(password) {
  return typeof password === "string" && password.length >= 6;
}

/**
 * Basic E.164-ish check (+ and digits)
 */
export function isValidPhone(phone) {
  const p = String(phone || "").replace(/[\s-]/g, "");
  return /^\+[1-9]\d{7,14}$/.test(p);
}

/* ═══════════════════════════════════════════════════════════
   ERROR MAPPING
═══════════════════════════════════════════════════════════ */

export function mapAuthError(err) {
  const code = err?.code || "";
  const map = {
    "auth/invalid-email": "Invalid email address",
    "auth/user-disabled": "This account has been disabled",
    "auth/user-not-found": "No account found with this email",
    "auth/wrong-password": "Incorrect password",
    "auth/invalid-credential": "Invalid email or password",
    "auth/too-many-requests": "Too many attempts. Try again later",
    "auth/network-request-failed": "Network error. Check your connection",
    "auth/popup-closed-by-user": "Sign-in popup was closed",
    "auth/cancelled-popup-request": "Sign-in was cancelled",
    "auth/popup-blocked": "Popup blocked. Allow popups for this site",
    "auth/account-exists-with-different-credential":
      "An account already exists with a different sign-in method",
    "auth/invalid-phone-number": "Invalid phone number. Use format +8801XXXXXXXXX",
    "auth/missing-phone-number": "Enter a phone number",
    "auth/quota-exceeded": "SMS quota exceeded. Try later",
    "auth/invalid-verification-code": "Invalid verification code",
    "auth/code-expired": "Code expired. Request a new one",
    "auth/missing-verification-code": "Enter the verification code",
    "auth/captcha-check-failed": "reCAPTCHA failed. Refresh and try again",
    "auth/operation-not-allowed": "This sign-in method is disabled in Firebase Console",
  };
  return map[code] || err?.message || "Sign-in failed";
}

/* ═══════════════════════════════════════════════════════════
   EMAIL + PASSWORD
═══════════════════════════════════════════════════════════ */

/**
 * @param {string} email
 * @param {string} password
 * @returns {Promise<firebase.User>}
 */
export async function loginWithEmail(email, password) {
  const e = String(email || "").trim();
  const p = String(password || "");

  if (!isValidEmail(e)) throw new Error("Enter a valid email");
  if (!isValidPassword(p)) throw new Error("Password must be at least 6 characters");

  try {
    const cred = await auth.signInWithEmailAndPassword(e, p);
    return cred.user;
  } catch (err) {
    throw new Error(mapAuthError(err));
  }
}

/* ═══════════════════════════════════════════════════════════
   GOOGLE
═══════════════════════════════════════════════════════════ */

/**
 * @returns {Promise<firebase.User>}
 */
export async function loginWithGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  try {
    const cred = await auth.signInWithPopup(provider);
    return cred.user;
  } catch (err) {
    // Fallback for browsers that block popups
    if (err?.code === "auth/popup-blocked") {
      await auth.signInWithRedirect(provider);
      return null;
    }
    throw new Error(mapAuthError(err));
  }
}

/**
 * Call once on app boot if using redirect Google sign-in
 */
export async function completeGoogleRedirect() {
  try {
    const result = await auth.getRedirectResult();
    return result?.user || null;
  } catch (err) {
    console.warn("Google redirect:", err);
    return null;
  }
}

/* ═══════════════════════════════════════════════════════════
   PHONE — reCAPTCHA + OTP
═══════════════════════════════════════════════════════════ */

/**
 * Create invisible reCAPTCHA bound to a container element id
 * @param {string} containerId — e.g. "recaptcha-container"
 */
export function initRecaptcha(containerId = "recaptcha-container") {
  if (recaptchaVerifier) {
    try {
      recaptchaVerifier.clear();
    } catch (_) {}
    recaptchaVerifier = null;
  }

  let el = document.getElementById(containerId);
  if (!el) {
    el = document.createElement("div");
    el.id = containerId;
    document.body.appendChild(el);
  }

  recaptchaVerifier = new RecaptchaVerifier(
    containerId,
    {
      size: "invisible",
      callback: () => {},
      "expired-callback": () => {
        showToast("reCAPTCHA expired. Try again");
      },
    },
    auth
  );

  return recaptchaVerifier;
}

/**
 * Send SMS code
 * @param {string} phoneE164 — e.g. +8801712345678
 * @param {string} [containerId]
 * @returns {Promise<void>}
 */
export async function sendPhoneCode(phoneE164, containerId = "recaptcha-container") {
  const phone = String(phoneE164 || "").replace(/[\s-]/g, "");
  if (!isValidPhone(phone)) {
    throw new Error("Use international format, e.g. +8801XXXXXXXXX");
  }

  if (!recaptchaVerifier) {
    initRecaptcha(containerId);
  }

  try {
    phoneConfirmationResult = await auth.signInWithPhoneNumber(
      phone,
      recaptchaVerifier
    );
  } catch (err) {
    try {
      recaptchaVerifier?.clear();
    } catch (_) {}
    recaptchaVerifier = null;
    throw new Error(mapAuthError(err));
  }
}

/**
 * Confirm SMS code
 * @param {string} code — 6 digit
 * @returns {Promise<firebase.User>}
 */
export async function confirmPhoneCode(code) {
  const c = String(code || "").trim();
  if (!/^\d{6}$/.test(c)) {
    throw new Error("Enter the 6-digit code");
  }
  if (!phoneConfirmationResult) {
    throw new Error("Request a code first");
  }

  try {
    const cred = await phoneConfirmationResult.confirm(c);
    phoneConfirmationResult = null;
    return cred.user;
  } catch (err) {
    throw new Error(mapAuthError(err));
  }
}

export function resetPhoneAuth() {
  phoneConfirmationResult = null;
  try {
    recaptchaVerifier?.clear();
  } catch (_) {}
  recaptchaVerifier = null;
}

/* ═══════════════════════════════════════════════════════════
   PASSWORD RESET
═══════════════════════════════════════════════════════════ */

/**
 * @param {string} email
 */
export async function sendPasswordReset(email) {
  const e = String(email || "").trim();
  if (!isValidEmail(e)) throw new Error("Enter a valid email");

  try {
    await auth.sendPasswordResetEmail(e);
  } catch (err) {
    throw new Error(mapAuthError(err));
  }
}

/* ═══════════════════════════════════════════════════════════
   UNIFIED HANDLER (optional convenience)
═══════════════════════════════════════════════════════════ */

/**
 * @param {"email"|"google"|"phone-send"|"phone-confirm"|"reset"} method
 * @param {object} payload
 */
export async function login(method, payload = {}) {
  switch (method) {
    case "email":
      return loginWithEmail(payload.email, payload.password);
    case "google":
      return loginWithGoogle();
    case "phone-send":
      return sendPhoneCode(payload.phone, payload.containerId);
    case "phone-confirm":
      return confirmPhoneCode(payload.code);
    case "reset":
      return sendPasswordReset(payload.email);
    default:
      throw new Error("Unknown login method");
  }
}

export default {
  isValidEmail,
  isValidPassword,
  isValidPhone,
  mapAuthError,
  loginWithEmail,
  loginWithGoogle,
  completeGoogleRedirect,
  initRecaptcha,
  sendPhoneCode,
  confirmPhoneCode,
  resetPhoneAuth,
  sendPasswordReset,
  login,
};