/**
 * @file Race points calculator service
 * Calculates and persists points for main and sprint races with bonus logic
 */

import {
  updateDoc,
  setDoc,
  increment,
  collection,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "../services/firebase";
import { POINTS } from "../constants/racing";

/**
 * Checks if a race is the last race in the calendar
 * @param {Array} racesArr - Array of race objects
 * @param {string} raceId - Race identifier
 * @returns {boolean} True if this is the last race
 */
export function isLastRace(racesArr, raceId) {
  if (!racesArr?.length || !raceId) return false;
  const maxRound = Math.max(...racesArr.map((r) => r.round));
  return racesArr.find((r) => r.id === raceId)?.round === maxRound;
}

// Point constants imported from centralized file
const PTS_MAIN = POINTS.MAIN;
const PTS_SPRINT = POINTS.SPRINT;
const BONUS_JOLLY_MAIN = POINTS.BONUS_JOLLY_MAIN;
const BONUS_JOLLY_SPRINT = POINTS.BONUS_JOLLY_SPRINT;
const PENALTY_EMPTY_LIST = POINTS.PENALTY_EMPTY_LIST;

/**
 * Calculates and persists points for a race based on official results
 * @param {string} raceId - Race identifier
 * @param {Object} official - Official results object with P1-P3, SP1-SP3, doublePoints
 * @returns {Promise<string>} Success message with number of updated submissions
 */
export async function calculatePointsForRace(raceId, official) {
  // Step 1: Save/update official race results
  // If official results are passed from frontend, update Firestore
  if (official) {
    await setDoc(
      doc(db, "races", raceId),
      { officialResults: official },
      { merge: true }
    );
  }

  // Step 2: Retrieve final results and validate
  const raceRef  = doc(db, "races", raceId);
  const raceSnap = await getDoc(raceRef);
  if (!raceSnap.exists()) throw new Error("Gara non trovata");

  const raceData = raceSnap.data();
  const {
    P1, P2, P3,
    SP1 = null, SP2 = null, SP3 = null,
    doublePoints = false,
  } = raceData.officialResults ?? {};

  // Skip cancelled races
  const cancelledMain = raceData.cancelledMain || false;
  const cancelledSprint = raceData.cancelledSprint || false;

  if (cancelledMain) {
    throw new Error("⛔ Gara cancellata: il calcolo punti è disabilitato.");
  }

  if (!P1 || !P2 || !P3)
    throw new Error("Risultati ufficiali incompleti (manca il podio).");

  const sprintPresent = !!SP1 && !cancelledSprint;

  // Step 3: Iterate through all submissions
  const subsSnap = await getDocs(
    collection(db, "races", raceId, "submissions")
  );

  const batchWrites = [];

  for (const subDoc of subsSnap.docs) {
    const s      = subDoc.data();
    const userId = subDoc.id;

    // Calculate MAIN race points
    let mainPts;
    if (!s.mainP1) {
      mainPts = PENALTY_EMPTY_LIST;
    } else {
      mainPts = 0;
      if (s.mainP1 === P1) mainPts += PTS_MAIN[1];
      if (s.mainP2 === P2) mainPts += PTS_MAIN[2];
      if (s.mainP3 === P3) mainPts += PTS_MAIN[3];

      const podio = [P1, P2, P3];
      if (s.mainJolly  && podio.includes(s.mainJolly )) mainPts += BONUS_JOLLY_MAIN;
      if (s.mainJolly2 && podio.includes(s.mainJolly2)) mainPts += BONUS_JOLLY_MAIN;
    }

    // Apply late submission penalty
    if (s.isLate && s.latePenalty) {
      mainPts += s.latePenalty; // -3
    }

    // Calculate SPRINT race points
    let sprintPts = 0;
    if (sprintPresent && !cancelledSprint) {
      if (!s.sprintP1) {
        sprintPts = PENALTY_EMPTY_LIST;
      } else {
        if (s.sprintP1 === SP1) sprintPts += PTS_SPRINT[1];
        if (s.sprintP2 === SP2) sprintPts += PTS_SPRINT[2];
        if (s.sprintP3 === SP3) sprintPts += PTS_SPRINT[3];

        const sprintPodio = [SP1, SP2, SP3];
        if (s.sprintJolly && sprintPodio.includes(s.sprintJolly))
          sprintPts += BONUS_JOLLY_SPRINT;
      }
    }

    // Special rule: 29 points becomes 30 + extra jolly
    if (mainPts === 29) {
      mainPts += 1;
      batchWrites.push(
        updateDoc(doc(db, "ranking", userId), { jolly: increment(1) })
      );
    }

    // Double points multiplier for final race
    if (doublePoints) {
      mainPts   *= 2;
      sprintPts *= 2;
    }

    // Save points to submission document
    batchWrites.push(
      updateDoc(subDoc.ref, {
        pointsEarned:       mainPts,
        pointsEarnedSprint: sprintPts,
      })
    );

    // Update ranking with complete points map
    const rankRef  = doc(db, "ranking", userId);
    const rankSnap = await getDoc(rankRef);
    const oldPB    = rankSnap.exists() ? rankSnap.data().pointsByRace || {} : {};

    const newPointsByRace = {
      ...oldPB,
      [raceId]: { mainPts, sprintPts },
    };

    const newTotal = Object.values(newPointsByRace).reduce(
      (sum, { mainPts: m = 0, sprintPts: sp = 0 }) => sum + m + sp,
      0
    );

    batchWrites.push(
      updateDoc(rankRef, {
        pointsByRace: newPointsByRace,
        puntiTotali:  newTotal,
      })
    );
  }

  // Step 4: Commit all updates in parallel
  await Promise.all(batchWrites);
  return `✔️ Calcolo completato: aggiornate ${subsSnap.size} submissions e ranking`;
}