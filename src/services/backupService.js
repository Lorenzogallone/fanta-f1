/**
 * @file backupService.js
 * @description Service for creating and restoring database backups
 */

import {
  collection,
  getDocs,
  doc,
  setDoc,
  Timestamp,
  writeBatch,
  deleteDoc,
  query,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "./firebase";
import { log, error } from "../utils/logger";

/**
 * Creates a complete backup of the database
 * @param {string} type - Type of backup: "manual", "auto_race", "auto_championship"
 * @param {object} metadata - Additional metadata (raceName, raceId, etc.)
 * @returns {Promise<object>} Backup data
 */
export async function createBackup(type = "manual", metadata = {}) {
  try {
    log(`[Backup] Creating ${type} backup...`);

    // Fetch all data
    const [racesSnap, rankingSnap] = await Promise.all([
      getDocs(collection(db, "races")),
      getDocs(collection(db, "ranking")),
    ]);

    // Build races data with submissions (parallelized for better performance)
    const races = await Promise.all(
      racesSnap.docs.map(async (raceDoc) => {
        const raceData = { id: raceDoc.id, ...raceDoc.data() };

        // Get submissions for this race
        const submissionsSnap = await getDocs(
          collection(db, "races", raceDoc.id, "submissions")
        );

        const submissions = {};
        submissionsSnap.docs.forEach((subDoc) => {
          submissions[subDoc.id] = subDoc.data();
        });

        return {
          ...raceData,
          submissions,
        };
      })
    );

    // Build ranking data
    const ranking = rankingSnap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    const backupData = {
      races,
      ranking,
      metadata: {
        type,
        timestamp: Timestamp.now(),
        totalRaces: races.length,
        totalParticipants: ranking.length,
        ...metadata,
      },
    };

    log(`[Backup] Backup created: ${races.length} races, ${ranking.length} participants`);
    return backupData;
  } catch (err) {
    error("[Backup] Error creating backup:", err);
    throw err;
  }
}

/**
 * Saves a backup to Firestore
 * @param {object} backupData - Backup data from createBackup()
 * @returns {Promise<string>} Backup ID
 */
export async function saveBackupToDatabase(backupData) {
  try {
    const backupId = `backup_${Date.now()}`;

    await setDoc(doc(db, "backups", backupId), backupData);

    log(`[Backup] Saved to database: ${backupId}`);
    return backupId;
  } catch (err) {
    error("[Backup] Error saving backup to database:", err);
    throw err;
  }
}

/**
 * Creates and saves a backup (combined function)
 * @param {string} type - Type of backup
 * @param {object} metadata - Additional metadata
 * @returns {Promise<string>} Backup ID
 */
export async function createAndSaveBackup(type = "manual", metadata = {}) {
  const backupData = await createBackup(type, metadata);
  const backupId = await saveBackupToDatabase(backupData);
  return backupId;
}

/**
 * Fetches all backups from database
 * @returns {Promise<Array>} Array of backups
 */
export async function getAllBackups() {
  try {
    const backupsSnap = await getDocs(
      query(collection(db, "backups"), orderBy("metadata.timestamp", "desc"))
    );

    return backupsSnap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));
  } catch (err) {
    error("[Backup] Error fetching backups:", err);
    return [];
  }
}

/**
 * Deletes a backup from database
 * @param {string} backupId - Backup ID to delete
 * @returns {Promise<void>}
 */
export async function deleteBackup(backupId) {
  try {
    await deleteDoc(doc(db, "backups", backupId));
    log(`[Backup] Deleted backup: ${backupId}`);
  } catch (err) {
    error("[Backup] Error deleting backup:", err);
    throw err;
  }
}

/**
 * Restores database from a backup
 * @param {object} backupData - Backup data to restore
 * @returns {Promise<void>}
 */
export async function restoreFromBackup(backupData) {
  try {
    log("[Restore] Starting database restore...");

    // Step 1: Clear existing data
    log("[Restore] Clearing existing data...");

    // Clear ranking
    const rankingSnap = await getDocs(collection(db, "ranking"));
    const deleteRankingBatch = writeBatch(db);
    rankingSnap.docs.forEach((d) => {
      deleteRankingBatch.delete(d.ref);
    });
    await deleteRankingBatch.commit();

    // Clear races and submissions
    const racesSnap = await getDocs(collection(db, "races"));
    for (const raceDoc of racesSnap.docs) {
      // Delete submissions
      const submissionsSnap = await getDocs(
        collection(db, "races", raceDoc.id, "submissions")
      );
      const deleteSubsBatch = writeBatch(db);
      submissionsSnap.docs.forEach((d) => {
        deleteSubsBatch.delete(d.ref);
      });
      await deleteSubsBatch.commit();

      // Delete race
      await deleteDoc(raceDoc.ref);
    }

    log("[Restore] Existing data cleared");

    // Step 2: Restore ranking
    log("[Restore] Restoring ranking...");
    const rankingBatch = writeBatch(db);
    backupData.ranking.forEach((participant) => {
      const { id, ...data } = participant;
      rankingBatch.set(doc(db, "ranking", id), data);
    });
    await rankingBatch.commit();

    // Step 3: Restore races and submissions
    log("[Restore] Restoring races...");
    for (const race of backupData.races) {
      const { id, submissions, ...raceData } = race;

      // Restore race document
      await setDoc(doc(db, "races", id), raceData);

      // Restore submissions
      if (submissions && Object.keys(submissions).length > 0) {
        const subsBatch = writeBatch(db);
        Object.entries(submissions).forEach(([userId, submissionData]) => {
          subsBatch.set(
            doc(db, "races", id, "submissions", userId),
            submissionData
          );
        });
        await subsBatch.commit();
      }
    }

    log("[Restore] Database restore completed successfully");
  } catch (err) {
    error("[Restore] Error restoring database:", err);
    throw err;
  }
}

/**
 * Downloads backup as JSON file
 * @param {object} backupData - Backup data
 * @param {string} filename - Filename for download
 */
export function downloadBackupAsJSON(backupData, filename = "backup") {
  const dataStr = JSON.stringify(backupData, null, 2);
  const dataBlob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(dataBlob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}_${Date.now()}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
