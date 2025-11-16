// scripts/seedRacesFromICS.js

import fs from "fs/promises";
import ical from "node-ical";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const serviceAccount = require("./serviceAccount.json");

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// 📁 Percorso relativo al file .ics scaricato
const ICS_PATH = "./scripts/f1_2025.ics";

// Inizializza Firebase Admin (usa il tuo serviceAccount.json)
initializeApp({
  credential: cert(serviceAccount),
});
const db = getFirestore();

/**
 * Converte un nome di gara (es. "Gran Premio d'Australia")
 * in uno slug (es. "gran-premio-d-australia").
 */
function makeSlug(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function main() {
  try {
    console.log("🔄 Leggo file locale:", ICS_PATH);
    const icsText = await fs.readFile(ICS_PATH, "utf8");

    console.log("🛠 Parse ICS…");
    const data = ical.parseICS(icsText);

    // Mappa temporanea: { slugRace: { name, quali, race, qualiSprint, sprint } }
    const racesMap = {};

    for (const key in data) {
      const ev = data[key];
      if (ev.type !== "VEVENT") continue;

      const summary = ev.summary || "";

      // 1) Qualifiche “normali”
      let match = summary.match(/^F1:\s*Qualifiche\s*\((.+)\)$/);
      if (match) {
        const raceName = match[1]; // es. "Gran Premio d'Australia"
        const slugName = makeSlug(raceName);
        racesMap[slugName] = racesMap[slugName] || {
          name: raceName,
          quali: null,
          race: null,
          qualiSprint: null,
          sprint: null,
        };
        racesMap[slugName].quali = ev.start; // Date UTC
        continue;
      }

      // 2) Gara (Gran Premio normale)
      match = summary.match(/^F1:\s*Gran Premio\s*\((.+)\)$/);
      if (match) {
        const raceName = match[1];
        const slugName = makeSlug(raceName);
        racesMap[slugName] = racesMap[slugName] || {
          name: raceName,
          quali: null,
          race: null,
          qualiSprint: null,
          sprint: null,
        };
        racesMap[slugName].race = ev.start;
        continue;
      }

      // 3) Qualifiche Sprint
      match = summary.match(/^F1:\s*Qualifiche Sprint\s*\((.+)\)$/);
      if (match) {
        const raceName = match[1];
        const slugName = makeSlug(raceName);
        racesMap[slugName] = racesMap[slugName] || {
          name: raceName,
          quali: null,
          race: null,
          qualiSprint: null,
          sprint: null,
        };
        racesMap[slugName].qualiSprint = ev.start;
        continue;
      }

      // 4) Gara Sprint (Sprint Race)
      match = summary.match(/^F1:\s*Sprint\s*\((.+)\)$/);
      if (match) {
        const raceName = match[1];
        const slugName = makeSlug(raceName);
        racesMap[slugName] = racesMap[slugName] || {
          name: raceName,
          quali: null,
          race: null,
          qualiSprint: null,
          sprint: null,
        };
        racesMap[slugName].sprint = ev.start;
        continue;
      }

      // Tutti gli altri eventi ("Giro di prova", "P1", "P2", ecc.) vengono ignorati
    }

    // Trasforma map → array, filtra solo quando almeno QUALI e GARA esistono,
    // ordina per data della gara principale e assegna il numero di round
    const racesArray = Object.values(racesMap)
      .filter((r) => r.quali && r.race)
      .sort((a, b) => a.race - b.race)
      .map((r, idx) => ({
        id:           makeSlug(r.name),
        name:         r.name,
        round:        idx + 1,
        qualiUTC:     r.quali,
        raceUTC:      r.race,
        qualiSprintUTC: r.qualiSprint || null,
        sprintUTC:    r.sprint || null,
      }));

    console.log("📥 Scrivo su Firestore:");
    for (const race of racesArray) {
      console.log(
        `  • [Round ${race.round}] ${race.name} → ${race.raceUTC.toISOString()}`
      );
      // Document in /races/{slug}
      await db.doc(`races/${race.id}`).set(
        {
          name:          race.name,
          round:         race.round,
          qualiUTC:      race.qualiUTC,
          raceUTC:       race.raceUTC,
          qualiSprintUTC: race.qualiSprintUTC,
          sprintUTC:     race.sprintUTC,
        },
        { merge: true }
      );
    }

    console.log("✅ Import completato (", racesArray.length, "gare).");
    if (typeof process !== "undefined") process.exit(0);
  } catch (err) {
    console.error("❌ Errore:", err);
    if (typeof process !== "undefined") process.exit(1);
  }
}

main();