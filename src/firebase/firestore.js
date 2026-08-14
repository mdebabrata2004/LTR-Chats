/**
 * Firestore helpers — conversations, messages, users
 * Nexus Chat — production-ready client helpers
 */

import { db, auth } from "../config/firebase.js";

const FieldValue = firebase.firestore.FieldValue;

function requireAuth() {
  const me = auth.currentUser;
  if (!me) throw new Error("Not authenticated");
  return me;
}

/**
 * Get or create a 1:1 conversation.
 * ID = sorted uids joined by "_"
 */
export async function getOrCreateDirectConversation(otherUid) {
  const me = requireAuth();
  if (!otherUid || otherUid === me.uid) {
    throw new Error("Invalid user");
  }

  const members = [me.uid, otherUid].sort();
  const cid = members.join("_");
  const convRef = db.collection("conversations").doc(cid);

  const snap = await convRef.get();
  if (snap.exists) return cid;

  // Create conversation first
  await convRef.set({
    type: "direct",
    members,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    lastMessage: null,
  });

  // Membership docs — each user writes own doc first (rules: auth.uid == uid)
  // then try the other (may need rules that allow creator to add both)
  const myMemberRef = db
    .collection("conversationMembers")
    .doc(cid)
    .collection("members")
    .doc(me.uid);

  await myMemberRef.set({
    role: "member",
    joinedAt: FieldValue.serverTimestamp(),
    lastRead: null,
  });

  // Other member — allowed if rules permit creator adding members
  try {
    await db
      .collection("conversationMembers")
      .doc(cid)
      .collection("members")
      .doc(otherUid)
      .set({
        role: "member",
        joinedAt: FieldValue.serverTimestamp(),
        lastRead: null,
      });
  } catch (err) {
    console.warn("Could not write other membership (rules). Conversation still created.", err);
  }

  return cid;
}

/**
 * Send a text message
 */
export async function sendTextMessage(conversationId, text, replyTo = null) {
  const me = requireAuth();
  if (!text || !text.trim()) throw new Error("Empty message");

  const msgRef = db
    .collection("messages")
    .doc(conversationId)
    .collection("messages")
    .doc();

  const data = {
    senderId: me.uid,
    type: "text",
    text: text.trim(),
    createdAt: FieldValue.serverTimestamp(),
    status: "sent",
    deleted: false,
    reactions: {},
  };
  if (replyTo) data.replyTo = replyTo;

  await msgRef.set(data);

  await db
    .collection("conversations")
    .doc(conversationId)
    .update({
      lastMessage: {
        text: text.trim().slice(0, 120),
        senderId: me.uid,
        type: "text",
        createdAt: FieldValue.serverTimestamp(),
      },
      updatedAt: FieldValue.serverTimestamp(),
    });

  return msgRef.id;
}

/**
 * Realtime messages listener (oldest → newest in callback)
 */
export function listenMessages(conversationId, limit = 50, onUpdate) {
  if (!auth.currentUser) {
    onUpdate([]);
    return () => {};
  }

  const q = db
    .collection("messages")
    .doc(conversationId)
    .collection("messages")
    .orderBy("createdAt", "desc")
    .limit(limit);

  return q.onSnapshot(
    (snap) => {
      const list = [];
      snap.forEach((doc) => list.push({ id: doc.id, ...doc.data() }));
      list.reverse();
      onUpdate(list);
    },
    (err) => {
      console.error("Messages listener error:", err);
      onUpdate([], err);
    }
  );
}

/**
 * Realtime conversation list for current user
 */
export function listenMyConversations(onUpdate) {
  const me = auth.currentUser;
  if (!me) {
    onUpdate([]);
    return () => {};
  }

  const q = db
    .collection("conversations")
    .where("members", "array-contains", me.uid)
    .orderBy("updatedAt", "desc")
    .limit(50);

  return q.onSnapshot(
    (snap) => {
      const list = [];
      snap.forEach((doc) => list.push({ id: doc.id, ...doc.data() }));
      onUpdate(list);
    },
    (err) => {
      console.error("Conversations listener error:", err);
      onUpdate([], err);
    }
  );
}

/**
 * Soft-delete for everyone (sender, within 24h)
 */
export async function deleteMessageForEveryone(conversationId, messageId) {
  const me = requireAuth();

  const ref = db
    .collection("messages")
    .doc(conversationId)
    .collection("messages")
    .doc(messageId);

  const snap = await ref.get();
  if (!snap.exists) throw new Error("Message not found");

  const data = snap.data();
  if (data.senderId !== me.uid) throw new Error("Only sender can delete for everyone");
  if (data.deleted) throw new Error("Already deleted");

  const created = data.createdAt?.toMillis?.() || 0;
  if (Date.now() - created > 24 * 60 * 60 * 1000) {
    throw new Error("Delete for everyone window expired (24h)");
  }

  await ref.update({
    deleted: true,
    deletedAt: FieldValue.serverTimestamp(),
    deletedBy: me.uid,
    text: "",
  });
}

/**
 * Mark conversation read
 */
export async function markConversationRead(conversationId) {
  const me = auth.currentUser;
  if (!me) return;

  await db
    .collection("conversationMembers")
    .doc(conversationId)
    .collection("members")
    .doc(me.uid)
    .set({ lastRead: FieldValue.serverTimestamp() }, { merge: true });
}

/**
 * Search users by username
 * 1) Exact match via usernames/{username}  (always rules-safe get)
 * 2) Prefix match via users.username range (needs list permission + index)
 */
export async function searchUsersByUsername(query, limit = 20) {
  const me = requireAuth();

  const q = (query || "").toLowerCase().trim().replace(/^@/, "");
  if (q.length < 2) return [];

  const results = [];
  const seen = new Set();

  // ── 1) Exact match (get) — works with allow get: if true ──
  try {
    const exact = await db.collection("usernames").doc(q).get();
    if (exact.exists) {
      const { uid } = exact.data() || {};
      if (uid && uid !== me.uid && !seen.has(uid)) {
        const userSnap = await db.collection("users").doc(uid).get();
        if (userSnap.exists) {
          seen.add(uid);
          results.push({ uid, username: q, ...userSnap.data() });
        }
      }
    }
  } catch (err) {
    console.warn("Exact username lookup failed:", err);
  }

  // ── 2) Prefix search (list query) ──
  try {
    const end = q + "\uf8ff";
    const snap = await db
      .collection("users")
      .where("username", ">=", q)
      .where("username", "<=", end)
      .orderBy("username")
      .limit(limit)
      .get();

    snap.forEach((doc) => {
      if (doc.id === me.uid || seen.has(doc.id)) return;
      const data = doc.data();
      if (!data.username) return;
      seen.add(doc.id);
      results.push({ uid: doc.id, ...data });
    });
  } catch (err) {
    // permission-denied / missing index → keep exact results only
    console.warn("Prefix username search failed (using exact only):", err.code || err.message);
  }

  return results.slice(0, limit);
}

/**
 * Public profile by uid
 */
export async function getUserProfile(uid) {
  if (!uid) return null;
  const snap = await db.collection("users").doc(uid).get();
  return snap.exists ? { uid, ...snap.data() } : null;
}

export default {
  getOrCreateDirectConversation,
  sendTextMessage,
  listenMessages,
  listenMyConversations,
  deleteMessageForEveryone,
  markConversationRead,
  searchUsersByUsername,
  getUserProfile,
};