// src/pointsCalculator.js

import {
  updateDoc,
  increment,
  collection,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "./firebase";

/* ------------------------------------------------------------------ */
/* Helper: è l’ultima gara?                                           */
/* ------------------------------------------------------------------ */
export function isLastRace(racesArr, raceId) {
  if (!racesArr?.length || !raceId) return false;
  const maxRound = Math.max(...racesArr.map((r) => r.round));
  return racesArr.find((r) => r.id === raceId)?.round === maxRound;
}

/* ------------------------------------------------------------------ */
/* Punti / bonus definiti                                            */
/* ------------------------------------------------------------------ */
const PTS_MAIN = { 1: 12, 2: 10, 3: 7 };
const PTS_SPRINT = { 1: 8, 2: 6, 3: 4 };

const BONUS_JOLLY_MAIN = 5; // per jolly corretto
const BONUS_JOLLY_SPRINT = 2; // per jolly sprint corretto
const PENALTY_EMPTY_LIST = -3;

/* ------------------------------------------------------------------ */
/* Calcolo completo in batch (backend) per aggiornare Firestore:       */
/* aggiorna sia le submissions che il ranking                          */
/* ------------------------------------------------------------------ */
/* ------------------------------------------------------------------ */
/* Calcolo completo in batch:                                         */
/*  • salva pointsEarned  e pointsEarnedSprint in  /submissions        */
/*  • aggiorna /ranking/{id}.pointsByRace.{raceId} = {mainPts,sprintPts}
/*  • incrementa correttamente puntiTotali (usando Δ)                  */
/* ------------------------------------------------------------------ */
export async function calculatePointsForRace(raceId) {
  /* 1️⃣  risultati ufficiali */
  const raceRef  = doc(db, "races", raceId);
  const raceSnap = await getDoc(raceRef);
  if (!raceSnap.exists()) throw new Error("Gara non trovata");
  const res = raceSnap.data().officialResults;
  if (!res) throw new Error("Risultati ufficiali assenti");

  const { P1, P2, P3, SP1, SP2, SP3, doublePoints } = res;
  const sprintPresent = Boolean(SP1);

  /* 2️⃣  submissions di quella gara */
  const subsSnap = await getDocs(collection(db, "races", raceId, "submissions"));
  const writes   = [];

  for (const subDoc of subsSnap.docs) {
    const s       = subDoc.data();
    const userId  = subDoc.id;

    /* ------------ MAIN -------------- */
    let mainPts;
    if (!s.mainP1) {
      mainPts = PENALTY_EMPTY_LIST;               // ❕ MOD 1: -3 se lista vuota
    } else {
      mainPts  = 0;
      if (s.mainP1 === P1) mainPts += PTS_MAIN[1];
      if (s.mainP2 === P2) mainPts += PTS_MAIN[2];
      if (s.mainP3 === P3) mainPts += PTS_MAIN[3];

      const mainsArr = [P1, P2, P3];
      if (s.mainJolly  && mainsArr.includes(s.mainJolly )) mainPts += BONUS_JOLLY_MAIN;
      if (s.mainJolly2 && mainsArr.includes(s.mainJolly2)) mainPts += BONUS_JOLLY_MAIN;
    }

    /* ------------ SPRINT ------------- */
    let sprintPts = 0;
    if (sprintPresent) {
      if (!s.sprintP1) {
        sprintPts = PENALTY_EMPTY_LIST;           // ❕ MOD 2: -3 se nessuna pick sprint
      } else {
        if (s.sprintP1 === SP1) sprintPts += PTS_SPRINT[1];
        if (s.sprintP2 === SP2) sprintPts += PTS_SPRINT[2];
        if (s.sprintP3 === SP3) sprintPts += PTS_SPRINT[3];

        const sprintArr = [SP1, SP2, SP3];
        if (s.sprintJolly && sprintArr.includes(s.sprintJolly))
          sprintPts += BONUS_JOLLY_SPRINT;
      }
    }

    /* ------------ Regole speciali ------ */
    let total = mainPts + sprintPts;
    if (total === 29) {
      total  = 30;
      mainPts += 1;                               // assegno +1 al main
      writes.push(updateDoc(doc(db, "ranking", userId), { jolly: increment(1) }));
    }
    if (doublePoints) {
      mainPts   *= 2;
      sprintPts *= 2;
      total     *= 2;
    }

    /* ------------ Aggiorna SUBMISSION -- */
    writes.push(
      updateDoc(subDoc.ref, {
        pointsEarned:        mainPts,
        pointsEarnedSprint:  sprintPts
      })
    );

    /* ------------ Aggiorna RANKING ----- */
    const rankRef  = doc(db, "ranking", userId);
    const rankSnap = await getDoc(rankRef);
    const prevPB   = rankSnap.exists() ? rankSnap.data().pointsByRace || {} : {};
    const prevMain   = prevPB[raceId]?.mainPts   ?? 0;
    const prevSprint = prevPB[raceId]?.sprintPts ?? 0;
    const delta      = total - (prevMain + prevSprint);

    writes.push(
      updateDoc(rankRef, {
        puntiTotali: increment(delta),
        [`pointsByRace.${raceId}`]: { mainPts, sprintPts }
      })
    );
  }

  /* 3️⃣  commit parallelo */
  await Promise.all(writes);
  return `Punteggi ricalcolati e coerenti per ${subsSnap.size} submissions.`;
}