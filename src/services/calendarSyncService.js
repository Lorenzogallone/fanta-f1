/**
 * @file calendarSyncService.js
 * @description Client side of the F1 sync (calendar + drivers) used by the
 * admin page: computes the preview and applies the chosen changes with the
 * client SDK (admin-only by Firestore rules). The logic is shared with the
 * scheduled Cloud Function (functions/shared/f1Sync.mjs).
 */

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  writeBatch,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import {
  fetchJolpicaSnapshot,
  computeF1Sync,
  computeRoundOrder,
  SYNC_STATUS_DOC,
} from "../../functions/shared/f1Sync.mjs";

const BATCH_LIMIT = 450;

/**
 * Computes what the sync would change (no writes)
 * @param {Object} input
 * @param {Array<Object>} input.races - Races (with `id`)
 * @param {Array<Object>} input.drivers - Drivers from Firestore ([] to skip the driver part)
 * @param {Array<Object>} input.teams - Teams from Firestore ([] to skip the driver part)
 * @param {number} [input.season] - Season (default: current UTC year)
 * @returns {Promise<Object>} computeF1Sync result plus `snapshot`
 */
export async function previewF1Sync({ races, drivers, teams, season }) {
  const year = season || new Date().getUTCFullYear();
  const snapshot = await fetchJolpicaSnapshot(year);
  return { snapshot, ...computeF1Sync({ snapshot, races, drivers, teams }) };
}

/**
 * Applies a list of merge writes ({ collection, id, data })
 * @param {Array<Object>} writes - Writes from computeF1Sync
 */
export async function applyWrites(writes) {
  for (let i = 0; i < writes.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    for (const w of writes.slice(i, i + BATCH_LIMIT)) {
      batch.set(doc(db, w.collection, w.id), { ...w.data, updatedAt: serverTimestamp() }, { merge: true });
    }
    await batch.commit();
  }
}

/**
 * Applies a full sync preview and records it in config/f1Sync
 * @param {Object} preview - Result of previewF1Sync
 */
export async function applyF1Sync(preview) {
  await applyWrites(preview.writes);
  await setDoc(doc(db, SYNC_STATUS_DOC.collection, SYNC_STATUS_DOC.id), {
    lastRunAt: serverTimestamp(),
    lastCheckAt: serverTimestamp(),
    apiHash: preview.summary.drivers.skipped ? null : preview.snapshot.hash,
    season: preview.snapshot.season,
    source: "manual",
    summary: preview.summary,
  }, { merge: true });
}

/**
 * Reads the outcome of the last sync (config/f1Sync)
 * @returns {Promise<Object|null>}
 */
export async function getSyncStatus() {
  const snap = await getDoc(doc(db, SYNC_STATUS_DOC.collection, SYNC_STATUS_DOC.id));
  return snap.exists() ? snap.data() : null;
}

/**
 * Writes a single API value (accept) on a race or driver; the lock state is kept
 * @param {string} collectionName - "races" or "drivers"
 * @param {string} id - Document id
 * @param {string} field - Field name
 * @param {*} value - New value (Date for timestamps)
 */
export async function acceptField(collectionName, id, field, value) {
  await updateDoc(doc(db, collectionName, id), { [field]: value, updatedAt: serverTimestamp() });
}

/**
 * Adds or removes fields from the `locked` list of a race or driver
 * @param {string} collectionName - "races" or "drivers"
 * @param {string} id - Document id
 * @param {Array<string>} fields - Fields to lock/unlock
 * @param {boolean} locked - true to lock, false to unlock
 */
export async function setFieldsLocked(collectionName, id, fields, locked) {
  if (!fields.length) return;
  await updateDoc(doc(db, collectionName, id), {
    locked: locked ? arrayUnion(...fields) : arrayRemove(...fields),
  });
}

/**
 * Recomputes the display order (`round`) by race date and saves the changes
 * @param {Array<Object>} races - Races after the change (with `id`, `raceUTC`, `round`)
 * @returns {Promise<number>} Number of races renumbered
 */
export async function saveRoundOrder(races) {
  const order = computeRoundOrder(races);
  const changed = races.filter((r) => r.round !== order[r.id]);
  if (!changed.length) return 0;
  const batch = writeBatch(db);
  for (const r of changed) batch.update(doc(db, "races", r.id), { round: order[r.id] });
  await batch.commit();
  return changed.length;
}
