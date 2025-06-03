// scripts_calendar/seedRanking.js

import { createRequire } from "module";
const require = createRequire(import.meta.url);

// 🗝️ Importa la tua chiave di servizio
const serviceAccount = require("./serviceAccount.json");

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Inizializza Firebase Admin
initializeApp({
  credential: cert(serviceAccount),
});
const db = getFirestore();

// --- Qui definiamo la classifica come array di oggetti ---
// Ogni oggetto ha: nome, punti e delta (variazione rispetto alla settimana scorsa)
const rankingData = [
  { name: "Steu P.", points: 108 },
  { name: "Helmut",  points:  98 },
  { name: "Raffaele",points:  92 },
  { name: "Dave",    points:  91},
  { name: "Gallo",   points:  86 },
  { name: "Chiaretta",points: 77 },
  { name: "Ale",     points:  63 },
  { name: "Riki M.", points:  54 },
  { name: "Matte",   points:  53},
  { name: "Vitto",   points:  46},
  { name: "Baba",    points:  42 },
  { name: "Casetz",  points:  33},
  { name: "Fede",    points:  22},
  { name: "Sbin",    points:  19 },
  { name: "Albi",    points:  14 },
];

function makeDocId(name) {
  // Converte “Riki M.” → “riki-m” ecc. (facoltativo)
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function main() {
  try {
    console.log("📥 Importo ranking in Firestore…");

    for (const entry of rankingData) {
      const docId = makeDocId(entry.name);
      console.log(
        `  • Scrivo ${entry.name} → punti ${entry.points}`
      );

      // Sotto la collezione “ranking”, crea/aggiorna il documento con ID = docId
      // memorizziamo:
      //   - name: nome originale
      //   - puntiTotali: punti
      //   - ts: timestamp (opzionale)
      await db.doc(`ranking/${docId}`).set(
        {
          name:        entry.name,
          puntiTotali: entry.points,
          ts:          new Date(), // salva la data di importazione
        },
        { merge: true }
      );
    }

    console.log("✅ Import della classifica completato!");
    if (typeof process !== "undefined") process.exit(0);
  } catch (err) {
    console.error("❌ Errore durante l'import della classifica:", err);
    if (typeof process !== "undefined") process.exit(1);
  }
}

main();