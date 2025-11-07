// src/championshipPointsCalculator.js

import {
  updateDoc,
  increment,
  collection,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import { POINTS } from "./constants/racing";

/* ------------------------------------------------------------------ */
/* Punti definiti (importati da costanti centralizzate)                */
/* ------------------------------------------------------------------ */
const PTS_MAIN = POINTS.MAIN;

/* ------------------------------------------------------------------ */
/* Calcolo completo per la “Championship” (senza jolly, solo top 3)   */
/* Aggiorna ranking/{userId}.championshipPts e incrementa puntiTotali */
/* ------------------------------------------------------------------ */
export async function calculateChampionshipPoints() {
  // 1️⃣  risultati ufficiali (stesso schema di una gara, solo P1,P2,P3)
  const officialRef = doc(db, "championship", "results");
  const officialSnap = await getDoc(officialRef);
  if (!officialSnap.exists()) throw new Error("Risultati campionato non trovati");
  const { P1, P2, P3 } = officialSnap.data();

  // 2️⃣  carica tutti gli utenti da “ranking”
  const usersSnap = await getDocs(collection(db, "ranking"));
  const writes = [];

  for (const userDoc of usersSnap.docs) {
    const userId = userDoc.id;
    const data = userDoc.data();
    const picks = data.championshipPiloti ?? []; // [D1,D2,D3]

    // Calcolo punti (senza jolly)
    let points = 0;
    if (picks[0] === P1) points += PTS_MAIN[1];
    if (picks[1] === P2) points += PTS_MAIN[2];
    if (picks[2] === P3) points += PTS_MAIN[3];

    // Preleva eventuali punti precedenti per il campionato
    const prevPts = data.championshipPts ?? 0;
    const delta = points - prevPts;

    //  aggiornamento senza latenze per ogni utente
    writes.push(
      updateDoc(doc(db, "ranking", userId), {
        championshipPts: points,
        puntiTotali: increment(delta),
      })
    );
  }

  // 3️⃣  esegui tutti gli update in parallelo
  await Promise.all(writes);
  return `Punteggi campionato aggiornati per ${usersSnap.size} utenti.`;
}