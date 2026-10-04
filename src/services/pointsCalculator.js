/**
 * @file Race points calculator service
 * Calculates and persists points for main and sprint races with bonus logic
 */

import {
  writeBatch,
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

/** Max writes per Firestore batch (hard limit is 500) */
const MAX_BATCH_WRITES = 450;

/**
 * Commits a list of writes. Up to MAX_BATCH_WRITES they go in a single batch,
 * so the calculation is all-or-nothing: if anything fails, nothing is saved
 * and the ranking is never left half updated.
 * @param {Array<(batch: import("firebase/firestore").WriteBatch) => void>} writes
 */
export async function commitWrites(writes) {
  for (let i = 0; i < writes.length; i += MAX_BATCH_WRITES) {
    const batch = writeBatch(db);
    writes.slice(i, i + MAX_BATCH_WRITES).forEach((write) => write(batch));
    await batch.commit();
  }
}

/**
 * Calculates and persists points for a race based on official results
 * @param {string} raceId - Race identifier
 * @param {Object} official - Official results object with P1-P3, SP1-SP3, doublePoints
 * @returns {Promise<string>} Success message with number of updated submissions
 */
export async function calculatePointsForRace(raceId, official) {
  // All writes are collected here and committed together at the end
  const writes = [];

  // Step 1: Retrieve the race and merge the official results passed from the
  // frontend (saved in the same batch as the points)
  const raceRef  = doc(db, "races", raceId);
  const raceSnap = await getDoc(raceRef);
  if (!raceSnap.exists()) throw new Error("Gara non trovata");

  const raceData = raceSnap.data();
  if (official) {
    raceData.officialResults = { ...(raceData.officialResults || {}), ...official };
  }
  writes.push((b) => b.set(
    raceRef,
    { ...(official ? { officialResults: official } : {}), pointsCalculated: true },
    { merge: true }
  ));

  // Step 2: Validate final results
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
  const [subsSnap, allUsersSnap] = await Promise.all([
    getDocs(collection(db, "races", raceId, "submissions")),
    getDocs(collection(db, "ranking")),
  ]);
  const rankingById = new Map(allUsersSnap.docs.map((d) => [d.id, d]));

  for (const subDoc of subsSnap.docs) {
    const s      = subDoc.data();
    const userId = subDoc.id;

    // Calculate MAIN race points
    let mainPts;
    let perfectPodium = false;
    if (!s.mainP1) {
      mainPts = PENALTY_EMPTY_LIST;
    } else {
      // Calculate base points (position matches only, without jolly)
      let basePts = 0;
      if (s.mainP1 === P1) basePts += PTS_MAIN[1];
      if (s.mainP2 === P2) basePts += PTS_MAIN[2];
      if (s.mainP3 === P3) basePts += PTS_MAIN[3];

      // Special rule: perfect podium (29 base points) → becomes 30 + earn an extra jolly
      // (the jolly is awarded below, only once per race even when recalculated)
      if (basePts === 29) {
        basePts += 1; // 29 → 30
        perfectPodium = true;
      }

      // Add jolly bonuses on top of base points
      mainPts = basePts;
      const podio = [P1, P2, P3];
      if (s.mainJolly  && podio.includes(s.mainJolly )) mainPts += BONUS_JOLLY_MAIN;
      if (s.mainJolly2 && podio.includes(s.mainJolly2)) mainPts += BONUS_JOLLY_MAIN;
    }

    // Late submission penalty for the main race lineup
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

      // Late submission penalty for the sprint lineup (sprint points only)
      if (s.isLateSprint && s.latePenaltySprint) {
        sprintPts += s.latePenaltySprint; // -3
      }
    }

    // Double points multiplier for final race
    if (doublePoints) {
      mainPts   *= 2;
      sprintPts *= 2;
    }

    // Save points to submission document
    writes.push((b) => b.update(subDoc.ref, {
      pointsEarned:       mainPts,
      pointsEarnedSprint: sprintPts,
    }));

    // Update ranking with complete points map
    const rankSnap = rankingById.get(userId);
    // Participant removed from the game: keep the submission, skip the ranking
    if (!rankSnap) continue;
    const rankRef  = rankSnap.ref;
    const oldPB    = rankSnap.data().pointsByRace || {};
    const champPts = rankSnap.data().championshipPts || 0;

    // Perfect podium jolly: award it once per race. On a recalculation only the
    // difference is applied (e.g. results corrected). Entries saved before this
    // flag existed are assumed to have been awarded consistently.
    const prevEntry = oldPB[raceId];
    const prevPerfect = prevEntry ? (prevEntry.perfectPodium ?? perfectPodium) : false;
    const jollyDelta = (perfectPodium ? 1 : 0) - (prevPerfect ? 1 : 0);

    const newPointsByRace = {
      ...oldPB,
      [raceId]: { mainPts, sprintPts, perfectPodium },
    };

    const newTotal = Object.values(newPointsByRace).reduce(
      (sum, { mainPts: m = 0, sprintPts: sp = 0 }) => sum + m + sp,
      0
    ) + champPts; // keep championship points already awarded

    writes.push((b) => b.update(rankRef, {
      pointsByRace: newPointsByRace,
      puntiTotali:  newTotal,
      ...(jollyDelta !== 0 ? { jolly: increment(jollyDelta) } : {}),
    }));
  }

  // Step 4: Apply -3 penalty to users who didn't submit any formation
  const submittedUserIds = new Set(subsSnap.docs.map(d => d.id));

  for (const userDoc of allUsersSnap.docs) {
    const userId = userDoc.id;
    if (submittedUserIds.has(userId)) continue; // already processed

    // User didn't submit: apply -3 penalty for main race
    let mainPts = PENALTY_EMPTY_LIST; // -3
    let sprintPts = sprintPresent ? PENALTY_EMPTY_LIST : 0; // -3 if sprint exists

    if (doublePoints) {
      mainPts   *= 2;
      sprintPts *= 2;
    }

    const oldPB = userDoc.data().pointsByRace || {};
    const champPts = userDoc.data().championshipPts || 0;
    // Lineup removed after a previous calculation with a perfect podium: take
    // back that jolly
    const revokeJolly = oldPB[raceId]?.perfectPodium === true;
    const newPointsByRace = {
      ...oldPB,
      [raceId]: { mainPts, sprintPts, perfectPodium: false },
    };

    const newTotal = Object.values(newPointsByRace).reduce(
      (sum, { mainPts: m = 0, sprintPts: sp = 0 }) => sum + m + sp,
      0
    ) + champPts; // keep championship points already awarded

    writes.push((b) => b.update(userDoc.ref, {
      pointsByRace: newPointsByRace,
      puntiTotali:  newTotal,
      ...(revokeJolly ? { jolly: increment(-1) } : {}),
    }));
  }

  // Step 5: Commit all updates together (all-or-nothing)
  await commitWrites(writes);
  return `✔️ Calcolo completato: aggiornate ${subsSnap.size} submissions e ${allUsersSnap.size} ranking`;
}