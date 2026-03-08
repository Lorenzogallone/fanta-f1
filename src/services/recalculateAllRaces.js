/**
 * @file recalculateAllRaces.js
 * @description Utility to recalculate points for all races that have official results.
 * Resets ranking totals and recomputes everything from scratch using the fixed scoring logic.
 * Can be called from the admin panel or browser console.
 */

import {
  collection,
  getDocs,
  doc,
  updateDoc,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "./firebase";
import { calculatePointsForRace } from "./pointsCalculator";

/**
 * Recalculates points for all races that have been calculated.
 * Resets pointsByRace and puntiTotali for all users before recalculating.
 * @returns {Promise<string>} Summary of recalculation
 */
export async function recalculateAllRaces() {
  // Step 1: Reset all ranking pointsByRace and puntiTotali to clean state
  const rankingSnap = await getDocs(collection(db, "ranking"));
  const resetWrites = [];

  for (const userDoc of rankingSnap.docs) {
    resetWrites.push(
      updateDoc(doc(db, "ranking", userDoc.id), {
        pointsByRace: {},
        puntiTotali: 0,
        // Reset jolly earned from 30-point bonuses (keep initial jolly count at 0)
        jolly: 0,
      })
    );
  }
  await Promise.all(resetWrites);

  // Step 2: Get all races ordered by date
  const racesSnap = await getDocs(
    query(collection(db, "races"), orderBy("raceUTC", "asc"))
  );

  const results = [];

  // Step 3: Recalculate each race that has official results
  for (const raceDoc of racesSnap.docs) {
    const raceData = raceDoc.data();

    if (!raceData.officialResults || raceData.cancelledMain) {
      continue; // Skip races without results or cancelled
    }

    const { P1, P2, P3 } = raceData.officialResults;
    if (!P1 || !P2 || !P3) continue; // Skip incomplete results

    try {
      const msg = await calculatePointsForRace(raceDoc.id);
      results.push(`${raceData.name}: ${msg}`);
    } catch (err) {
      results.push(`${raceData.name}: ERRORE - ${err.message}`);
    }
  }

  return `Ricalcolo completato per ${results.length} gare:\n${results.join("\n")}`;
}
