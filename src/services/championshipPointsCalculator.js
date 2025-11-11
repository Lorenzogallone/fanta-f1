// src/championshipPointsCalculator.js

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

/* ------------------------------------------------------------------ */
/* Punti definiti (importati da costanti centralizzate)                */
/* ------------------------------------------------------------------ */
const PTS_MAIN = POINTS.MAIN;

/* ------------------------------------------------------------------ */
/* Calcolo completo per la "Championship" (piloti + costruttori)      */
/* Aggiorna ranking/{userId}.championshipPts e incrementa puntiTotali */
/* ------------------------------------------------------------------ */
export async function calculateChampionshipPoints() {
  // 1️⃣  risultati ufficiali (P1,P2,P3 piloti + C1,C2,C3 costruttori)
  const officialRef = doc(db, "championship", "results");
  const officialSnap = await getDoc(officialRef);
  if (!officialSnap.exists()) throw new Error("Risultati campionato non trovati");

  const { P1, P2, P3, C1, C2, C3 } = officialSnap.data();

  // Verifica che ci siano sia piloti che costruttori
  if (!P1 || !P2 || !P3) {
    throw new Error("Risultati piloti incompleti");
  }
  if (!C1 || !C2 || !C3) {
    throw new Error("Risultati costruttori incompleti");
  }

  // 2️⃣  carica tutti gli utenti da "ranking"
  const usersSnap = await getDocs(collection(db, "ranking"));
  const writes = [];

  for (const userDoc of usersSnap.docs) {
    const userId = userDoc.id;
    const data = userDoc.data();

    const pilotiPicks = data.championshipPiloti ?? [];      // [D1, D2, D3]
    const costruttoriPicks = data.championshipCostruttori ?? []; // [C1, C2, C3]

    // 3️⃣  Calcolo punti PILOTI (senza jolly)
    let pilotiPoints = 0;
    if (pilotiPicks[0] === P1) pilotiPoints += PTS_MAIN[1]; // 12 punti
    if (pilotiPicks[1] === P2) pilotiPoints += PTS_MAIN[2]; // 10 punti
    if (pilotiPicks[2] === P3) pilotiPoints += PTS_MAIN[3]; //  7 punti

    // 4️⃣  Calcolo punti COSTRUTTORI (stesso punteggio dei piloti)
    let costruttoriPoints = 0;
    if (costruttoriPicks[0] === C1) costruttoriPoints += PTS_MAIN[1]; // 12 punti
    if (costruttoriPicks[1] === C2) costruttoriPoints += PTS_MAIN[2]; // 10 punti
    if (costruttoriPicks[2] === C3) costruttoriPoints += PTS_MAIN[3]; //  7 punti

    // 4️⃣bis  🌟 REGOLA SPECIALE: 29 → 30 + jolly extra per PILOTI
    let jollyBonus = 0;
    if (pilotiPoints === 29) {
      pilotiPoints += 1;      // 29 → 30
      jollyBonus += 1;        // +1 jolly accumulato
    }

    // 4️⃣ter  🌟 REGOLA SPECIALE: 29 → 30 + jolly extra per COSTRUTTORI
    if (costruttoriPoints === 29) {
      costruttoriPoints += 1;  // 29 → 30
      jollyBonus += 1;         // +1 jolly accumulato
    }

    // 5️⃣  Totale punti campionato (piloti + costruttori)
    const totalChampionshipPoints = pilotiPoints + costruttoriPoints;

    // 6️⃣  Calcola delta rispetto ai punti precedenti
    const prevPts = data.championshipPts ?? 0;
    const delta = totalChampionshipPoints - prevPts;

    // 7️⃣  Aggiornamento ranking (include jolly se necessario)
    const updateData = {
      championshipPts: totalChampionshipPoints,
      puntiTotali: increment(delta),
    };

    // Aggiungi jolly bonus se applicabile
    if (jollyBonus > 0) {
      updateData.jolly = increment(jollyBonus);
    }

    writes.push(
      updateDoc(doc(db, "ranking", userId), updateData)
    );
  }

  // 8️⃣  esegui tutti gli update in parallelo
  await Promise.all(writes);
  return `✔️ Punteggi campionato aggiornati per ${usersSnap.size} utenti (piloti + costruttori).`;
}