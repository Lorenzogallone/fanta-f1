/**
 * Statistics Service
 * Fetches and calculates historical championship statistics for all players
 */

import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "./firebase";
import { error } from "../utils/logger";

/** Id of the synthetic "end of season" step holding championship points. */
export const CHAMPIONSHIP_STEP_ID = "__championship__";

/**
 * Total points a player earned in a race, as stored by the points calculator.
 * @param {Object} pointsByRace - ranking.pointsByRace map
 * @param {string} raceId
 * @returns {number}
 */
function racePointsFor(pointsByRace, raceId) {
  const entry = pointsByRace?.[raceId];
  if (!entry) return 0;
  return (entry.mainPts || 0) + (entry.sprintPts || 0);
}

/**
 * Assigns competition-style positions (ties share the same position, the
 * next one skips: 1, 2, 2, 4) — same logic as the leaderboard.
 * @param {Array<{userId: string, points: number}>} entries
 * @returns {Object<string, number>} userId → position
 */
export function assignPositions(entries) {
  const sorted = [...entries].sort((a, b) => b.points - a.points);
  const positions = {};
  let pos = 1;
  sorted.forEach((entry, i) => {
    if (i > 0 && entry.points < sorted[i - 1].points) pos = i + 1;
    positions[entry.userId] = pos;
  });
  return positions;
}

/**
 * Retrieves historical race data with cumulative points and positions for each player.
 *
 * Points come from `ranking.pointsByRace`, the same values that make up
 * `puntiTotali`, so the charts always agree with the leaderboard (perfect
 * podium bonus, missing-lineup penalties, late penalties, double points…).
 * Only races that have actually been calculated are included. Once the
 * end-of-season championship points (driver/constructor lineups) have been
 * assigned, they are appended as a final step (`isChampionship: true`), so the
 * last point of every chart matches the leaderboard total.
 *
 * @returns {Promise<Object>} Object containing races array, playersData object, and playerNames object
 */
export async function getChampionshipStatistics() {
  try {
    const [racesSnap, rankingSnap] = await Promise.all([
      getDocs(query(collection(db, "races"), orderBy("raceUTC", "asc"))),
      getDocs(collection(db, "ranking")),
    ]);

    const playerNames = {};
    const pointsByPlayer = {};
    const championshipPts = {};
    rankingSnap.docs.forEach((d) => {
      playerNames[d.id] = d.data().name;
      pointsByPlayer[d.id] = d.data().pointsByRace || {};
      championshipPts[d.id] = d.data().championshipPts || 0;
    });
    const userIds = Object.keys(playerNames);

    // Races that have been calculated for at least one player, in date order
    const races = racesSnap.docs
      .filter((d) => !d.data().cancelledMain)
      .filter((d) => userIds.some((uid) => pointsByPlayer[uid][d.id]))
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          name: data.name,
          round: data.round,
          label: `R${data.round}`,
          date: data.raceUTC?.toDate?.() ?? null,
          officialResults: data.officialResults,
          cancelledMain: false,
          cancelledSprint: data.cancelledSprint || false,
        };
      });

    const playersData = {};
    const cumulative = {};
    userIds.forEach((uid) => {
      playersData[uid] = [];
      cumulative[uid] = 0;
    });

    // End-of-season championship points, shown as a final step once assigned
    if (userIds.some((uid) => championshipPts[uid] !== 0)) {
      races.push({
        id: CHAMPIONSHIP_STEP_ID,
        name: null, // translated by the UI
        round: null,
        label: "🏆",
        date: null,
        isChampionship: true,
      });
    }

    for (const race of races) {
      userIds.forEach((uid) => {
        const points = race.isChampionship
          ? championshipPts[uid]
          : racePointsFor(pointsByPlayer[uid], race.id);
        cumulative[uid] += points;
        playersData[uid].push({
          raceId: race.id,
          raceName: race.name,
          raceRound: race.round,
          raceLabel: race.label,
          isChampionship: !!race.isChampionship,
          raceDate: race.date,
          points,
          cumulativePoints: cumulative[uid],
        });
      });

      const positions = assignPositions(
        userIds.map((uid) => ({ userId: uid, points: cumulative[uid] }))
      );
      userIds.forEach((uid) => {
        playersData[uid][playersData[uid].length - 1].position = positions[uid];
      });
    }

    return { races, playersData, playerNames };
  } catch (err) {
    error("Error fetching championship statistics:", err);
    throw err;
  }
}
