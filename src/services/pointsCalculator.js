// src/pointsCalculator.js
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

/* ------------------------------------------------------------ *
 *  È l'ultima gara del calendario?                             *
 * ------------------------------------------------------------ */
export function isLastRace(racesArr, raceId) {
  if (!racesArr?.length || !raceId) return false;
  const maxRound = Math.max(...racesArr.map((r) => r.round));
  return racesArr.find((r) => r.id === raceId)?.round === maxRound;
}

/* ------------------------------------------------------------ *
 *  Costanti punteggi importate da file centralizzato           *
 * ------------------------------------------------------------ */
const PTS_MAIN = POINTS.MAIN;
const PTS_SPRINT = POINTS.SPRINT;
const BONUS_JOLLY_MAIN = POINTS.BONUS_JOLLY_MAIN;
const BONUS_JOLLY_SPRINT = POINTS.BONUS_JOLLY_SPRINT;
const PENALTY_EMPTY_LIST = POINTS.PENALTY_EMPTY_LIST;

/* ------------------------------------------------------------ *
 *  Calcolo e persistenza                                       *
 * ------------------------------------------------------------ */
export async function calculatePointsForRace(raceId, official) {
  /* 1️⃣  Salva/aggiorna i risultati ufficiali della gara ------- */
  // `official` arriva dal frontend (P1-P3, SP1-SP3, doublePoints)  
  // se non viene passato, li leggo semplicemente da Firestore.
  if (official) {
    await setDoc(
      doc(db, "races", raceId),
      { officialResults: official },
      { merge: true }
    );
  }

  /* 2️⃣  Recupero risultati definitivi e check ------------------ */
  const raceRef  = doc(db, "races", raceId);
  const raceSnap = await getDoc(raceRef);
  if (!raceSnap.exists()) throw new Error("Gara non trovata");

  const raceData = raceSnap.data();
  const {
    P1, P2, P3,
    SP1 = null, SP2 = null, SP3 = null,
    doublePoints = false,
  } = raceData.officialResults ?? {};

  // Skip gare cancellate
  const cancelledMain = raceData.cancelledMain || false;
  const cancelledSprint = raceData.cancelledSprint || false;

  if (cancelledMain) {
    throw new Error("⛔ Gara cancellata: il calcolo punti è disabilitato.");
  }

  if (!P1 || !P2 || !P3)
    throw new Error("Risultati ufficiali incompleti (manca il podio).");

  const sprintPresent = !!SP1 && !cancelledSprint;

  /* 3️⃣  Itera sulle submissions --------------------------------- */
  const subsSnap = await getDocs(
    collection(db, "races", raceId, "submissions")
  );

  const batchWrites = [];

  for (const subDoc of subsSnap.docs) {
    const s      = subDoc.data();
    const userId = subDoc.id;

    /* ------ calcolo punteggi MAIN ----------------------------- */
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

    /* ------ calcolo punteggi SPRINT --------------------------- */
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

    /* ------ regola speciale 29 → 30 + jolly extra -------------- */
    if (mainPts === 29) {
      mainPts += 1;
      batchWrites.push(
        updateDoc(doc(db, "ranking", userId), { jolly: increment(1) })
      );
    }

    /* ------ moltiplicatore ultima gara ------------------------ */
    if (doublePoints) {
      mainPts   *= 2;
      sprintPts *= 2;
    }

    /* ------ salva nella singola SUBMISSION -------------------- */
    batchWrites.push(
      updateDoc(subDoc.ref, {
        pointsEarned:       mainPts,
        pointsEarnedSprint: sprintPts,
      })
    );

    /* ------ aggiorna il RANKING (mappa completa) -------------- */
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

  /* 4️⃣  commit parallelo --------------------------------------- */
  await Promise.all(batchWrites);
  return `✔️ Calcolo completato: aggiornate ${subsSnap.size} submissions e ranking`;
}