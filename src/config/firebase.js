/**
 * Firebase configuration — Kothiqo
 * Project: kothiqo
 *
 * Requires compat scripts in index.html:
 *   firebase-app, auth, firestore, storage, database
 */

const firebaseConfig = {
  apiKey: "AIzaSyBXbqfLo9sZObIgICm2SVLH3eF2z9gpHkY",
  authDomain: "kothiqo.firebaseapp.com",
  projectId: "kothiqo",
  storageBucket: "kothiqo.firebasestorage.app",
  messagingSenderId: "461366286637",
  appId: "1:461366286637:web:ac3fadba96965250789ba4",
  measurementId: "G-N191XZ15TN",
  databaseURL:
    "https://kothiqo-default-rtdb.asia-southeast1.firebasedatabase.app",
};

/* ── Guard: compat SDK must be on the page ───────────────── */
if (typeof firebase === "undefined") {
  throw new Error(
    "[Kothiqo] Firebase SDK not loaded. Check index.html script tags."
  );
}

/* ── Init once ───────────────────────────────────────────── */
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

export const app = firebase.app();
export const auth = firebase.auth();
export const db = firebase.firestore();
export const storage = firebase.storage();
export const rtdb = firebase.database();

/* ── Auth: language for reset emails / reCAPTCHA ─────────── */
try {
  auth.languageCode = auth.languageCode || "en";
  // Stay logged in across tabs/browser restarts
  auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch((err) => {
    console.warn("[auth] persistence:", err?.message || err);
  });
} catch (err) {
  console.warn("[auth] setup:", err);
}

/* ── Firestore settings (must run before first query) ────── */
try {
  db.settings({
    ignoreUndefinedProperties: true,
  });
} catch (_) {
  // settings() throws if already started — safe to ignore
}

/* ── Offline cache (multi-tab safe) ──────────────────────── */
db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
  if (err.code === "failed-precondition") {
    // Multiple tabs — one tab already owns persistence
    console.warn("[firestore] Persistence unavailable (multiple tabs)");
  } else if (err.code === "unimplemented") {
    console.warn("[firestore] Persistence not supported in this browser");
  } else {
    console.warn("[firestore] Persistence:", err.message || err);
  }
});

/* ── Helpers ─────────────────────────────────────────────── */

/** Server timestamp (Firestore) */
export const serverTimestamp = () =>
  firebase.firestore.FieldValue.serverTimestamp();

/** FieldValue for arrays / deletes */
export const FieldValue = firebase.firestore.FieldValue;

/** RTDB server timestamp */
export const rtdbTimestamp = () => firebase.database.ServerValue.TIMESTAMP;

/**
 * Safe sign-out + clear sensitive local flags (optional use)
 */
export async function clearAuthState() {
  try {
    await auth.signOut();
  } catch (err) {
    console.warn("[auth] signOut:", err);
  }
}

export default firebase;