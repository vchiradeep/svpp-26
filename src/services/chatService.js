import { db } from '../firebaseClient';
import {
  collection,
  collectionGroup,
  doc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  deleteField,
  increment,
} from 'firebase/firestore';

// ---------------------------------------------------------------------------
// Schema (agreed, plus two additions needed once the render tree turned out
// to expect Postgrest-style embedded joins — see notes below):
//   conversations/{conversationId}
//     { memberIds: [uid, uid],
//       memberProfiles: { [uid]: { username, avatar_url } },  // denormalized
//       unread_count: { [uid]: number },                       // denormalized
//       is_group, name, avatar_url,
//       last_message, last_message_at, created_at }
//   conversations/{conversationId}/members/{uid}
//     { last_read_at, hidden_at, joined_at }
//   conversations/{conversationId}/messages/{messageId}
//     { sender_id, content, type, media_url, created_at,
//       is_deleted_for_everyone, deleted_for: [uid] }
//   conversations/{conversationId}/messages/{messageId}/reactions/{reactionId}
//     { user_id, emoji, created_at }
//
// Why memberProfiles + unread_count live ON the conversation doc:
// Postgrest (Supabase) can return a conversation with its messages and
// members embedded in one nested-select query. Firestore has no equivalent
// join, so the app's existing conversation-list rendering (which expects
// `c.conversation_members` with nested `.profiles`, and computes unread
// counts from an embedded `c.messages` array) would otherwise need fetching
// every conversation's full message history just to render a list — that's
// both slow and expensive at scale. Denormalizing member profile summaries
// and a running unread counter onto the conversation doc itself means the
// list renders from ONE query, and this file reshapes the result into the
// same `conversation_members`-array shape the rest of the app already
// expects, so nothing downstream had to be rewritten.
// ---------------------------------------------------------------------------

// Turns { memberIds, memberProfiles } into the conversation_members-array
// shape the render tree expects, e.g.:
//   [{ user_id, profiles: { username, avatar_url } }]
const withCompatMembersShape = (docId, data) => {
  const memberIds = data.memberIds || [];
  const memberProfiles = data.memberProfiles || {};
  return {
    id: docId,
    ...data,
    conversation_members: memberIds.map((uid) => ({
      user_id: uid,
      profiles: memberProfiles[uid] || null,
    })),
  };
};

// -------------------- Conversations --------------------

export const fetchUserConversations = async (myId) => {
  try {
    const convsRef = collection(db, 'conversations');
    const convsQuery = query(
      convsRef,
      where('memberIds', 'array-contains', myId),
      orderBy('last_message_at', 'desc')
    );
    const snapshot = await getDocs(convsQuery);
    return snapshot.docs.map((d) => withCompatMembersShape(d.id, d.data()));
  } catch (error) {
    console.error('Error fetching user conversations:', error);
    return [];
  }
};

// Realtime version. Returns the unsubscribe function.
// NOTE: array-contains + orderBy on a different field needs a Firestore
// composite index — the first run will log an error with a direct link to
// create it; click it once and it's permanent.
export const subscribeToUserConversations = (myId, callback) => {
  const convsRef = collection(db, 'conversations');
  const convsQuery = query(
    convsRef,
    where('memberIds', 'array-contains', myId),
    orderBy('last_message_at', 'desc')
  );
  return onSnapshot(convsQuery, (snapshot) => {
    callback(snapshot.docs.map((d) => withCompatMembersShape(d.id, d.data())));
  }, (error) => {
    console.error('Error in conversations subscription:', error);
  });
};

export const createDirectConversation = async (myProfile, friendProfile) => {
  const now = serverTimestamp();
  const convsRef = collection(db, 'conversations');
  const newConvRef = doc(convsRef);
  const myId = myProfile.id;
  const friendId = friendProfile.id;

  await setDoc(newConvRef, {
    is_group: false,
    memberIds: [myId, friendId],
    memberProfiles: {
      [myId]: { username: myProfile.username, avatar_url: myProfile.avatar_url || null },
      [friendId]: { username: friendProfile.username, avatar_url: friendProfile.avatar_url || null },
    },
    unread_count: { [myId]: 0, [friendId]: 0 },
    last_message: null,
    last_message_at: now,
    created_at: now,
  });

  await setDoc(doc(db, 'conversations', newConvRef.id, 'members', myId), {
    last_read_at: now, hidden_at: null, joined_at: now,
  });
  await setDoc(doc(db, 'conversations', newConvRef.id, 'members', friendId), {
    last_read_at: null, hidden_at: null, joined_at: now,
  });

  return newConvRef.id;
};

export const createGroupConversation = async (creatorProfile, memberProfilesList, name) => {
  const now = serverTimestamp();
  const allProfiles = [creatorProfile, ...memberProfilesList.filter((p) => p.id !== creatorProfile.id)];
  const allMemberIds = allProfiles.map((p) => p.id);
  const memberProfiles = {};
  const unreadCount = {};
  allProfiles.forEach((p) => {
    memberProfiles[p.id] = { username: p.username, avatar_url: p.avatar_url || null };
    unreadCount[p.id] = 0;
  });

  const convsRef = collection(db, 'conversations');
  const newConvRef = doc(convsRef);

  await setDoc(newConvRef, {
    is_group: true,
    name,
    created_by: creatorProfile.id,
    admin_ids: [creatorProfile.id],
    only_admins_can_message: false,
    memberIds: allMemberIds,
    memberProfiles,
    unread_count: unreadCount,
    last_message: null,
    last_message_at: now,
    created_at: now,
  });

  await Promise.all(
    allMemberIds.map((uid) =>
      setDoc(doc(db, 'conversations', newConvRef.id, 'members', uid), {
        last_read_at: uid === creatorProfile.id ? now : null,
        hidden_at: null,
        joined_at: now,
      })
    )
  );

  return newConvRef.id;
};

// Generic field update for a conversation doc — used for the many small
// one-off updates (avatar_url, admin_ids, only_admins_can_message, name,
// etc.) that don't warrant their own dedicated function.
export const updateConversation = async (conversationId, updates) => {
  await updateDoc(doc(db, 'conversations', conversationId), updates);
};

export const addConversationMember = async (conversationId, memberProfile) => {
  const convRef = doc(db, 'conversations', conversationId);
  await updateDoc(convRef, {
    memberIds: arrayUnion(memberProfile.id),
    [`memberProfiles.${memberProfile.id}`]: {
      username: memberProfile.username,
      avatar_url: memberProfile.avatar_url || null,
    },
    [`unread_count.${memberProfile.id}`]: 0,
  });
  await setDoc(doc(db, 'conversations', conversationId, 'members', memberProfile.id), {
    last_read_at: null, hidden_at: null, joined_at: serverTimestamp(),
  });
};

export const removeConversationMember = async (conversationId, userId, currentAdminIds = []) => {
  await deleteDoc(doc(db, 'conversations', conversationId, 'members', userId));
  const updates = {
    memberIds: arrayRemove(userId),
    [`memberProfiles.${userId}`]: deleteField(),
    [`unread_count.${userId}`]: deleteField(),
  };
  if (currentAdminIds.includes(userId)) {
    updates.admin_ids = currentAdminIds.filter((id) => id !== userId);
  }
  await updateDoc(doc(db, 'conversations', conversationId), updates);
};

// -------------------- Members (read receipts) --------------------

export const fetchMembers = async (conversationId, conversation) => {
  const membersRef = collection(db, 'conversations', conversationId, 'members');
  const snapshot = await getDocs(membersRef);
  const memberProfiles = conversation?.memberProfiles || {};
  return snapshot.docs.map((d) => ({
    user_id: d.id,
    conversation_id: conversationId,
    profiles: memberProfiles[d.id] || null,
    ...d.data(),
  }));
};

// Realtime subscription to a conversation's member docs — drives "Seen".
// `conversation` (the parent doc's current data) is passed in so profile
// info can be merged in from memberProfiles without an extra read.
export const subscribeToMembers = (conversationId, conversation, callback) => {
  const membersRef = collection(db, 'conversations', conversationId, 'members');
  return onSnapshot(membersRef, (snapshot) => {
    const memberProfiles = conversation?.memberProfiles || {};
    callback(snapshot.docs.map((d) => ({
      user_id: d.id,
      conversation_id: conversationId,
      profiles: memberProfiles[d.id] || null,
      ...d.data(),
    })));
  }, (error) => {
    console.error('Error in members subscription:', error);
  });
};

export const markAsRead = async (conversationId, userId) => {
  const now = serverTimestamp();
  await updateDoc(doc(db, 'conversations', conversationId, 'members', userId), { last_read_at: now });
  await updateDoc(doc(db, 'conversations', conversationId), { [`unread_count.${userId}`]: 0 });
};

export const hideConversationForUser = async (conversationId, userId) => {
  await updateDoc(doc(db, 'conversations', conversationId, 'members', userId), {
    hidden_at: serverTimestamp(),
  });
};

// Un-hides a conversation the user previously hid (e.g. re-starting a direct
// chat with someone whose conversation already existed) and marks it read.
export const unhideConversationForUser = async (conversationId, userId) => {
  await updateDoc(doc(db, 'conversations', conversationId, 'members', userId), {
    hidden_at: null,
    last_read_at: serverTimestamp(),
  });
};

// -------------------- Messages --------------------

const MESSAGES_PAGE_SIZE = 30;

// Fetches one extra row beyond pageSize (same trick the old Supabase
// `.range(0, pageSize)` call used) purely to answer "does older history
// exist" without a second query — the extra row itself is dropped before
// returning.
export const fetchMessages = async (conversationId, pageSize = MESSAGES_PAGE_SIZE) => {
  const messagesRef = collection(db, 'conversations', conversationId, 'messages');
  const messagesQuery = query(messagesRef, orderBy('created_at', 'desc'), limit(pageSize + 1));
  const snapshot = await getDocs(messagesQuery);
  const hasMore = snapshot.docs.length > pageSize;
  const pageDocs = hasMore ? snapshot.docs.slice(0, pageSize) : snapshot.docs;
  return {
    messages: pageDocs.map((d) => ({ id: d.id, ...d.data() })).reverse(),
    oldestDoc: pageDocs[pageDocs.length - 1] || null,
    hasMore,
  };
};

// `beforeDoc` is the `oldestDoc` returned from a previous fetchMessages /
// fetchOlderMessages call — Firestore paginates by document snapshot, not
// by offset.
export const fetchOlderMessages = async (conversationId, beforeDoc, pageSize = MESSAGES_PAGE_SIZE) => {
  const messagesRef = collection(db, 'conversations', conversationId, 'messages');
  const messagesQuery = query(
    messagesRef, orderBy('created_at', 'desc'), startAfter(beforeDoc), limit(pageSize + 1)
  );
  const snapshot = await getDocs(messagesQuery);
  const hasMore = snapshot.docs.length > pageSize;
  const pageDocs = hasMore ? snapshot.docs.slice(0, pageSize) : snapshot.docs;
  return {
    messages: pageDocs.map((d) => ({ id: d.id, ...d.data() })).reverse(),
    oldestDoc: pageDocs[pageDocs.length - 1] || null,
    hasMore,
  };
};

export const subscribeToMessages = (conversationId, callback, pageSize = MESSAGES_PAGE_SIZE) => {
  const messagesRef = collection(db, 'conversations', conversationId, 'messages');
  const messagesQuery = query(messagesRef, orderBy('created_at', 'desc'), limit(pageSize));
  return onSnapshot(messagesQuery, (snapshot) => {
    callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })).reverse());
  }, (error) => {
    console.error('Error in messages subscription:', error);
  });
};

// `memberIds` is passed in (the caller already has it from the active
// conversation in memory) purely to avoid an extra doc read on every send.
export const sendMessage = async (conversationId, senderId, content, memberIds = [], extra = {}) => {
  const now = serverTimestamp();
  const messagesRef = collection(db, 'conversations', conversationId, 'messages');
  const newMessageRef = await addDoc(messagesRef, {
    sender_id: senderId,
    content,
    type: extra.type || 'text',
    media_url: extra.media_url || null,
    is_deleted_for_everyone: false,
    deleted_for: [],
    created_at: now,
    ...extra,
  });

  const unreadIncrements = {};
  memberIds.filter((uid) => uid !== senderId).forEach((uid) => {
    unreadIncrements[`unread_count.${uid}`] = increment(1);
  });

  await updateDoc(doc(db, 'conversations', conversationId), {
    last_message: content,
    last_message_at: now,
    last_message_sender_id: senderId,
    ...unreadIncrements,
  });

  return newMessageRef.id;
};

export const updateMessage = async (conversationId, messageId, updates) => {
  await updateDoc(doc(db, 'conversations', conversationId, 'messages', messageId), updates);
};

// Deleting a message previously never touched the conversation's
// denormalized last_message/last_message_at fields, so the sidebar preview
// kept showing the deleted message's content forever instead of falling
// back to whatever the previous, still-visible message was. This recomputes
// those fields from the most recent messages after any delete.
//
// forUserId is only passed for a "delete for me" action: that must NOT
// change what OTHER members see as the conversation's last message (only
// this user's own view changed), so their personal fallback is stored
// separately under last_message_overrides.{uid} rather than overwriting the
// shared last_message field everyone else reads.
const recomputeConversationPreview = async (conversationId, forUserId = null) => {
  const messagesRef = collection(db, 'conversations', conversationId, 'messages');
  // The previous still-visible message is virtually always within the last
  // handful — 50 is a generous safety margin without scanning full history.
  const recentQuery = query(messagesRef, orderBy('created_at', 'desc'), limit(50));
  const snapshot = await getDocs(recentQuery);
  const recentMessages = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

  if (!forUserId) {
    const visibleGlobally = recentMessages.find((m) => !m.is_deleted_for_everyone);
    await updateDoc(doc(db, 'conversations', conversationId), {
      last_message: visibleGlobally ? visibleGlobally.content : null,
      last_message_at: visibleGlobally ? visibleGlobally.created_at : serverTimestamp(),
      last_message_sender_id: visibleGlobally ? visibleGlobally.sender_id : null,
    });
    return;
  }

  const visibleForUser = recentMessages.find(
    (m) => !m.is_deleted_for_everyone && !(m.deleted_for || []).includes(forUserId)
  );
  await updateDoc(doc(db, 'conversations', conversationId), {
    [`last_message_overrides.${forUserId}`]: visibleForUser
      ? { content: visibleForUser.content, at: visibleForUser.created_at, sender_id: visibleForUser.sender_id }
      : null,
  });
};

export const deleteMessageForEveryone = async (conversationId, messageId) => {
  await updateMessage(conversationId, messageId, { is_deleted_for_everyone: true });
  await recomputeConversationPreview(conversationId);
};

export const deleteMessageForMe = async (conversationId, messageId, userId) => {
  await updateMessage(conversationId, messageId, { deleted_for: arrayUnion(userId) });
  await recomputeConversationPreview(conversationId, userId);
};

// -------------------- Reactions --------------------

// Fetches every reaction across every message in a conversation in ONE
// query, via a collectionGroup scan filtered by conversation_id (stored
// redundantly on each reaction doc for exactly this purpose) — the
// alternative would be one subcollection read per visible message, which
// doesn't scale as a conversation grows.
// NOTE: this needs a Firestore collectionGroup index on 'reactions' for the
// conversation_id field — same as the composite index note above, Firestore
// will log a direct link to create it on first run.
// Full message history, unpaginated — used only for the media gallery,
// which needs everything ever shared, not just the currently-loaded page.
export const fetchAllMessagesForGallery = async (conversationId) => {
  const messagesRef = collection(db, 'conversations', conversationId, 'messages');
  const messagesQuery = query(messagesRef, orderBy('created_at', 'desc'));
  const snapshot = await getDocs(messagesQuery);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
};

// Realtime reactions across the WHOLE conversation (collectionGroup scan
// filtered by conversation_id, same approach as fetchReactionsForConversation)
// rather than one listener per visible message.
export const subscribeToConversationReactions = (conversationId, callback) => {
  const q = query(collectionGroup(db, 'reactions'), where('conversation_id', '==', conversationId));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
  }, (error) => {
    console.error('Error in conversation reactions subscription:', error);
  });
};

export const fetchReactionsForConversation = async (conversationId) => {
  const q = query(collectionGroup(db, 'reactions'), where('conversation_id', '==', conversationId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const subscribeToReactions = (conversationId, messageId, callback) => {
  const reactionsRef = collection(db, 'conversations', conversationId, 'messages', messageId, 'reactions');
  return onSnapshot(reactionsRef, (snapshot) => {
    callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
  }, (error) => {
    console.error('Error in reactions subscription:', error);
  });
};

export const addReaction = async (conversationId, messageId, userId, emoji) => {
  const reactionRef = doc(db, 'conversations', conversationId, 'messages', messageId, 'reactions', userId);
  await setDoc(reactionRef, {
    user_id: userId,
    message_id: messageId,
    conversation_id: conversationId,
    emoji,
    created_at: serverTimestamp(),
  });
};

export const removeReaction = async (conversationId, messageId, userId) => {
  await deleteDoc(doc(db, 'conversations', conversationId, 'messages', messageId, 'reactions', userId));
};