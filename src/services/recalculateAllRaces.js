/**
 * @file recalculateAllRaces.js
 * @description Utility to recalculate points for all races that have official results.
 * Recomputes every race with the current scoring logic and refreshes ranking totals.
 * Can be called from the admin panel or browser console.
 */

import {
  collection,
  getDocs,
  increment,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "./firebase";
import { calculatePointsForRace, commitWrites } from "./pointsCalculator";

/**
 * Whether a race has complete official results and must be counted.
 * @param {Object} raceData
 * @returns {boolean}
 */
function isCountable(raceData) {
  const { P1, P2, P3 } = raceData.officialResults || {};
  return !raceData.cancelledMain && Boolean(P1 && P2 && P3);
}

/**
 * Recalculates points for all races that have been calculated.
 *
 * Every countable race is recalculated (which also refreshes puntiTotali).
 * Entries of races that no longer count (results removed, race cancelled or
 * deleted) are dropped first. Jolly counts are NOT reset: the jolly earned with
 * a perfect podium is tracked per race, so only real changes are applied and
 * starting/used jollies are preserved.
 * @returns {Promise<string>} Summary of recalculation
 */
export async function recalculateAllRaces() {
  // Step 1: Get all races ordered by date
  const racesSnap = await getDocs(
    query(collection(db, "races"), orderBy("raceUTC", "asc"))
  );
  const countable = new Set(
    racesSnap.docs.filter((d) => isCountable(d.data())).map((d) => d.id)
  );

  // Step 2: Drop entries of races that no longer count and refresh totals
  const rankingSnap = await getDocs(collection(db, "ranking"));
  const resetWrites = [];

  for (const userDoc of rankingSnap.docs) {
    const data = userDoc.data();
    const oldPB = data.pointsByRace || {};
    const keptPB = {};
    let revokedJolly = 0;
    for (const [raceId, entry] of Object.entries(oldPB)) {
      if (countable.has(raceId)) keptPB[raceId] = entry;
      else if (entry?.perfectPodium === true) revokedJolly++;
    }
    const total = Object.values(keptPB).reduce(
      (sum, { mainPts: m = 0, sprintPts: sp = 0 }) => sum + m + sp,
      0
    ) + (data.championshipPts || 0);

    resetWrites.push((b) => b.update(userDoc.ref, {
      pointsByRace: keptPB,
      puntiTotali: total,
      ...(revokedJolly > 0 ? { jolly: increment(-revokedJolly) } : {}),
    }));
  }
  await commitWrites(resetWrites);

  const results = [];

  // Step 3: Recalculate each race that has official results
  for (const raceDoc of racesSnap.docs) {
    const raceData = raceDoc.data();

    if (!countable.has(raceDoc.id)) continue; // no results, incomplete or cancelled

    try {
      const msg = await calculatePointsForRace(raceDoc.id);
      results.push(`${raceData.name}: ${msg}`);
    } catch (err) {
      results.push(`${raceData.name}: ERRORE - ${err.message}`);
    }
  }

  return `Ricalcolo completato per ${results.length} gare:\n${results.join("\n")}`;
}
