/**
 * @file championshipDeadline.js
 * @description Utility to calculate the championship formation deadline
 * based on the mid-season race. Reused across ChampionshipForm, ParticipantDetail, and Statistics.
 * Admin can override the deadline via the config/championship Firestore document.
 */
import { collection, query, orderBy, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "../services/firebase";

/**
 * Calculate the auto deadline from the mid-season race (no override check).
 * @returns {Promise<number|null>} Deadline timestamp in ms, or null if unable to determine
 */
export async function getChampionshipDeadlineAutoMs() {
  try {
    const racesQuery = query(collection(db, "races"), orderBy("round", "asc"));
    const racesSnap = await getDocs(racesQuery);
    const races = racesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    if (races.length === 0) return null;

    // Mid-season race: by position in the calendar (robust to gaps in rounds)
    const midRace = races[Math.ceil(races.length / 2) - 1];

    return midRace?.raceUTC ? midRace.raceUTC.toDate().getTime() : null;
  } catch {
    return null;
  }
}

/**
 * Get the effective championship deadline in milliseconds.
 * Checks for an admin override in config/championship first,
 * then falls back to the auto-calculated mid-season deadline.
 * @returns {Promise<number|null>} Deadline timestamp in ms, or null if unable to determine
 */
export async function getChampionshipDeadlineMs() {
  try {
    const configSnap = await getDoc(doc(db, "config", "championship"));
    if (configSnap.exists()) {
      const { deadlineOverride } = configSnap.data();
      if (deadlineOverride) return deadlineOverride.toDate().getTime();
    }
    return getChampionshipDeadlineAutoMs();
  } catch {
    return null;
  }
}
