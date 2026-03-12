/**
 * @file championshipDeadline.js
 * @description Utility to calculate the championship formation deadline
 * based on the mid-season race. Reused across ChampionshipForm, ParticipantDetail, and Statistics.
 */
import { collection, query, orderBy, getDocs } from "firebase/firestore";
import { db } from "../services/firebase";

/**
 * Calculate the championship deadline in milliseconds.
 * The deadline is the start time of the mid-championship race.
 * @returns {Promise<number|null>} Deadline timestamp in ms, or null if unable to determine
 */
export async function getChampionshipDeadlineMs() {
  try {
    const racesQuery = query(collection(db, "races"), orderBy("round", "asc"));
    const racesSnap = await getDocs(racesQuery);
    const races = racesSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    if (races.length === 0) {
      return new Date("2025-09-07T23:59:00").getTime();
    }

    const midRound = Math.ceil(races.length / 2);
    const midRace = races.find((r) => r.round === midRound);

    if (midRace && midRace.raceUTC) {
      return midRace.raceUTC.toDate().getTime();
    }

    return new Date("2025-09-07T23:59:00").getTime();
  } catch {
    return null;
  }
}
