import { rtdb } from '../firebaseClient';
import { ref, onValue, onDisconnect, set, remove, serverTimestamp } from 'firebase/database';

// This is Firebase's own documented presence pattern. `.info/connected` is a
// special RTDB path that fires every time THIS client's socket connects or
// drops. Each time it reconnects, we (re)arm onDisconnect() — a promise the
// Firebase SERVER holds and fulfills the instant it notices this socket is
// gone (tab closed, laptop lid shut, network dies), with zero client code
// needed at that moment. This is the piece Firestore cannot do on its own.

// Call once per session (e.g. in the same effect that used to own the
// Supabase presence channel). Returns a cleanup function.
export const initPresence = (userId) => {
  if (!userId) return () => {};

  const userStatusRef = ref(rtdb, `status/${userId}`);
  const connectedRef = ref(rtdb, '.info/connected');

  const unsubscribe = onValue(connectedRef, (snap) => {
    if (snap.val() === false) {
      // Our own local view of the connection dropped; nothing to arm.
      return;
    }

    // Arm the server-side "if I disappear, mark me offline" promise FIRST,
    // then flip to online. If arming fails, we deliberately do not mark
    // online, since there'd be nothing to catch a silent disconnect.
    onDisconnect(userStatusRef)
      .set({ state: 'offline', last_changed: serverTimestamp() })
      .then(() => {
        set(userStatusRef, { state: 'online', last_changed: serverTimestamp() });
      });
  });

  return () => {
    unsubscribe();
    set(userStatusRef, { state: 'offline', last_changed: serverTimestamp() });
  };
};

// Subscribe to one user's presence — drives a single green dot. Returns the
// unsubscribe function.
export const subscribeToPresence = (userId, callback) => {
  const userStatusRef = ref(rtdb, `status/${userId}`);
  return onValue(userStatusRef, (snap) => {
    callback(snap.val() || { state: 'offline', last_changed: null });
  });
};

// Subscribe to everyone's presence at once — more efficient than one
// listener per friend when rendering a friends list or conversation list.
// Returns the unsubscribe function; callback receives { [userId]: {state, last_changed} }.
export const subscribeToAllPresence = (callback) => {
  const statusRef = ref(rtdb, 'status');
  return onValue(statusRef, (snap) => {
    callback(snap.val() || {});
  });
};

// -------------------- Typing indicators --------------------
// RTDB replaces the old global ephemeral broadcast channel. A bonus of
// moving this here: onDisconnect() clears a stuck "typing..." indicator
// automatically if the typer's connection drops mid-type, which the old
// broadcast-only approach couldn't do (it relied solely on the sender's own
// client-side timeout, which never fires if that client vanishes).
export const setTyping = (conversationId, userId, username, isTyping) => {
  const typingRef = ref(rtdb, `typing/${conversationId}/${userId}`);
  if (isTyping) {
    set(typingRef, { username, updated_at: serverTimestamp() });
    onDisconnect(typingRef).remove();
  } else {
    remove(typingRef);
    onDisconnect(typingRef).cancel();
  }
};

// One listener for typing state across ALL of the user's conversations —
// callback receives { [conversationId]: { [userId]: {username, updated_at} } }.
export const subscribeToAllTyping = (callback) => {
  const typingRootRef = ref(rtdb, 'typing');
  return onValue(typingRootRef, (snap) => {
    callback(snap.val() || {});
  });
};