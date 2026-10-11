/**
 * @file racePhotoService.js
 * @description Admin overrides of the circuit photo shown behind the next race card.
 * One doc per race in racePhotos/{raceId}:
 *   { mode: "custom", dataUrl, credit, pos, updatedAt }  → uploaded photo
 *   { mode: "none", updatedAt }                          → no photo for this race
 * No doc → the bundled default photo (src/data/raceImages.js).
 * The image is stored inline (compressed WebP/JPEG data URL, well under the 1 MB doc
 * limit) so no Storage bucket or extra rules are needed.
 */

import { doc, getDoc, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import { raceImage } from "../data/raceImages";

const CACHE_PREFIX = "fanta-f1-race-photo:";
/** Max data URL length stored in Firestore (doc limit is 1 MiB) */
const MAX_DATA_URL = 900 * 1024;

/** Background positions offered to the admin */
export const PHOTO_POSITIONS = ["top", "center", "bottom"];

const readCache = (raceId) => {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + raceId);
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
};

const writeCache = (raceId, override) => {
  try {
    if (override) localStorage.setItem(CACHE_PREFIX + raceId, JSON.stringify(override));
    else localStorage.removeItem(CACHE_PREFIX + raceId);
  } catch {
    // Storage full or blocked: the photo is simply fetched again next time
  }
};

/**
 * Last known override for a race (from this device), to render without waiting.
 * @param {string} raceId - Race id
 * @returns {Object|undefined} Override, or undefined when none is known
 */
export const cachedRacePhoto = (raceId) => (raceId ? readCache(raceId) : undefined);

/**
 * Loads the admin override for a race.
 * @param {string} raceId - Race id
 * @returns {Promise<Object|null>} { mode, dataUrl?, credit?, pos? } or null
 */
export async function getRacePhoto(raceId) {
  const snap = await getDoc(doc(db, "racePhotos", raceId));
  const data = snap.exists() ? snap.data() : null;
  const override = data && { mode: data.mode, dataUrl: data.dataUrl, credit: data.credit, pos: data.pos };
  writeCache(raceId, override);
  return override;
}

/**
 * Photo to show for a race, combining the override with the default photo.
 * @param {Object} race - Race document
 * @param {Object|null} override - Result of getRacePhoto
 * @returns {{ src: string, pos: string, credit: string, href: string|null }|null}
 */
export function resolveRacePhoto(race, override) {
  if (override?.mode === "none") return null;
  if (override?.mode === "custom" && override.dataUrl) {
    return {
      src: override.dataUrl,
      pos: override.pos || "center",
      credit: override.credit || "",
      href: null,
    };
  }
  return raceImage(race);
}

/**
 * Saves an uploaded photo for a race.
 * @param {string} raceId - Race id
 * @param {{ dataUrl: string, credit: string, pos: string }} photo - Compressed image and info
 */
export async function saveCustomRacePhoto(raceId, { dataUrl, credit, pos }) {
  const data = { mode: "custom", dataUrl, credit: credit.trim(), pos };
  await setDoc(doc(db, "racePhotos", raceId), { ...data, updatedAt: serverTimestamp() });
  writeCache(raceId, data);
}

/**
 * Hides the photo for a race.
 * @param {string} raceId - Race id
 */
export async function removeRacePhoto(raceId) {
  await setDoc(doc(db, "racePhotos", raceId), { mode: "none", updatedAt: serverTimestamp() });
  writeCache(raceId, { mode: "none" });
}

/**
 * Goes back to the bundled default photo.
 * @param {string} raceId - Race id
 */
export async function resetRacePhoto(raceId) {
  await deleteDoc(doc(db, "racePhotos", raceId));
  writeCache(raceId, null);
}

/**
 * Resizes an image file to a compressed data URL small enough for Firestore.
 * Tries WebP first (falls back to JPEG where the browser can't encode WebP).
 * @param {File} file - Image picked by the admin
 * @returns {Promise<string>} Data URL
 */
export function compressRacePhoto(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const attempts = [[1600, 0.75], [1280, 0.72], [1280, 0.6], [1024, 0.6], [900, 0.5]];
      for (const [maxW, quality] of attempts) {
        const scale = Math.min(1, maxW / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        let out = canvas.toDataURL("image/webp", quality);
        if (!out.startsWith("data:image/webp")) out = canvas.toDataURL("image/jpeg", quality);
        if (out.length <= MAX_DATA_URL) return resolve(out);
      }
      reject(new Error("too-large"));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("invalid-image"));
    };
    img.src = url;
  });
}
