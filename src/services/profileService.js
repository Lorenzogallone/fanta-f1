/**
 * @file profileService.js
 * @description Service for managing user profile updates, including avatar upload/removal.
 */
import { doc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage } from "./firebase";

/**
 * Compress an image file to a max dimension and JPEG quality.
 * @param {File} file - The image file to compress
 * @param {number} maxSize - Max width/height in pixels
 * @param {number} quality - JPEG quality (0-1)
 * @returns {Promise<Blob>} Compressed image blob
 */
function compressImage(file, maxSize = 200, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      let { width, height } = img;

      if (width > height) {
        if (width > maxSize) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        }
      } else {
        if (height > maxSize) {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Compression failed"))),
        "image/jpeg",
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
    img.src = url;
  });
}

/**
 * Upload a profile image, compress it, and save the URL to Firestore.
 * @param {string} uid - User ID
 * @param {File} file - Image file to upload
 * @returns {Promise<string>} The download URL of the uploaded image
 */
export async function uploadProfileImage(uid, file) {
  const compressed = await compressImage(file, 200, 0.8);
  const storageRef = ref(storage, `avatars/${uid}`);
  await uploadBytes(storageRef, compressed, { contentType: "image/jpeg" });
  const downloadURL = await getDownloadURL(storageRef);

  await Promise.all([
    updateDoc(doc(db, "users", uid), { photoURL: downloadURL }),
    updateDoc(doc(db, "ranking", uid), { photoURL: downloadURL }),
  ]);

  return downloadURL;
}

/**
 * Remove the user's profile image from Storage and Firestore.
 * @param {string} uid - User ID
 */
export async function removeProfileImage(uid) {
  try {
    const storageRef = ref(storage, `avatars/${uid}`);
    await deleteObject(storageRef);
  } catch {
    // File may not exist in storage, continue
  }

  await Promise.all([
    updateDoc(doc(db, "users", uid), { photoURL: "" }),
    updateDoc(doc(db, "ranking", uid), { photoURL: "" }),
  ]);
}

/**
 * Update user profile fields in Firestore (users + ranking sync).
 * @param {string} uid - User ID
 * @param {Object} data - Fields to update
 * @param {string} [data.nickname] - New nickname
 * @param {string} [data.firstName] - New first name
 * @param {string} [data.lastName] - New last name
 */
export async function updateProfile(uid, { nickname, firstName, lastName }) {
  const userUpdate = {};
  const rankingUpdate = {};

  if (nickname !== undefined) {
    userUpdate.nickname = nickname;
    rankingUpdate.name = nickname;
  }
  if (firstName !== undefined) userUpdate.firstName = firstName;
  if (lastName !== undefined) userUpdate.lastName = lastName;

  const promises = [];
  if (Object.keys(userUpdate).length > 0) {
    promises.push(updateDoc(doc(db, "users", uid), userUpdate));
  }
  if (Object.keys(rankingUpdate).length > 0) {
    promises.push(updateDoc(doc(db, "ranking", uid), rankingUpdate));
  }

  await Promise.all(promises);
}
