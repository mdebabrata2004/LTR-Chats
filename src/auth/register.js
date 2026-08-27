/**
 * Register — create account (email/password, Google, phone)
 * After Auth user exists, onboarding (username/profile) is separate.
 */

import { auth, db } from "../config/firebase.js";
import { mapAuthError, isValidEmail, isValidPassword, isValidPhone } from "./login.js";
import {
  loginWithGoogle,
  sendPhoneCode,
  confirmPhoneCode,
  initRecaptcha,
  resetPhoneAuth,
} from "./login.js";

const FieldValue = firebase.firestore.FieldValue;

/* ═══════════════════════════════════════════════════════════
   VALIDATION
═══════════════════════════════════════════════════════════ */

export function isValidDisplayName(name) {
  const t = String(name || "").trim();
  return t.length >= 1 && t.length <= 40;
}

/**
 * Stronger password check for registration (min 8)
 */
export function isStrongPassword(password) {
  return typeof password === "string" && password.length >= 8;
}

/* ═══════════════════════════════════════════════════════════
   ERROR MAP (register-specific extras)
═══════════════════════════════════════════════════════════ */

function mapRegisterError(err) {
  const code = err?.code || "";
  if (code === "auth/email-already-in-use") {
    return "An account with this email already exists. Sign in instead.";
  }
  if (code === "auth/weak-password") {
    return "Password is too weak. Use at least 8 characters.";
  }
  if (code === "auth/operation-not-allowed") {
    return "Registration is disabled in Firebase Console.";
  }
  return mapAuthError(err);
}

/* ═══════════════════════════════════════════════════════════
   SEED PROFILE DOCS (minimal — onboarding fills username)
═══════════════════════════════════════════════════════════ */

/**
 * Create public + private skeleton if missing.
 * Does NOT claim username (that happens in onboarding).
 * @param {firebase.User} user
 * @param {{ displayName?: string }} [extra]
 */
export async function seedUserDocuments(user, extra = {}) {
  if (!user?.uid) return;

  const uid = user.uid;
  const userRef = db.collection("users").doc(uid);
  const privateRef = db.collection("privateUsers").doc(uid);
  const settingsRef = db.collection("userSettings").doc(uid);

  const snap = await userRef.get();
  if (!snap.exists) {
    await userRef.set(
      {
        displayName:
          extra.displayName ||
          user.displayName ||
          (user.email ? user.email.split("@")[0] : "User"),
        username: null,
        bio: "",
        photoURL: user.photoURL || null,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }

  const priv = await privateRef.get();
  if (!priv.exists) {
    await privateRef.set(
      {
        email: user.email || null,
        phone: user.phoneNumber || null,
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }

  const setSnap = await settingsRef.get();
  if (!setSnap.exists) {
    await settingsRef.set(
      {
        theme: "system",
        notifications: {
          enabled: true,
          messagePreview: true,
          sound: true,
        },
        privacy: {
          lastSeen: "everyone",
          profilePhoto: "everyone",
          about: "everyone",
        },
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }
}

/* ═══════════════════════════════════════════════════════════
   EMAIL + PASSWORD REGISTER
═══════════════════════════════════════════════════════════ */

/**
 * @param {{ email: string, password: string, displayName?: string }} data
 * @returns {Promise<firebase.User>}
 */
export async function registerWithEmail(data = {}) {
  const email = String(data.email || "").trim();
  const password = String(data.password || "");
  const displayName = String(data.displayName || "").trim();

  if (!isValidEmail(email)) throw new Error("Enter a valid email");
  if (!isStrongPassword(password)) {
    throw new Error("Password must be at least 8 characters");
  }
  if (displayName && !isValidDisplayName(displayName)) {
    throw new Error("Display name must be 1–40 characters");
  }

  try {
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    const user = cred.user;

    if (displayName) {
      try {
        await user.updateProfile({ displayName });
      } catch (_) {}
    }

    await seedUserDocuments(user, { displayName });
    return user;
  } catch (err) {
    throw new Error(mapRegisterError(err));
  }
}

/* ═══════════════════════════════════════════════════════════
   GOOGLE REGISTER (same as Google login — creates user if new)
═══════════════════════════════════════════════════════════ */

/**
 * @returns {Promise<firebase.User|null>}
 */
export async function registerWithGoogle() {
  try {
    const user = await loginWithGoogle();
    if (user) {
      await seedUserDocuments(user, {
        displayName: user.displayName || "",
      });
    }
    return user;
  } catch (err) {
    throw new Error(mapRegisterError(err));
  }
}

/* ═══════════════════════════════════════════════════════════
   PHONE REGISTER (OTP — same flow as login)
═══════════════════════════════════════════════════════════ */

/**
 * Send OTP for registration
 * @param {string} phoneE164
 * @param {string} [containerId]
 */
export async function registerPhoneSendCode(phoneE164, containerId) {
  if (!isValidPhone(String(phoneE164 || "").replace(/[\s-]/g, ""))) {
    throw new Error("Use international format, e.g. +8801XXXXXXXXX");
  }
  return sendPhoneCode(phoneE164, containerId);
}

/**
 * Confirm OTP and seed profile
 * @param {string} code
 * @param {{ displayName?: string }} [extra]
 * @returns {Promise<firebase.User>}
 */
export async function registerPhoneConfirm(code, extra = {}) {
  const user = await confirmPhoneCode(code);
  await seedUserDocuments(user, {
    displayName: extra.displayName || "",
  });
  return user;
}

/* ═══════════════════════════════════════════════════════════
   UNIFIED
═══════════════════════════════════════════════════════════ */

/**
 * @param {"email"|"google"|"phone-send"|"phone-confirm"} method
 * @param {object} payload
 */
export async function register(method, payload = {}) {
  switch (method) {
    case "email":
      return registerWithEmail(payload);
    case "google":
      return registerWithGoogle();
    case "phone-send":
      return registerPhoneSendCode(payload.phone, payload.containerId);
    case "phone-confirm":
      return registerPhoneConfirm(payload.code, {
        displayName: payload.displayName,
      });
    default:
      throw new Error("Unknown register method");
  }
}

export {
  initRecaptcha,
  resetPhoneAuth,
  isValidEmail,
  isValidPassword,
  isValidPhone,
};

export default {
  isValidDisplayName,
  isStrongPassword,
  seedUserDocuments,
  registerWithEmail,
  registerWithGoogle,
  registerPhoneSendCode,
  registerPhoneConfirm,
  register,
  initRecaptcha,
  resetPhoneAuth,
};