/**
 * Firebase configuration — Nexus Chat
 * Your project: ltrchats
 */

const firebaseConfig = {
  apiKey: "AIzaSyC_-aJULNeT48MI7cOQkY0EsuK0iok0XCE",
  authDomain: "ltrchats.firebaseapp.com",
  projectId: "ltrchats",
  storageBucket: "ltrchats.firebasestorage.app",
  messagingSenderId: "907159540713",
  appId: "1:907159540713:web:05ebb4f53eeef738c27178",
  measurementId: "G-JQRZ84TDXL",
  // Realtime Database (for presence & typing) — enable in Firebase Console if not already
  databaseURL: "https://ltrchats-default-rtdb.asia-southeast1.firebasedatabase.app"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

export const auth = firebase.auth();
export const db = firebase.firestore();
export const storage = firebase.storage();
export const rtdb = firebase.database();

// Offline persistence
db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
  if (err.code === "failed-precondition") {
    console.warn("Persistence: multiple tabs open");
  } else if (err.code === "unimplemented") {
    console.warn("Persistence not available");
  }
});

export default firebase;