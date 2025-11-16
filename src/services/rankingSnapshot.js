/**
 * Ranking Snapshot Service
 * Manages historical snapshots of leaderboard for tracking position changes
 */

import { collection, getDocs, setDoc, doc, query, orderBy, limit, Timestamp } from "firebase/firestore";
import { db } from "./firebase";
import { log, error } from "../utils/logger";

/**
 * Saves current ranking snapshot to history
 * @param {string} type - Snapshot type: "race" or "championship"
 * @param {string} raceId - Race ID (optional, only for type="race")
 * @returns {Promise<string>} Snapshot ID
 */
export async function saveRankingSnapshot(type = "race", raceId = null) {
  try {
    const rankingQuery = query(
      collection(db, "ranking"),
      orderBy("puntiTotali", "desc")
    );
    const rankingSnap = await getDocs(rankingQuery);

    const snapshot = rankingSnap.docs.map((doc, index) => ({
      userId: doc.id,
      name: doc.data().name,
      position: index + 1,
      points: doc.data().puntiTotali,
      jolly: doc.data().jolly ?? 0,
    }));

    const timestamp = Date.now();
    const snapshotId = `snapshot_${timestamp}`;

    await setDoc(doc(db, "rankingHistory", snapshotId), {
      snapshot,
      createdAt: Timestamp.now(),
      type,
      raceId: raceId || null,
    });

    log(`✅ Ranking snapshot saved: ${snapshotId}`);
    return snapshotId;
  } catch (err) {
    error("❌ Error saving ranking snapshot:", err);
    throw err;
  }
}

/**
 * Retrieves the most recent ranking snapshot
 * @returns {Promise<Object|null>} Snapshot object or null if none exists
 */
export async function getLastRankingSnapshot() {
  try {
    const historyQuery = query(
      collection(db, "rankingHistory"),
      orderBy("createdAt", "desc"),
      limit(1)
    );
    const historySnap = await getDocs(historyQuery);

    if (historySnap.empty) {
      return null;
    }

    const lastDoc = historySnap.docs[0];
    return {
      id: lastDoc.id,
      ...lastDoc.data(),
    };
  } catch (err) {
    error("❌ Error fetching last snapshot:", err);
    return null;
  }
}

/**
 * Calculates position change between current and previous snapshot
 * @param {string} userId - User ID
 * @param {number} currentPosition - Current position in ranking
 * @param {Array} previousSnapshot - Previous snapshot array
 * @returns {number} Positions gained (positive) or lost (negative), 0 if unchanged or no snapshot
 */
export function calculatePositionChange(userId, currentPosition, previousSnapshot) {
  if (!previousSnapshot || !Array.isArray(previousSnapshot)) {
    return 0;
  }

  const previousEntry = previousSnapshot.find(entry => entry.userId === userId);

  if (!previousEntry) {
    return 0;
  }

  return previousEntry.position - currentPosition;
}
