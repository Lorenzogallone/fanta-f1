// Migration script per aggiungere campo usedLateSubmission a tutti gli utenti
// Esegui con: node migration-late-submission.js

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, updateDoc, doc } from 'firebase/firestore';

// Config Firebase (stessa di src/services/firebase.js)
const firebaseConfig = {
  apiKey: "AIzaSyD4BZQbEEpfc1YFmZbsKAx_yCTbYsmOSZ0",
  authDomain: "fantaf1-b5410.firebaseapp.com",
  projectId: "fantaf1-b5410",
  storageBucket: "fantaf1-b5410.firebasestorage.app",
  messagingSenderId: "933486998039",
  appId: "1:933486998039:web:cd31c0ce29f92e2feca252",
  measurementId: "G-6YG7VS4EFQ"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function migrateLateSubmission() {
  console.log('🚀 Inizio migration: aggiungo usedLateSubmission a tutti gli utenti...\n');

  try {
    // Carica tutti gli utenti
    const rankingSnap = await getDocs(collection(db, "ranking"));

    console.log(`📊 Trovati ${rankingSnap.size} utenti\n`);

    let updated = 0;
    let skipped = 0;

    for (const userDoc of rankingSnap.docs) {
      const data = userDoc.data();
      const userName = data.name || userDoc.id;

      // Aggiungi solo se il campo non esiste
      if (data.usedLateSubmission === undefined) {
        await updateDoc(doc(db, "ranking", userDoc.id), {
          usedLateSubmission: false
        });
        console.log(`✅ ${userName}: usedLateSubmission = false`);
        updated++;
      } else {
        console.log(`⏭️  ${userName}: campo già presente (${data.usedLateSubmission})`);
        skipped++;
      }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Migration completata con successo!');
    console.log(`   Utenti aggiornati: ${updated}`);
    console.log(`   Utenti saltati: ${skipped}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Errore durante la migration:', error);
    process.exit(1);
  }
}

// Esegui la migration
migrateLateSubmission();
