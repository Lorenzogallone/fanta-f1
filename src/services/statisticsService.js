/**
 * Statistics Service
 * Fetches and calculates historical championship statistics for all players
 */

import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "./firebase";
import { POINTS } from "../constants/racing";
import { error } from "../utils/logger";

/**
 * Retrieves historical race data with cumulative points and positions for each player
 * @returns {Promise<Object>} Object containing races array, playersData object, and playerNames object
 */
export async function getChampionshipStatistics() {
  try {
    // Fetch all races ordered by date
    const racesSnap = await getDocs(
      query(collection(db, "races"), orderBy("raceUTC", "asc"))
    );
    const races = racesSnap.docs.map(doc => ({
      id: doc.id,
      name: doc.data().name,
      round: doc.data().round,
      date: doc.data().raceUTC.toDate(),
      officialResults: doc.data().officialResults,
      cancelledMain: doc.data().cancelledMain || false,
      cancelledSprint: doc.data().cancelledSprint || false,
    }));

    // Fetch player names from ranking collection
    const rankingSnap = await getDocs(collection(db, "ranking"));
    const playerNames = {};
    const playerPoints = {};

    rankingSnap.docs.forEach(doc => {
      playerNames[doc.id] = doc.data().name;
      playerPoints[doc.id] = 0;
    });

    // Calculate points for each race submission - OPTIMIZED with parallel fetching
    const playersData = {};
    const playersHistory = {};

    // Fetch all submissions in parallel for better performance
    const submissionsPromises = races
      .filter(race => !race.cancelledMain)
      .map(race =>
        getDocs(collection(db, "races", race.id, "submissions"))
          .then(snap => ({ raceId: race.id, snapshot: snap }))
          .catch(err => {
            error(`Error fetching submissions for ${race.id}:`, err);
            return { raceId: race.id, snapshot: null };
          })
      );

    const allSubmissions = await Promise.all(submissionsPromises);
    const submissionsMap = {};
    allSubmissions.forEach(({ raceId, snapshot }) => {
      submissionsMap[raceId] = snapshot;
    });

    for (const race of races) {
      if (race.cancelledMain) {
        continue;
      }

      const submissionsSnap = submissionsMap[race.id];
      if (!submissionsSnap) {
        continue;
      }

      const racePoints = {};

      submissionsSnap.docs.forEach(doc => {
        const data = doc.data();
        const userId = doc.id;
        const official = race.officialResults;

        if (!official) {
          racePoints[userId] = 0;
          return;
        }

        // Calculate main race points
        let mainPoints = 0;
        if (!data.mainP1 && !data.mainP2 && !data.mainP3) {
          mainPoints = -3;
        } else {
          if (data.mainP1 === official.P1) mainPoints += POINTS.MAIN[1];
          if (data.mainP2 === official.P2) mainPoints += POINTS.MAIN[2];
          if (data.mainP3 === official.P3) mainPoints += POINTS.MAIN[3];

          // Joker 1 bonus
          if (data.mainJolly && [official.P1, official.P2, official.P3].includes(data.mainJolly)) {
            mainPoints += POINTS.BONUS_JOLLY_MAIN;
          }

          // Joker 2 bonus
          if (data.mainJolly2 && [official.P1, official.P2, official.P3].includes(data.mainJolly2)) {
            mainPoints += POINTS.BONUS_JOLLY_MAIN;
          }

          // Late submission penalty
          if (data.isLate) {
            mainPoints += (data.latePenalty || -3);
          }
        }

        // Calculate sprint points if present and not cancelled
        let sprintPoints = 0;
        if (official.SP1 && !race.cancelledSprint) {
          if (!data.sprintP1 && !data.sprintP2 && !data.sprintP3) {
            sprintPoints = -3;
          } else {
            if (data.sprintP1 === official.SP1) sprintPoints += POINTS.SPRINT[1];
            if (data.sprintP2 === official.SP2) sprintPoints += POINTS.SPRINT[2];
            if (data.sprintP3 === official.SP3) sprintPoints += POINTS.SPRINT[3];

            // Sprint joker bonus
            if (data.sprintJolly && [official.SP1, official.SP2, official.SP3].includes(data.sprintJolly)) {
              sprintPoints += POINTS.BONUS_JOLLY_SPRINT;
            }
          }
        }

        // Double points for last race
        let totalPoints = mainPoints + sprintPoints;
        if (official.doublePoints) {
          totalPoints *= 2;
        }

        racePoints[userId] = totalPoints;
      });

      // Update cumulative points and add to history
      Object.keys(playerNames).forEach(userId => {
        if (!playersHistory[userId]) {
          playersHistory[userId] = [];
        }

        const pointsThisRace = racePoints[userId] || 0;
        playerPoints[userId] += pointsThisRace;

        playersHistory[userId].push({
          raceId: race.id,
          raceName: race.name,
          raceRound: race.round,
          raceDate: race.date,
          points: pointsThisRace,
          cumulativePoints: playerPoints[userId],
        });
      });
    }

    // Calculate positions for each race
    const racesWithPositions = races
      .filter(r => !r.cancelledMain && r.officialResults)
      .map(race => {
        const playersAtThisRace = Object.keys(playerNames).map(userId => {
          const history = playersHistory[userId] || [];
          const raceIndex = history.findIndex(h => h.raceId === race.id);
          const cumulativePoints = raceIndex >= 0 ? history[raceIndex].cumulativePoints : 0;
          return {
            userId,
            cumulativePoints,
          };
        });

        playersAtThisRace.sort((a, b) => b.cumulativePoints - a.cumulativePoints);

        const positions = {};
        playersAtThisRace.forEach((player, index) => {
          positions[player.userId] = index + 1;
        });

        return {
          raceId: race.id,
          positions,
        };
      });

    // Add positions to player history
    Object.keys(playersHistory).forEach(userId => {
      playersHistory[userId].forEach(entry => {
        const racePositions = racesWithPositions.find(r => r.raceId === entry.raceId);
        if (racePositions) {
          entry.position = racePositions.positions[userId];
        }
      });
    });

    // Prepare data for return
    Object.keys(playersHistory).forEach(userId => {
      playersData[userId] = playersHistory[userId];
    });

    return {
      races: races.filter(r => !r.cancelledMain && r.officialResults),
      playersData,
      playerNames,
    };
  } catch (err) {
    error("Error fetching championship statistics:", err);
    throw err;
  }
}
