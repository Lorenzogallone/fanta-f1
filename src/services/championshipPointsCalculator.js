/**
 * @file Championship points calculator service
 * Calculates and updates championship points for drivers and constructors
 */

import {
  updateDoc,
  increment,
  collection,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "../services/firebase";
import { POINTS } from "../constants/racing";

// Point values imported from centralized constants
const PTS_MAIN = POINTS.MAIN;

/**
 * Calculates championship points for all users based on driver and constructor picks
 * Updates ranking/{userId}.championshipPts and increments puntiTotali
 * @returns {Promise<string>} Success message with number of updated users
 */
export async function calculateChampionshipPoints() {
  // Step 1: Retrieve official championship results (P1-P3 drivers + C1-C3 constructors)
  const officialRef = doc(db, "championship", "results");
  const officialSnap = await getDoc(officialRef);
  if (!officialSnap.exists()) throw new Error("Risultati campionato non trovati");

  const { P1, P2, P3, C1, C2, C3 } = officialSnap.data();

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

  for (const userDoc of usersSnap.docs) {
    const userId = userDoc.id;
    const data = userDoc.data();

    const pilotiPicks = data.championshipPiloti ?? [];      // [D1, D2, D3]
    const costruttoriPicks = data.championshipCostruttori ?? []; // [C1, C2, C3]

    // Step 3: Calculate DRIVER points (without jolly bonus)
    let pilotiPoints = 0;
    if (pilotiPicks[0] === P1) pilotiPoints += PTS_MAIN[1]; // 12 points
    if (pilotiPicks[1] === P2) pilotiPoints += PTS_MAIN[2]; // 10 points
    if (pilotiPicks[2] === P3) pilotiPoints += PTS_MAIN[3]; //  7 points

    // Step 4: Calculate CONSTRUCTOR points (same scoring as drivers)
    let costruttoriPoints = 0;
    if (costruttoriPicks[0] === C1) costruttoriPoints += PTS_MAIN[1]; // 12 points
    if (costruttoriPicks[1] === C2) costruttoriPoints += PTS_MAIN[2]; // 10 points
    if (costruttoriPicks[2] === C3) costruttoriPoints += PTS_MAIN[3]; //  7 points

    // Special rule: 29 points becomes 30 + extra jolly for DRIVERS
    let jollyBonus = 0;
    if (pilotiPoints === 29) {
      pilotiPoints += 1;      // 29 becomes 30
      jollyBonus += 1;        // +1 accumulated jolly
    }

    // Special rule: 29 points becomes 30 + extra jolly for CONSTRUCTORS
    if (costruttoriPoints === 29) {
      costruttoriPoints += 1;  // 29 becomes 30
      jollyBonus += 1;         // +1 accumulated jolly
    }

    // Step 5: Total championship points (drivers + constructors)
    const totalChampionshipPoints = pilotiPoints + costruttoriPoints;

    // Step 6: Calculate delta from previous points
    const prevPts = data.championshipPts ?? 0;
    const delta = totalChampionshipPoints - prevPts;

    // Step 7: Prepare ranking update (include jolly if applicable)
    const updateData = {
      championshipPts: totalChampionshipPoints,
      puntiTotali: increment(delta),
    };

    // Add jolly bonus if applicable
    if (jollyBonus > 0) {
      updateData.jolly = increment(jollyBonus);
    }

    writes.push(
      updateDoc(doc(db, "ranking", userId), updateData)
    );
  }

  // Step 8: Execute all updates in parallel
  await Promise.all(writes);
  return `✔️ Punteggi campionato aggiornati per ${usersSnap.size} utenti (piloti + costruttori).`;
}