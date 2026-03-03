#!/usr/bin/env node

/**
 * @file send-test-notification.js
 * @description Script per inviare una notifica push di test a tutti i dispositivi registrati.
 *
 * Uso:
 *   node scripts/send-test-notification.js
 *
 * Autenticazione (una delle seguenti):
 *   1. Scarica il service account da Firebase Console →
 *      Impostazioni progetto → Account di servizio → Genera nuova chiave privata
 *      Salva il file JSON come: serviceAccount.json nella root del progetto
 *
 *   2. Oppure usa le Application Default Credentials:
 *      gcloud auth application-default login
 */

import { createRequire } from "module";
import { existsSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

// firebase-admin è installato in functions/node_modules
const admin = require("../functions/node_modules/firebase-admin");

// Cerca il service account JSON nella root del progetto
const serviceAccountPath = join(__dirname, "..", "serviceAccount.json");

if (existsSync(serviceAccountPath)) {
  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, "utf8"));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: "fanta-f1-bfb7b",
  });
  console.log("🔑 Autenticato con serviceAccount.json\n");
} else {
  // Prova con ADC (Application Default Credentials)
  admin.initializeApp({ projectId: "fanta-f1-bfb7b" });
  console.log("🔑 Autenticato con Application Default Credentials\n");
  console.log("💡 Suggerimento: puoi anche autenticarti scaricando il service account JSON da");
  console.log("   Firebase Console → Impostazioni progetto → Account di servizio");
  console.log("   e salvarlo come serviceAccount.json nella root del progetto.\n");
}

const db = admin.firestore();
async function getAllFcmTokens() {
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("Timeout: Firestore non risponde dopo 15s. Controlla la connessione o le credenziali.")), 15000)
  );
  const snapshot = await Promise.race([
    db.collection("users").get(),
    timeoutPromise,
  ]);
  const tokens = [];
  snapshot.docs.forEach((doc) => {
    const data = doc.data();
    if (data.fcmTokens && Array.isArray(data.fcmTokens)) {
      tokens.push(...data.fcmTokens);
    }
  });
  return [...new Set(tokens)];
}

async function sendTestNotification() {
  console.log("🔔 Recupero token FCM registrati...\n");

  let tokens;
  try {
    tokens = await getAllFcmTokens();
  } catch (err) {
    console.error("❌ Errore nel recupero token:", err.message);
    process.exit(1);
  }

  if (tokens.length === 0) {
    console.log("❌ Nessun token FCM trovato! Assicurati che almeno un dispositivo abbia abilitato le notifiche.");
    process.exit(1);
  }

  console.log(`📱 Trovati ${tokens.length} dispositivo/i registrato/i`);
  console.log("📤 Invio notifica di test...\n");

  const message = {
    notification: {
      title: "🔔 Test FantaF1",
      body: "Notifica di test! Se vedi questo messaggio, le notifiche push funzionano! ✅",
    },
    data: {
      tag: "test-notification",
      url: "/lineup",
    },
    webpush: {
      notification: {
        icon: "/FantaF1_Logo_big.png",
        badge: "/FantaF1_Logo_big.png",
        vibrate: [100, 50, 200],
        tag: "test-notification",
      },
      fcmOptions: {
        link: "/lineup",
      },
    },
  };

  try {
    const response = await admin.messaging().sendEachForMulticast({
      ...message,
      tokens,
    });

    console.log("✅ Risultato:");
    console.log(`   - Successi: ${response.successCount}`);
    console.log(`   - Fallimenti: ${response.failureCount}`);

    response.responses.forEach((resp, idx) => {
      if (!resp.success) {
        console.log(`   ❌ Token ${idx + 1}: ${resp.error?.code} - ${resp.error?.message}`);
      }
    });

    if (response.successCount > 0) {
      console.log("\n🎉 Notifica inviata con successo! Controlla il tuo dispositivo.");
    }
  } catch (err) {
    console.error("❌ Errore nell'invio:", err.message);
    process.exit(1);
  }

  process.exit(0);
}

sendTestNotification();
