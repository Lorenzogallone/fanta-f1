/**
 * @file Small helpers shared by the calendar and driver sync modules.
 * Pure ESM with no dependencies: imported by the web app (Vite) and by the
 * Cloud Functions (dynamic import from CommonJS).
 */

/** Max distance between an app race date and the official race date */
export const MATCH_TOLERANCE_MS = 2 * 24 * 60 * 60 * 1000; // 2 days

/**
 * Converts a Date, Firestore Timestamp (client or admin), ISO string or
 * millisecond number to a Date
 * @param {*} value - Date-like value
 * @returns {Date|null} Date or null if missing/invalid
 */
export function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value) ? null : value;
  if (typeof value.toDate === "function") return value.toDate();
  if (typeof value.seconds === "number") return new Date(value.seconds * 1000);
  const d = new Date(value);
  return isNaN(d) ? null : d;
}

/**
 * Milliseconds of a date-like value truncated to the second (or null)
 * @param {*} value - Date-like value
 * @returns {number|null}
 */
export function toSecondsMs(value) {
  const d = toDate(value);
  return d ? Math.floor(d.getTime() / 1000) * 1000 : null;
}

/**
 * Generates a URL-safe slug (same rules as the ICS importer)
 * @param {string} str - Input string
 * @returns {string} Slug
 */
export function makeSlug(str) {
  return String(str)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Normalizes a name for loose comparisons (case and accents ignored)
 * @param {string} str - Input string
 * @returns {string}
 */
export function normalizeName(str) {
  return String(str || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

/**
 * Deterministic 32-bit FNV-1a hash of a JSON-serializable value
 * (works the same in the browser and in Node, no crypto needed)
 * @param {*} value - Value to hash
 * @returns {string} Hex hash
 */
export function hashValue(value) {
  const str = JSON.stringify(value);
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/**
 * True when a race already has official results saved
 * @param {Object} race - Race document data
 * @returns {boolean}
 */
export function hasSavedResults(race) {
  const r = race?.officialResults;
  return Boolean(r && (r.P1 || r.P2 || r.P3 || r.SP1 || r.SP2 || r.SP3));
}
