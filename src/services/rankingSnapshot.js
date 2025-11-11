// src/services/rankingSnapshot.js
import { collection, getDocs, setDoc, doc, query, orderBy, limit, Timestamp } from "firebase/firestore";
import { db } from "./firebase";

/**
 * Salva uno snapshot della classifica attuale
 * Viene chiamato automaticamente dopo ogni calcolo (gara o campionato)
 * @param {string} type - "race" | "championship"
 * @param {string} raceId - ID della gara (opzionale, solo per type="race")
 */
export async function saveRankingSnapshot(type = "race", raceId = null) {
  try {
    // 1. Leggi la classifica attuale ordinata per punti
    const rankingQuery = query(
      collection(db, "ranking"),
      orderBy("puntiTotali", "desc")
    );
    const rankingSnap = await getDocs(rankingQuery);

    // 2. Crea l'array di snapshot con posizioni
    const snapshot = rankingSnap.docs.map((doc, index) => ({
      userId: doc.id,
      name: doc.data().name,
      position: index + 1,
      points: doc.data().puntiTotali,
      jolly: doc.data().jolly ?? 0,
    }));

    // 3. Crea un ID univoco basato su timestamp
    const timestamp = Date.now();
    const snapshotId = `snapshot_${timestamp}`;

    // 4. Salva lo snapshot in Firestore
    await setDoc(doc(db, "rankingHistory", snapshotId), {
      snapshot,
      createdAt: Timestamp.now(),
      type,
      raceId: raceId || null,
    });

    console.log(`✅ Snapshot classifica salvato: ${snapshotId}`);
    return snapshotId;
  } catch (error) {
    console.error("❌ Errore salvataggio snapshot classifica:", error);
    throw error;
  }
}

/**
 * Recupera l'ultimo snapshot salvato
 * @returns {Promise<Object|null>} - Oggetto con { snapshot, createdAt, type } o null se non esiste
 */
export async function getLastRankingSnapshot() {
  try {
    const historyQuery = query(
      collection(db, "rankingHistory"),
      orderBy("createdAt", "desc"),
      limit(1)
    );
    const historySnap = await getDocs(historyQuery);

    if (historySnap.empty) {
      return null;
    }

    const lastDoc = historySnap.docs[0];
    return {
      id: lastDoc.id,
      ...lastDoc.data(),
    };
  } catch (error) {
    console.error("❌ Errore recupero ultimo snapshot:", error);
    return null;
  }
}

/**
 * Calcola la differenza di posizione tra classifica attuale e snapshot precedente
 * @param {string} userId - ID dell'utente
 * @param {number} currentPosition - Posizione attuale
 * @param {Array} previousSnapshot - Array dello snapshot precedente
 * @returns {number} - Posizioni guadagnate (positivo) o perse (negativo). 0 se invariata o se non c'è snapshot
 */
export function calculatePositionChange(userId, currentPosition, previousSnapshot) {
  if (!previousSnapshot || !Array.isArray(previousSnapshot)) {
    return 0;
  }

  const previousEntry = previousSnapshot.find(entry => entry.userId === userId);

  if (!previousEntry) {
    // Nuovo utente non presente nello snapshot precedente
    return 0;
  }

  // Differenza: se era in posizione 5 e ora è in 3 → +2 (salito di 2)
  // se era in posizione 3 e ora è in 5 → -2 (sceso di 2)
  return previousEntry.position - currentPosition;
}
