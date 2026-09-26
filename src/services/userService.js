import { db } from '../firebaseClient';
import {
  collection,
  doc,
  query,
  where,
  getDoc,
  getDocs,
  deleteDoc,
  setDoc,
  updateDoc,
  addDoc,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';

// Schema:
//   users/{uid}                { username, avatar_url, email, last_seen, created_at }
//   friend_requests/{id}       { sender_id, receiver_id, status: 'pending'|'accepted' }
//
// Field names (sender_id/receiver_id, not fromId/toId) intentionally match
// the original Supabase table so the existing friendships/requests logic in
// App.jsx — which keys heavily off those names for optimistic UI updates —
// didn't need to be rewritten, only re-pointed at Firestore.

// -------------------- Profile --------------------

export const fetchProfile = async (uid) => {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const subscribeToProfile = (uid, callback) => {
  return onSnapshot(doc(db, 'users', uid), (snap) => {
    callback(snap.exists() ? { id: snap.id, ...snap.data() } : null);
  });
};

// Creates the users/{uid} doc on first sign-in if it doesn't exist yet —
// call this right after auth resolves, since Firebase Auth itself has no
// concept of a "profiles table". No-op read on every later sign-in.
export const ensureProfile = async (uid, defaults = {}) => {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      username: defaults.username || '',
      email: defaults.email || null,
      avatar_url: defaults.avatar_url || null,
      last_seen: serverTimestamp(),
      created_at: serverTimestamp(),
    });
    return fetchProfile(uid);
  }
  return { id: snap.id, ...snap.data() };
};

export const updateProfile = async (uid, updates) => {
  await updateDoc(doc(db, 'users', uid), updates);
};

// All other users (for the "people you may know" / search list). Firestore
// has no `!=` against a growing users collection at scale, but for an app
// this size a plain fetch-all-then-filter-out-self is fine.
export const fetchAllOtherUsers = async (myId) => {
  const snapshot = await getDocs(collection(db, 'users'));
  return snapshot.docs
    .filter((d) => d.id !== myId)
    .map((d) => ({ id: d.id, ...d.data() }));
};

// -------------------- Friend requests / friendships --------------------
// A "friendship" and a "pending request" are the same underlying document,
// distinguished only by `status` — matching how the app already treats them.

export const sendFriendRequest = async (senderId, receiverId) => {
  await addDoc(collection(db, 'friend_requests'), {
    sender_id: senderId,
    receiver_id: receiverId,
    status: 'pending',
    created_at: serverTimestamp(),
  });
};

export const acceptFriendRequest = async (requestId) => {
  await updateDoc(doc(db, 'friend_requests', requestId), { status: 'accepted' });
};

// Removes the friendship/request between two users in either direction —
// Firestore has no OR-across-fields delete, so this queries both directions
// and deletes whatever matches (normally exactly one doc).
export const removeFriendship = async (myId, otherId) => {
  const q1 = query(
    collection(db, 'friend_requests'),
    where('sender_id', '==', myId), where('receiver_id', '==', otherId)
  );
  const q2 = query(
    collection(db, 'friend_requests'),
    where('sender_id', '==', otherId), where('receiver_id', '==', myId)
  );
  const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
  const deletions = [...snap1.docs, ...snap2.docs].map((d) => deleteDoc(d.ref));
  await Promise.all(deletions);
};

// All friend_request docs involving me (pending + accepted, either
// direction) — this is the `friendships` list the UI derives relationship
// status from. One-time fetch; pair with subscribeToFriendships for realtime.
export const fetchFriendshipDocs = async (myId) => {
  const sentQ = query(collection(db, 'friend_requests'), where('sender_id', '==', myId));
  const receivedQ = query(collection(db, 'friend_requests'), where('receiver_id', '==', myId));
  const [sentSnap, receivedSnap] = await Promise.all([getDocs(sentQ), getDocs(receivedQ)]);
  return [
    ...sentSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    ...receivedSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
  ];
};

// Incoming pending requests for this user, with the sender's profile
// attached as `.sender` (the render tree expects this embedded, the way
// Postgrest's nested select used to provide it).
// One-time version of the above — use this wherever the caller already
// re-fetches on relevant actions (as this app does), to avoid piling up a
// new onSnapshot listener every time that call site runs again.
export const fetchIncomingRequests = async (myId) => {
  const q = query(
    collection(db, 'friend_requests'),
    where('receiver_id', '==', myId),
    where('status', '==', 'pending')
  );
  const snapshot = await getDocs(q);
  return Promise.all(
    snapshot.docs.map(async (d) => {
      const data = d.data();
      const sender = await fetchProfile(data.sender_id);
      return { id: d.id, ...data, sender };
    })
  );
};

export const subscribeToIncomingRequests = (myId, callback) => {
  const q = query(
    collection(db, 'friend_requests'),
    where('receiver_id', '==', myId),
    where('status', '==', 'pending')
  );
  return onSnapshot(q, async (snapshot) => {
    const requests = await Promise.all(
      snapshot.docs.map(async (d) => {
        const data = d.data();
        const sender = await fetchProfile(data.sender_id);
        return { id: d.id, ...data, sender };
      })
    );
    callback(requests);
  }, (error) => {
    console.error('Error in incoming friend requests subscription:', error);
  });
};