/**
 * Authentication core — listeners, profile load, email/Google/phone, onboarding, signOut
 *
 * UI should call these functions; pair with auth-ui.js
 * login.js / register.js can re-export thinner wrappers if needed
 */

import { auth, db } from "../config/firebase.js";
import { setState, getState, resetState } from "../core/state.js";
import { showToast } from "../components/toast.js";
import {
  normalizeUsername,
  isValidUsername,
  isValidEmail,
  isValidPassword,
  isValidDisplayName,
} from "../utils/validation.js";

const FieldValue = firebase.firestore.FieldValue;

/* ── Phone OTP state ─────────────────────────────────────── */
let recaptchaVerifier = null;
let confirmationResult = null;

/* ═══════════════════════════════════════════════════════════
   AUTH STATE LISTENER
═══════════════════════════════════════════════════════════ */

/**
 * @param {(user: firebase.User|null) => void} onChange
 */
export function initAuthListeners(onChange) {
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      try {
        await loadUserData(user.uid);
      } catch (err) {
        console.error("Failed to load user data:", err);
        showToast("Could not load profile");
      }
    } else {
      setState({
        user: null,
        profile: null,
        privateProfile: null,
        settings: null,
        onboardingComplete: false,
      });
    }

    if (typeof onChange === "function") {
      try {
        await onChange(user);
      } catch (err) {
        console.error("auth onChange error:", err);
      }
    }
  });
}

/* ═══════════════════════════════════════════════════════════
   LOAD PROFILE / SETTINGS INTO STATE
═══════════════════════════════════════════════════════════ */

/**
 * @param {string} uid
 */
export async function loadUserData(uid) {
  if (!uid) {
    setState({
      profile: null,
      privateProfile: null,
      settings: null,
      onboardingComplete: false,
    });
    return {
      profile: null,
      privateProfile: null,
      settings: null,
      onboardingComplete: false,
    };
  }

  const [profileSnap, privateSnap, settingsSnap] = await Promise.all([
    db.collection("users").doc(uid).get(),
    db.collection("privateUsers").doc(uid).get(),
    db.collection("userSettings").doc(uid).get(),
  ]);

  const profile = profileSnap.exists ? profileSnap.data() : null;
  const privateProfile = privateSnap.exists ? privateSnap.data() : null;
  const settings = settingsSnap.exists ? settingsSnap.data() : null;

  const onboardingComplete = !!(
    profile &&
    profile.username &&
    profile.displayName
  );

  setState({
    profile,
    privateProfile,
    settings,
    onboardingComplete,
  });

  return { profile, privateProfile, settings, onboardingComplete };
}

/* ═══════════════════════════════════════════════════════════
   BOOTSTRAP PRIVATE + SETTINGS (idempotent)
═══════════════════════════════════════════════════════════ */

async function ensurePrivateAndSettings(uid, extra = {}) {
  const privateRef = db.collection("privateUsers").doc(uid);
  const settingsRef = db.collection("userSettings").doc(uid);

  const [privateSnap, settingsSnap] = await Promise.all([
    privateRef.get(),
    settingsRef.get(),
  ]);

  if (!privateSnap.exists) {
    await privateRef.set({
      email: extra.email || null,
      phone: extra.phone || null,
      createdAt: FieldValue.serverTimestamp(),
    });
  } else {
    // Fill missing contact fields without overwriting
    const patch = {};
    const data = privateSnap.data() || {};
    if (!data.email && extra.email) patch.email = extra.email;
    if (!data.phone && extra.phone) patch.phone = extra.phone;
    if (Object.keys(patch).length) {
      await privateRef.set(patch, { merge: true });
    }
  }

  if (!settingsSnap.exists) {
    await settingsRef.set({
      privacy: {
        photo: "everyone",
        lastSeen: "contacts",
        online: "contacts",
        readReceipts: true,
        phone: "nobody",
        email: "nobody",
        bio: "everyone",
      },
      notifications: {
        messages: true,
        calls: true,
        preview: true,
        sound: true,
      },
      theme: "system",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
}

/* ═══════════════════════════════════════════════════════════
   AUTH ERROR MESSAGES
═══════════════════════════════════════════════════════════ */

export function mapAuthError(err) {
  const code = err?.code || "";
  const map = {
    "auth/invalid-email": "Invalid email address",
    "auth/user-disabled": "This account has been disabled",
    "auth/user-not-found": "No account found with this email",
    "auth/wrong-password": "Incorrect password",
    "auth/invalid-credential": "Invalid email or password",
    "auth/email-already-in-use": "An account with this email already exists",
    "auth/weak-password": "Password is too weak (min 6 characters)",
    "auth/too-many-requests": "Too many attempts. Try again later",
    "auth/network-request-failed": "Network error. Check your connection",
    "auth/popup-closed-by-user": "Sign-in popup was closed",
    "auth/popup-blocked": "Popup blocked. Allow popups for this site",
    "auth/cancelled-popup-request": "Sign-in was cancelled",
    "auth/operation-not-allowed":
      "This sign-in method is disabled in Firebase Console",
    "auth/invalid-phone-number":
      "Invalid phone number. Use format +8801XXXXXXXXX",
    "auth/missing-phone-number": "Enter a phone number",
    "auth/quota-exceeded": "SMS quota exceeded. Try later",
    "auth/invalid-verification-code": "Invalid verification code",
    "auth/code-expired": "Code expired. Request a new one",
    "auth/captcha-check-failed": "reCAPTCHA failed. Refresh and try again",
    "permission-denied": "Permission denied. Check Firestore rules.",
  };
  return map[code] || err?.message || "Something went wrong";
}

/* ═══════════════════════════════════════════════════════════
   EMAIL
═══════════════════════════════════════════════════════════ */

/**
 * @param {string} email
 * @param {string} password
 * @returns {Promise<firebase.User>}
 */
export async function registerWithEmail(email, password) {
  const e = String(email || "").trim();
  const p = String(password || "");

  if (!isValidEmail(e)) throw new Error("Enter a valid email");
  if (!isValidPassword(p)) {
    throw new Error("Password must be at least 6 characters");
  }

  try {
    const cred = await auth.createUserWithEmailAndPassword(e, p);
    await ensurePrivateAndSettings(cred.user.uid, { email: e });
    return cred.user;
  } catch (err) {
    throw new Error(mapAuthError(err));
  }
}

/**
 * @param {string} email
 * @param {string} password
 * @returns {Promise<firebase.User>}
 */
export async function loginWithEmail(email, password) {
  const e = String(email || "").trim();
  const p = String(password || "");

  if (!isValidEmail(e)) throw new Error("Enter a valid email");
  if (!p) throw new Error("Enter your password");

  try {
    const cred = await auth.signInWithEmailAndPassword(e, p);
    return cred.user;
  } catch (err) {
    throw new Error(mapAuthError(err));
  }
}

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
   GOOGLE
═══════════════════════════════════════════════════════════ */

/**
 * @returns {Promise<firebase.User>}
 */
export async function loginWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  try {
    const cred = await auth.signInWithPopup(provider);
    await ensurePrivateAndSettings(cred.user.uid, {
      email: cred.user.email || null,
    });
    return cred.user;
  } catch (err) {
    if (err?.code === "auth/popup-blocked") {
      await auth.signInWithRedirect(provider);
      return null;
    }
    throw new Error(mapAuthError(err));
  }
}

/** Call on boot if redirect Google flow is used */
export async function completeGoogleRedirect() {
  try {
    const result = await auth.getRedirectResult();
    if (result?.user) {
      await ensurePrivateAndSettings(result.user.uid, {
        email: result.user.email || null,
      });
      return result.user;
    }
    return null;
  } catch (err) {
    console.warn("Google redirect:", err);
    return null;
  }
}

/* ═══════════════════════════════════════════════════════════
   PHONE OTP
═══════════════════════════════════════════════════════════ */

/**
 * Invisible reCAPTCHA bound to a button id
 * @param {string} [buttonId="btn-phone-send"]
 */
export function setupRecaptcha(buttonId = "btn-phone-send") {
  if (recaptchaVerifier) return recaptchaVerifier;

  recaptchaVerifier = new firebase.auth.RecaptchaVerifier(buttonId, {
    size: "invisible",
    callback: () => {},
    "expired-callback": () => {
      showToast("reCAPTCHA expired. Try again.");
    },
  });

  return recaptchaVerifier;
}

/**
 * @param {string} phoneE164 e.g. +8801712345678
 */
export async function sendPhoneOtp(phoneE164) {
  const phone = String(phoneE164 || "").replace(/[\s-]/g, "");
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
    throw new Error("Use international format, e.g. +8801XXXXXXXXX");
  }

  try {
    const appVerifier = setupRecaptcha("btn-phone-send");
    confirmationResult = await auth.signInWithPhoneNumber(phone, appVerifier);
    return true;
  } catch (err) {
    try {
      recaptchaVerifier?.clear();
    } catch (_) {}
    recaptchaVerifier = null;
    throw new Error(mapAuthError(err));
  }
}

/**
 * @param {string} code 6-digit
 * @returns {Promise<firebase.User>}
 */
export async function verifyPhoneOtp(code) {
  const c = String(code || "").trim();
  if (!/^\d{6}$/.test(c)) throw new Error("Enter the 6-digit code");
  if (!confirmationResult) throw new Error("Send OTP first");

  try {
    const cred = await confirmationResult.confirm(c);
    await ensurePrivateAndSettings(cred.user.uid, {
      phone: cred.user.phoneNumber || null,
    });
    confirmationResult = null;
    return cred.user;
  } catch (err) {
    throw new Error(mapAuthError(err));
  }
}

/* ═══════════════════════════════════════════════════════════
   ONBOARDING — username claim (transaction)
═══════════════════════════════════════════════════════════ */

/**
 * @param {{ displayName: string, username: string, bio?: string, photoURL?: string|null }} data
 */
export async function completeOnboarding({
  displayName,
  username,
  bio = "",
  photoURL = null,
}) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");

  const name = String(displayName || "").trim();
  if (!isValidDisplayName(name)) {
    throw new Error("Enter a display name (1–40 characters)");
  }

  const normalized = normalizeUsername(username);
  if (!isValidUsername(normalized)) {
    throw new Error(
      "Username must be 3–32 characters: a–z, 0–9, underscore only"
    );
  }

  const usernameRef = db.collection("usernames").doc(normalized);
  const userRef = db.collection("users").doc(user.uid);

  try {
    await db.runTransaction(async (tx) => {
      const existing = await tx.get(usernameRef);
      if (existing.exists && existing.data()?.uid !== user.uid) {
        throw new Error("Username is already taken");
      }

      // If user already had another username, delete old claim when possible
      const currentUserSnap = await tx.get(userRef);
      const oldUsername = currentUserSnap.exists
        ? currentUserSnap.data()?.username
        : null;
      if (oldUsername && oldUsername !== normalized) {
        const oldRef = db.collection("usernames").doc(oldUsername);
        const oldSnap = await tx.get(oldRef);
        if (oldSnap.exists && oldSnap.data()?.uid === user.uid) {
          tx.delete(oldRef);
        }
      }

      tx.set(usernameRef, {
        uid: user.uid,
        createdAt: FieldValue.serverTimestamp(),
      });

      tx.set(
        userRef,
        {
          displayName: name,
          username: normalized,
          photoURL: photoURL || user.photoURL || null,
          bio: String(bio || "").trim().slice(0, 160),
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });
  } catch (err) {
    console.error("Onboarding transaction failed:", err);
    if (err?.code === "permission-denied") {
      throw new Error(
        "Permission denied. Check Firestore rules for users + usernames."
      );
    }
    throw new Error(err?.message || mapAuthError(err));
  }

  await ensurePrivateAndSettings(user.uid, {
    email: user.email || null,
    phone: user.phoneNumber || null,
  });

  await loadUserData(user.uid);

  // Notify shell (optional — app.js may export refreshShell)
  try {
    const mod = await import("../core/app.js");
    if (typeof mod.refreshShell === "function") {
      mod.refreshShell();
    }
  } catch (_) {
    /* app may not export refreshShell — auth listener still updates UI */
  }

  showToast("Welcome to Nexus");
  return true;
}

/* ═══════════════════════════════════════════════════════════
   SIGN OUT
═══════════════════════════════════════════════════════════ */

export async function signOut() {
  try {
    await auth.signOut();
  } finally {
    confirmationResult = null;
    if (recaptchaVerifier) {
      try {
        recaptchaVerifier.clear();
      } catch (_) {}
      recaptchaVerifier = null;
    }

    // Full client reset (safer than partial nulling)
    try {
      resetState();
    } catch (_) {
      setState({
        user: null,
        profile: null,
        privateProfile: null,
        settings: null,
        onboardingComplete: false,
        conversations: {},
        conversationList: [],
        messages: {},
        messageOrder: {},
      });
    }
  }
}

/* ═══════════════════════════════════════════════════════════
   EXPORTS
═══════════════════════════════════════════════════════════ */

export default {
  initAuthListeners,
  loadUserData,
  mapAuthError,
  registerWithEmail,
  loginWithEmail,
  sendPasswordReset,
  loginWithGoogle,
  completeGoogleRedirect,
  setupRecaptcha,
  sendPhoneOtp,
  verifyPhoneOtp,
  completeOnboarding,
  signOut,
};