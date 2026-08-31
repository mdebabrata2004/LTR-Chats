/**
 * Authentication core — listeners, profile, email/Google/phone, onboarding, signOut
 * Pair with auth-ui.js
 */

import { auth, db } from "../config/firebase.js";
import { setState, resetState } from "../core/state.js";
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
   LOAD PROFILE / SETTINGS
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
   PRIVATE + SETTINGS BOOTSTRAP
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
   ERROR MESSAGES
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
    "auth/invalid-app-credential":
      "Phone verification failed. Complete the reCAPTCHA and try again.",
    "auth/invalid-app-verifier":
      "reCAPTCHA invalid. Close the popup and try again.",
    "auth/missing-app-credential":
      "reCAPTCHA missing. Wait for it to load, then send again.",
    "permission-denied": "Permission denied. Check Firestore rules.",
  };
  return map[code] || err?.message || "Something went wrong";
}

/* ═══════════════════════════════════════════════════════════
   EMAIL
═══════════════════════════════════════════════════════════ */

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

export async function loginWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  provider.addScope("email");
  provider.addScope("profile");

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
    if (err?.code === "auth/popup-closed-by-user") {
      throw new Error(mapAuthError(err));
    }
    throw new Error(mapAuthError(err));
  }
}

/** Call once on boot if Google redirect was used */
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

let recaptchaReady = false;

export function resetRecaptcha() {
  recaptchaReady = false;
  if (recaptchaVerifier) {
    try {
      recaptchaVerifier.clear();
    } catch (_) {}
    recaptchaVerifier = null;
  }
  const el = document.getElementById("recaptcha-container");
  if (el) el.innerHTML = "";
}

function ensureRecaptchaContainer(containerId) {
  let el = document.getElementById(containerId);
  if (el) return el;
  el = document.createElement("div");
  el.id = containerId;
  el.style.cssText =
    "display:flex;justify-content:center;margin:12px 0;min-height:78px;";
  document.body.appendChild(el);
  return el;
}

/**
 * Render captcha when modal opens. Resolves when user solves it.
 * @param {string} [containerId="recaptcha-container"]
 * @returns {Promise<firebase.auth.RecaptchaVerifier>}
 */
export function setupRecaptcha(containerId = "recaptcha-container") {
  resetRecaptcha();
  ensureRecaptchaContainer(containerId);

  return new Promise((resolve, reject) => {
    try {
      recaptchaVerifier = new firebase.auth.RecaptchaVerifier(containerId, {
        size: "normal",
        callback: () => {
          // User completed captcha — token is valid now
          recaptchaReady = true;
          resolve(recaptchaVerifier);
        },
        "expired-callback": () => {
          recaptchaReady = false;
          showToast("reCAPTCHA expired. Solve it again.");
          resetRecaptcha();
        },
      });

      recaptchaVerifier.render().catch((err) => {
        console.error("reCAPTCHA render failed:", err);
        resetRecaptcha();
        reject(
          new Error(
            "Could not load reCAPTCHA. Check network / Authorized domains."
          )
        );
      });
    } catch (err) {
      resetRecaptcha();
      reject(err);
    }
  });
}

/**
 * Call only AFTER captcha is solved (recaptchaReady === true)
 * @param {string} phoneE164
 */
export async function sendPhoneOtp(phoneE164) {
  const phone = String(phoneE164 || "").replace(/[\s-]/g, "");
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
    throw new Error("Use international format, e.g. +8801XXXXXXXXX");
  }

  if (!recaptchaVerifier || !recaptchaReady) {
    throw new Error("Complete the reCAPTCHA checkbox first");
  }

  try {
    confirmationResult = await auth.signInWithPhoneNumber(
      phone,
      recaptchaVerifier
    );
    return true;
  } catch (err) {
    console.error("sendPhoneOtp:", err?.code, err);
    resetRecaptcha();
    const e = new Error(mapAuthError(err));
    e.code = err?.code || "";
    throw e;
  }
}

export async function verifyPhoneOtp(code) {
  const c = String(code || "").trim();
  if (!/^\d{6}$/.test(c)) throw new Error("Enter the 6-digit code");
  if (!confirmationResult) throw new Error("Send OTP first");

  try {
    const cred = await confirmationResult.confirm(c);
    confirmationResult = null;
    resetRecaptcha();

    await ensurePrivateAndSettings(cred.user.uid, {
      phone: cred.user.phoneNumber || null,
      email: cred.user.email || null,
    });
    try {
      await loadUserData(cred.user.uid);
    } catch (_) {}

    return cred.user;
  } catch (err) {
    const e = new Error(mapAuthError(err));
    e.code = err?.code || "";
    throw e;
  }
}

/* ═══════════════════════════════════════════════════════════
   ONBOARDING
═══════════════════════════════════════════════════════════ */

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
          bio: String(bio || "")
            .trim()
            .slice(0, 160),
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

  try {
    const mod = await import("../core/app.js");
    if (typeof mod.refreshShell === "function") {
      mod.refreshShell();
    }
  } catch (_) {}

  showToast("Welcome to Kothiqo");
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
    resetRecaptcha();

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
  resetRecaptcha,
  sendPhoneOtp,
  verifyPhoneOtp,
  completeOnboarding,
  signOut,
};