import { storage } from '../firebaseClient';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

// Helper function to compress images on the client side before upload
const compressImage = async (file, maxWidth = 1200, quality = 0.8) => {
  // If it's not an image, return the original file untouched
  if (!file || !file.type || !file.type.startsWith('image/')) {
    return file;
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Scale down dimensions proportionally if it exceeds maxWidth
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Convert canvas to a compressed WebP blob
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file); // Fallback to original if compression fails
              return;
            }
            const compressedFile = new File(
              [blob],
              file.name.replace(/\.[^/.]+$/, '') + '.webp',
              {
                type: 'image/webp',
                lastModified: Date.now(),
              }
            );
            resolve(compressedFile);
          },
          'image/webp',
          quality
        );
      };
      img.onerror = () => resolve(file); // Fallback on error
    };
    reader.onerror = () => resolve(file); // Fallback on error
  });
};

export const uploadAvatar = async (userId, file) => {
  const processedFile = await compressImage(file);
  const avatarRef = ref(storage, `avatars/${userId}/${Date.now()}_${processedFile.name}`);
  await uploadBytes(avatarRef, processedFile);
  return getDownloadURL(avatarRef);
};

export const uploadGroupAvatar = async (conversationId, file) => {
  const processedFile = await compressImage(file);
  const groupAvatarRef = ref(storage, `group_avatars/${conversationId}/${Date.now()}_${processedFile.name}`);
  await uploadBytes(groupAvatarRef, processedFile);
  return getDownloadURL(groupAvatarRef);
};

export const uploadWallpaper = async (userId, file) => {
  const processedFile = await compressImage(file);
  const wallpaperRef = ref(storage, `wallpapers/${userId}/${Date.now()}_${processedFile.name}`);
  await uploadBytes(wallpaperRef, processedFile);
  return getDownloadURL(wallpaperRef);
};

export const uploadConversationMedia = async (conversationId, file) => {
  const processedFile = await compressImage(file);
  const mediaRef = ref(storage, `media/${conversationId}/${Date.now()}_${processedFile.name}`);
  await uploadBytes(mediaRef, processedFile);
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