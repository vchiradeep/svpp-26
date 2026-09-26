import { storage } from '../firebaseClient';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

export const uploadAvatar = async (userId, file) => {
  const avatarRef = ref(storage, `avatars/${userId}/${Date.now()}_${file.name}`);
  await uploadBytes(avatarRef, file);
  return getDownloadURL(avatarRef);
};

export const uploadGroupAvatar = async (conversationId, file) => {
  const groupAvatarRef = ref(storage, `group_avatars/${conversationId}/${Date.now()}_${file.name}`);
  await uploadBytes(groupAvatarRef, file);
  return getDownloadURL(groupAvatarRef);
};

export const uploadWallpaper = async (userId, file) => {
  const wallpaperRef = ref(storage, `wallpapers/${userId}/${Date.now()}_${file.name}`);
  await uploadBytes(wallpaperRef, file);
  return getDownloadURL(wallpaperRef);
};

export const uploadConversationMedia = async (conversationId, file) => {
  const mediaRef = ref(storage, `media/${conversationId}/${Date.now()}_${file.name}`);
  await uploadBytes(mediaRef, file);
  return getDownloadURL(mediaRef);
};

// Best-effort cleanup — e.g. when a message with an attachment is deleted
// for everyone. Failing silently is intentional: a missing storage object
// should never block the message-delete flow.
export const deleteMediaByUrl = async (fileUrl) => {
  try {
    const fileRef = ref(storage, fileUrl);
    await deleteObject(fileRef);
  } catch (error) {
    console.warn('Could not delete storage object (non-fatal):', error);
  }
};