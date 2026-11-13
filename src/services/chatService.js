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
//       unread_count: { [uid]: number },                     // denormalized
//       hidden_at: { [uid]: timestamp },                     // denormalized hide state
//       is_group, name, avatar_url,
//       last_message, last_message_at, created_at }
//   conversations/{conversationId}/members/{uid}
//     { last_read_at, hidden_at, joined_at }
//   conversations/{conversationId}/messages/{messageId}
//     { sender_id, content, type, media_url, created_at,
//       is_deleted_for_everyone, deleted_for: [uid] }
//   conversations/{conversationId}/messages/{messageId}/reactions/{reactionId}
//     { user_id, emoji, created_at }
// ---------------------------------------------------------------------------

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
    return snapshot.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((data) => !data.hidden_at?.[myId]) // <--- Make sure this filter is here
      .map((data) => withCompatMembersShape(data.id, data));
  } catch (error) {
    console.error('Error fetching user conversations:', error);
    return [];
  }
};

export const subscribeToUserConversations = (myId, callback) => {
  const convsRef = collection(db, 'conversations');
  const convsQuery = query(
    convsRef,
    where('memberIds', 'array-contains', myId),
    orderBy('last_message_at', 'desc')
  );
  return onSnapshot(convsQuery, (snapshot) => {
    const activeConvs = snapshot.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((data) => !data.hidden_at?.[myId])
      .map((data) => withCompatMembersShape(data.id, data));
    callback(activeConvs);
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
    hidden_at: { [myId]: null, [friendId]: null },
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
  const hiddenAt = {};
  allProfiles.forEach((p) => {
    memberProfiles[p.id] = { username: p.username, avatar_url: p.avatar_url || null };
    unreadCount[p.id] = 0;
    hiddenAt[p.id] = null;
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
    hidden_at: hiddenAt,
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
    [`hidden_at.${memberProfile.id}`]: null,
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
    [`hidden_at.${userId}`]: deleteField(),
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
  const now = new Date().toISOString();
  await updateDoc(doc(db, 'conversations', conversationId, 'members', userId), { last_read_at: now });
  await updateDoc(doc(db, 'conversations', conversationId), { [`unread_count.${userId}`]: 0 });
};

export const hideConversationForUser = async (conversationId, userId) => {
  const now = new Date().toISOString();
  await updateDoc(doc(db, 'conversations', conversationId, 'members', userId), {
    hidden_at: now,
  });
  await updateDoc(doc(db, 'conversations', conversationId), {
    [`hidden_at.${userId}`]: now,
  });
};

export const unhideConversationForUser = async (conversationId, userId) => {
  const now = new Date().toISOString();
  await updateDoc(doc(db, 'conversations', conversationId, 'members', userId), {
    hidden_at: null,
    last_read_at: now,
  });
  await updateDoc(doc(db, 'conversations', conversationId), {
    [`hidden_at.${userId}`]: null,
  });
};

// -------------------- Messages --------------------

const MESSAGES_PAGE_SIZE = 30;

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
  const hiddenResets = {};
  memberIds.forEach((uid) => {
    if (uid !== senderId) {
      unreadIncrements[`unread_count.${uid}`] = increment(1);
    }
    hiddenResets[`hidden_at.${uid}`] = null;
  });

  await updateDoc(doc(db, 'conversations', conversationId), {
    last_message: content,
    last_message_at: now,
    last_message_sender_id: senderId,
    ...unreadIncrements,
    ...hiddenResets,
  });

  return newMessageRef.id;
};

export const updateMessage = async (conversationId, messageId, updates) => {
  await updateDoc(doc(db, 'conversations', conversationId, 'messages', messageId), updates);
};

const recomputeConversationPreview = async (conversationId, forUserId = null) => {
  const messagesRef = collection(db, 'conversations', conversationId, 'messages');
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

export const fetchAllMessagesForGallery = async (conversationId) => {
  const messagesRef = collection(db, 'conversations', conversationId, 'messages');
  const messagesQuery = query(messagesRef, orderBy('created_at', 'desc'));
  const snapshot = await getDocs(messagesQuery);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
};

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