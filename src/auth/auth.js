/**
 * Authentication — Email, Google, Phone + profile bootstrap
 */

import { auth, db } from "../config/firebase.js";
import { setState, getState, resetState } from "../core/state.js";
resetState();
import { showToast } from "../components/toast.js";
import { normalizeUsername, isValidUsername } from "../utils/validation.js";

let recaptchaVerifier = null;
let confirmationResult = null;

export function initAuthListeners(onChange) {
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      try {
        await loadUserData(user.uid);
      } catch (err) {
        console.error("Failed to load user data:", err);
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
    onChange(user);
  });
}

export async function loadUserData(uid) {
  const [profileSnap, privateSnap, settingsSnap] = await Promise.all([
    db.collection("users").doc(uid).get(),
    db.collection("privateUsers").doc(uid).get(),
    db.collection("userSettings").doc(uid).get(),
  ]);

  const profile = profileSnap.exists ? profileSnap.data() : null;
  const privateProfile = privateSnap.exists ? privateSnap.data() : null;
  const settings = settingsSnap.exists ? settingsSnap.data() : null;
  const onboardingComplete = !!(profile && profile.username && profile.displayName);

  setState({ profile, privateProfile, settings, onboardingComplete });
  return { profile, privateProfile, settings, onboardingComplete };
}

async function ensurePrivateAndSettings(uid, extra = {}) {
  const privateRef = db.collection("privateUsers").doc(uid);
  const privateSnap = await privateRef.get();
  if (!privateSnap.exists) {
    await privateRef.set({
      email: extra.email || null,
      phone: extra.phone || null,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  }

  const settingsRef = db.collection("userSettings").doc(uid);
  const settingsSnap = await settingsRef.get();
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
      notifications: { messages: true, calls: true },
      theme: "system",
    });
  }
}

/* ───────── Email ───────── */
export async function registerWithEmail(email, password) {
  const cred = await auth.createUserWithEmailAndPassword(email, password);
  await ensurePrivateAndSettings(cred.user.uid, { email });
  return cred.user;
}

export async function loginWithEmail(email, password) {
  const cred = await auth.signInWithEmailAndPassword(email, password);
  return cred.user;
}

/* ───────── Google ───────── */
export async function loginWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  const cred = await auth.signInWithPopup(provider);
  await ensurePrivateAndSettings(cred.user.uid, {
    email: cred.user.email || null,
  });
  return cred.user;
}

/* ───────── Phone ───────── */
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
 * phoneE164 example: +8801712345678
 */
export async function sendPhoneOtp(phoneE164) {
  const appVerifier = setupRecaptcha("btn-phone-send");
  confirmationResult = await auth.signInWithPhoneNumber(phoneE164, appVerifier);
  return true;
}

export async function verifyPhoneOtp(code) {
  if (!confirmationResult) throw new Error("Send OTP first");
  const cred = await confirmationResult.confirm(code);
  await ensurePrivateAndSettings(cred.user.uid, {
    phone: cred.user.phoneNumber || null,
  });
  confirmationResult = null;
  return cred.user;
}

/* ───────── Onboarding ───────── */
export async function completeOnboarding({ displayName, username, bio = "", photoURL = null }) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");

  const normalized = normalizeUsername(username);
  if (!isValidUsername(normalized)) {
    throw new Error("Username must be 3–32 characters, lowercase letters, numbers, underscore only.");
  }

  const usernameRef = db.collection("usernames").doc(normalized);
  const userRef = db.collection("users").doc(user.uid);

  try {
    await db.runTransaction(async (tx) => {
      const existing = await tx.get(usernameRef);
      if (existing.exists) {
        throw new Error("Username is already taken");
      }

      tx.set(usernameRef, {
        uid: user.uid,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });

      tx.set(
        userRef,
        {
          displayName: displayName.trim(),
          username: normalized,
          photoURL: photoURL || null,
          bio: (bio || "").trim().slice(0, 160),
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });
  } catch (err) {
    console.error("Onboarding transaction failed:", err);
    // Re-throw with clearer message
    if (err.code === "permission-denied") {
      throw new Error("Permission denied. Check Firestore rules for users + usernames.");
    }
    throw err;
  }

  // Reload profile into state
  await loadUserData(user.uid);

  // Force UI to switch from onboarding → app shell
  try {
    const { refreshShell } = await import("../core/app.js");
    refreshShell();
  } catch (e) {
    console.warn("refreshShell failed", e);
  }

  showToast("Welcome to Nexus");
  return true;
}

export async function signOut() {
  await auth.signOut();
  confirmationResult = null;
  if (recaptchaVerifier) {
    try { recaptchaVerifier.clear(); } catch (_) {}
    recaptchaVerifier = null;
  }
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

export default {
  initAuthListeners,
  loadUserData,
  registerWithEmail,
  loginWithEmail,
  loginWithGoogle,
  setupRecaptcha,
  sendPhoneOtp,
  verifyPhoneOtp,
  completeOnboarding,
  signOut,
};