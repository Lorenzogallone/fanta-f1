// src/services/statisticsService.js
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "./firebase";
import { POINTS } from "../constants/racing";

/**
 * Recupera i dati storici delle gare con i punti di ogni giocatore
 * @returns {Promise<Object>} Oggetto con:
 *   - races: array delle gare con id, name, round, date
 *   - playersData: oggetto con userId -> array di {raceId, points, cumulativePoints, position}
 *   - playerNames: oggetto con userId -> nome giocatore
 */
export async function getChampionshipStatistics() {
  try {
    // 1. Recupera tutte le gare ordinate per data
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

    // 2. Recupera i nomi dei giocatori dal ranking
    const rankingSnap = await getDocs(collection(db, "ranking"));
    const playerNames = {};
    const playerPoints = {}; // Punti cumulativi per giocatore

    rankingSnap.docs.forEach(doc => {
      playerNames[doc.id] = doc.data().name;
      playerPoints[doc.id] = 0; // Inizializza a 0
    });

    // 3. Per ogni gara, recupera le submissions e calcola i punti
    const playersData = {};
    const playersHistory = {}; // Storia completa per ogni giocatore

    for (const race of races) {
      // Salta le gare cancellate
      if (race.cancelledMain) {
        continue;
      }

      const submissionsSnap = await getDocs(
        collection(db, "races", race.id, "submissions")
      );

      const racePoints = {}; // Punti ottenuti in questa gara per ogni giocatore

      submissionsSnap.docs.forEach(doc => {
        const data = doc.data();
        const userId = doc.id;
        const official = race.officialResults;

        if (!official) {
          racePoints[userId] = 0;
          return;
        }

        // Calcola i punti per la gara principale
        let mainPoints = 0;
        if (!data.mainP1 && !data.mainP2 && !data.mainP3) {
          mainPoints = -3; // Penalità per non aver inviato la formazione
        } else {
          if (data.mainP1 === official.P1) mainPoints += POINTS.MAIN[1];
          if (data.mainP2 === official.P2) mainPoints += POINTS.MAIN[2];
          if (data.mainP3 === official.P3) mainPoints += POINTS.MAIN[3];

          // Jolly 1
          if (data.mainJolly && [official.P1, official.P2, official.P3].includes(data.mainJolly)) {
            mainPoints += POINTS.BONUS_JOLLY_MAIN;
          }

          // Jolly 2
          if (data.mainJolly2 && [official.P1, official.P2, official.P3].includes(data.mainJolly2)) {
            mainPoints += POINTS.BONUS_JOLLY_MAIN;
          }

          // Penalità per ritardo
          if (data.isLate) {
            mainPoints += (data.latePenalty || -3);
          }
        }

        // Calcola i punti per la sprint (se presente e non cancellata)
        let sprintPoints = 0;
        if (official.SP1 && !race.cancelledSprint) {
          if (!data.sprintP1 && !data.sprintP2 && !data.sprintP3) {
            sprintPoints = -3;
          } else {
            if (data.sprintP1 === official.SP1) sprintPoints += POINTS.SPRINT[1];
            if (data.sprintP2 === official.SP2) sprintPoints += POINTS.SPRINT[2];
            if (data.sprintP3 === official.SP3) sprintPoints += POINTS.SPRINT[3];

            // Jolly sprint
            if (data.sprintJolly && [official.SP1, official.SP2, official.SP3].includes(data.sprintJolly)) {
              sprintPoints += POINTS.BONUS_JOLLY_SPRINT;
            }
          }
        }

        // Punti doppi per l'ultima gara
        let totalPoints = mainPoints + sprintPoints;
        if (official.doublePoints) {
          totalPoints *= 2;
        }

        racePoints[userId] = totalPoints;
      });

      // Aggiorna i punti cumulativi e aggiungi alla storia
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

    // 4. Calcola le posizioni per ogni gara
    const racesWithPositions = races
      .filter(r => !r.cancelledMain && r.officialResults)
      .map(race => {
        // Per ogni gara, crea un array di giocatori con i loro punti cumulativi fino a quella gara
        const playersAtThisRace = Object.keys(playerNames).map(userId => {
          const history = playersHistory[userId] || [];
          const raceIndex = history.findIndex(h => h.raceId === race.id);
          const cumulativePoints = raceIndex >= 0 ? history[raceIndex].cumulativePoints : 0;
          return {
            userId,
            cumulativePoints,
          };
        });

        // Ordina per punti decrescenti
        playersAtThisRace.sort((a, b) => b.cumulativePoints - a.cumulativePoints);

        // Assegna le posizioni
        const positions = {};
        playersAtThisRace.forEach((player, index) => {
          positions[player.userId] = index + 1;
        });

        return {
          raceId: race.id,
          positions,
        };
      });

    // 5. Aggiungi le posizioni alla storia dei giocatori
    Object.keys(playersHistory).forEach(userId => {
      playersHistory[userId].forEach(entry => {
        const racePositions = racesWithPositions.find(r => r.raceId === entry.raceId);
        if (racePositions) {
          entry.position = racePositions.positions[userId];
        }
      });
    });

    // 6. Prepara i dati per il return
    Object.keys(playersHistory).forEach(userId => {
      playersData[userId] = playersHistory[userId];
    });

    return {
      races: races.filter(r => !r.cancelledMain && r.officialResults),
      playersData,
      playerNames,
    };
  } catch (error) {
    console.error("Errore nel recupero delle statistiche:", error);
    throw error;
  }
}
