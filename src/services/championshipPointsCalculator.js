/**
 * @file Championship points calculator service
 * Calculates and updates championship points for drivers and constructors
 */

import {
  increment,
  collection,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "../services/firebase";
import { POINTS } from "../constants/racing";
import { commitWrites } from "./pointsCalculator";

// Point values imported from centralized constants
const PTS_MAIN = POINTS.MAIN;

/**
 * Championship points for one player's picks.
 * @param {string[]} pilotiPicks - [D1, D2, D3]
 * @param {string[]} costruttoriPicks - [C1, C2, C3]
 * @param {Object} results - { P1, P2, P3, C1, C2, C3 }
 * @returns {{ total: number, jollyBonus: number }}
 */
function scoreChampionship(pilotiPicks, costruttoriPicks, results) {
  const { P1, P2, P3, C1, C2, C3 } = results;

  // DRIVER points (without jolly bonus)
  let pilotiPoints = 0;
  if (pilotiPicks[0] === P1) pilotiPoints += PTS_MAIN[1]; // 12 points
  if (pilotiPicks[1] === P2) pilotiPoints += PTS_MAIN[2]; // 10 points
  if (pilotiPicks[2] === P3) pilotiPoints += PTS_MAIN[3]; //  7 points

  // CONSTRUCTOR points (same scoring as drivers)
  let costruttoriPoints = 0;
  if (costruttoriPicks[0] === C1) costruttoriPoints += PTS_MAIN[1];
  if (costruttoriPicks[1] === C2) costruttoriPoints += PTS_MAIN[2];
  if (costruttoriPicks[2] === C3) costruttoriPoints += PTS_MAIN[3];

  // Special rule: perfect prediction (29 points) → becomes 30 + an extra jolly
  let jollyBonus = 0;
  if (pilotiPoints === 29) {
    pilotiPoints += 1;
    jollyBonus += 1;
  }
  if (costruttoriPoints === 29) {
    costruttoriPoints += 1;
    jollyBonus += 1;
  }

  return { total: pilotiPoints + costruttoriPoints, jollyBonus };
}

/**
 * Calculates championship points for all users based on driver and constructor picks.
 * Updates ranking/{userId}.championshipPts and puntiTotali. The new results (if
 * passed) are saved in the same batch as the points (all-or-nothing).
 * @param {Object} [newResults] - { P1, P2, P3, C1, C2, C3, ... } to save
 * @returns {Promise<string>} Success message with number of updated users
 */
export async function calculateChampionshipPoints(newResults = null) {
  // Step 1: Retrieve official championship results (P1-P3 drivers + C1-C3 constructors)
  const officialRef = doc(db, "championship", "results");
  const officialSnap = await getDoc(officialRef);
  const previousResults = officialSnap.exists() ? officialSnap.data() : null;
  const results = { ...(previousResults || {}), ...(newResults || {}) };
  if (!previousResults && !newResults) throw new Error("Risultati campionato non trovati");

  const { P1, P2, P3, C1, C2, C3 } = results;

  // Validate both driver and constructor results are present
  if (!P1 || !P2 || !P3) {
    throw new Error("Risultati piloti incompleti");
  }
  if (!C1 || !C2 || !C3) {
    throw new Error("Risultati costruttori incompleti");
  }

  // Step 2: Load all users from ranking collection
  const usersSnap = await getDocs(collection(db, "ranking"));
  const writes = [];
  if (newResults) {
    writes.push((b) => b.set(officialRef, newResults, { merge: true }));
  }

  for (const userDoc of usersSnap.docs) {
    const userId = userDoc.id;
    const data = userDoc.data();

    const pilotiPicks = data.championshipPiloti ?? [];      // [D1, D2, D3]
    const costruttoriPicks = data.championshipCostruttori ?? []; // [C1, C2, C3]

    const { total: totalChampionshipPoints, jollyBonus } =
      scoreChampionship(pilotiPicks, costruttoriPicks, results);

    // Step 6: Calculate delta from previous points
    const prevPts = data.championshipPts ?? 0;
    const delta = totalChampionshipPoints - prevPts;

    // Step 7: Prepare ranking update (include jolly if applicable)
    const updateData = {
      championshipPts: totalChampionshipPoints,
      championshipJollyAwarded: jollyBonus,
      puntiTotali: increment(delta),
    };

    // Jolly bonus: on a recalculation only the difference is applied. For data
    // saved before this field existed, the previous bonus comes from the
    // previous results (if points had already been assigned).
    const legacyBonus = previousResults && data.championshipPts
      ? scoreChampionship(pilotiPicks, costruttoriPicks, previousResults).jollyBonus
      : 0;
    const prevJollyBonus = data.championshipJollyAwarded ?? legacyBonus;
    const jollyDelta = jollyBonus - prevJollyBonus;
    if (jollyDelta !== 0) {
      updateData.jolly = increment(jollyDelta);
    }

    writes.push((b) => b.update(doc(db, "ranking", userId), updateData));
  }

  // Step 8: Execute all updates in parallel
  await commitWrites(writes); // all-or-nothing
  return `✔️ Punteggi campionato aggiornati per ${usersSnap.size} utenti (piloti + costruttori).`;
}