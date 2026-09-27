import { rtdb } from '../firebaseClient';
import { ref, push, onValue, onDisconnect, set, remove, serverTimestamp } from 'firebase/database';

// This is Firebase's own documented presence pattern, using a PER-CONNECTION
// key rather than a single overwritable online/offline flag.
//
// The earlier version wrote one flat boolean at `status/{uid}` directly, and
// that was exactly why online status flickered on/off/on: `.info/connected`
// fires `true` again every time the underlying websocket silently
// reconnects — not just on first load — which happens routinely (background
// tab throttling, brief network blips, more than one tab open for the same
// user). Each of those reconnects re-ran onDisconnect().set(offline) then
// set(online), and because all of that raced against a SINGLE shared key,
// a stale onDisconnect from a previous connection cycle (or a second tab)
// could momentarily write "offline" in between — visible as the exact
// flicker described.
//
// The fix: each connection/tab gets its OWN key under
// `status/{uid}/connections/{connectionId}`, and onDisconnect only ever
// removes THAT key. "Online" is derived as "does this user have at least
// one connection key present" — so one tab's reconnect blip, or having
// several tabs open, can never stomp on another connection's presence.

// Call once per session. Returns a cleanup function.
export const initPresence = (userId) => {
  if (!userId) return () => {};

  const userConnectionsRef = ref(rtdb, `status/${userId}/connections`);
  const lastChangedRef = ref(rtdb, `status/${userId}/last_changed`);
  const connectedRef = ref(rtdb, '.info/connected');
  // A unique key per tab/session, so multiple tabs (or reconnects) each get
  // their own independent presence entry instead of sharing one.
  const myConnectionRef = push(userConnectionsRef);

  const unsubscribe = onValue(connectedRef, (snap) => {
    if (snap.val() === false) {
      // Our own local view of the connection dropped; nothing to arm until
      // it reconnects and this callback fires again with true.
      return;
    }

    // Arm the server-side "if I disappear, remove just my own connection
    // key" promise FIRST, then add it. Only this tab's key is ever touched.
    onDisconnect(myConnectionRef).remove();
    onDisconnect(lastChangedRef).set(serverTimestamp());

    set(myConnectionRef, true);
    set(lastChangedRef, serverTimestamp());
  });

  return () => {
    unsubscribe();
    remove(myConnectionRef);
    set(lastChangedRef, serverTimestamp());
  };
};

// Turns the raw `status/{uid}` shape ({connections: {...}, last_changed})
// into the simple {state, last_changed} shape the rest of the app expects.
const deriveStatus = (data) => {
  const hasConnections = !!(data?.connections && Object.keys(data.connections).length > 0);
  return { state: hasConnections ? 'online' : 'offline', last_changed: data?.last_changed || null };
};

// Subscribe to one user's presence — drives a single green dot. Returns the
// unsubscribe function.
export const subscribeToPresence = (userId, callback) => {
  const userRef = ref(rtdb, `status/${userId}`);
  return onValue(userRef, (snap) => {
    callback(deriveStatus(snap.val()));
  });
};

// Subscribe to everyone's presence at once — more efficient than one
// listener per friend when rendering a friends list or conversation list.
// Returns the unsubscribe function; callback receives { [userId]: {state, last_changed} }.
export const subscribeToAllPresence = (callback) => {
  const statusRef = ref(rtdb, 'status');
  return onValue(statusRef, (snap) => {
    const raw = snap.val() || {};
    const derived = {};
    Object.entries(raw).forEach(([uid, data]) => {
      derived[uid] = deriveStatus(data);
    });
    callback(derived);
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