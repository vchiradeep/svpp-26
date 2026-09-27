// Helper function to compress images on the client side
const compressImage = async (file, maxWidth = 1200, quality = 0.8) => {
  if (!file) return '';

  // If it's an audio file (voice notes), convert directly to data URL
  if (file.type && file.type.startsWith('audio/')) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => resolve(event.target.result);
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
  }

  // If it's not an image, return original file as data URL
  if (!file.type || !file.type.startsWith('image/')) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => resolve(event.target.result);
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
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

        // Convert canvas to a compressed WebP Data URL string
        const dataUrl = canvas.toDataURL('image/webp', quality);
        resolve(dataUrl);
      };
      img.onerror = () => {
        const fallbackReader = new FileReader();
        fallbackReader.onload = (e) => resolve(e.target.result);
        fallbackReader.readAsDataURL(file);
      };
    };
    reader.onerror = () => {
      const fallbackReader = new FileReader();
      fallbackReader.onload = (e) => resolve(e.target.result);
      fallbackReader.readAsDataURL(file);
    };
  });
};

export const uploadAvatar = async (userId, file) => {
  return await compressImage(file, 400, 0.8);
};

export const uploadGroupAvatar = async (conversationId, file) => {
  return await compressImage(file, 400, 0.8);
};

export const uploadWallpaper = async (userId, file) => {
  return await compressImage(file, 1200, 0.8);
};

export const uploadConversationMedia = async (conversationId, file) => {
  return await compressImage(file, 1000, 0.75);
};

// Best-effort cleanup — kept as a safe no-op since local data URLs 
// live directly inside Firestore documents and require no remote bucket deletion.
export const deleteMediaByUrl = async (fileUrl) => {
  return Promise.resolve();
};