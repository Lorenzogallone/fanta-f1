/**
 * Dry run of the F1 sync (calendar + drivers): fetches Jolpica, reads
 * Firestore and prints what would change. Never writes.
 *
 * Usage:
 *   FIREBASE_SERVICE_ACCOUNT='{...}' node scripts/sync-dry-run.mjs [season]
 * (behind a proxy: NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=...)
 *
 * If `drivers`/`teams` are still empty, f1-data.json is used instead.
 */

import { readFile } from "fs/promises";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { fetchJolpicaSnapshot, computeF1Sync, toDate } from "../functions/shared/f1Sync.mjs";
import { seedDrivers, seedTeams } from "../src/data/f1Seed.js";

const season = Number(process.argv[2]) || new Date().getUTCFullYear();

if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.error("Missing FIREBASE_SERVICE_ACCOUNT");
  process.exit(1);
}
initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
const db = getFirestore();

const readAll = async (name) =>
  (await db.collection(name).get()).docs.map((d) => ({ id: d.id, ...d.data() }));

const fmt = (v) => {
  const d = v instanceof Date || v?.toDate ? toDate(v) : null;
  return d ? d.toISOString().replace(".000", "") : JSON.stringify(v);
};

const f1Data = JSON.parse(await readFile(new URL("../src/data/f1-data.json", import.meta.url), "utf8"));
const snapshot = await fetchJolpicaSnapshot(season);
const races = await readAll("races");
let drivers = await readAll("drivers");
let teams = await readAll("teams");
if (drivers.length === 0) {
  console.log("(drivers vuoto: uso f1-data.json)");
  drivers = seedDrivers(f1Data);
}
if (teams.length === 0) {
  console.log("(teams vuoto: uso f1-data.json)");
  teams = seedTeams(f1Data);
}

const result = computeF1Sync({ snapshot, races, drivers, teams });
const { calendar, roundChanges, drivers: d, summary } = result;

console.log(`\nStagione ${season} — hash API ${snapshot.hash} — ultimo round con risultati: ${snapshot.lastRound}`);
console.log("\nAbbinamenti:");
for (const r of [...races].sort((a, b) => a.round - b.round)) {
  const m = calendar.matches.get(r.id);
  console.log(`  DB ${String(r.round).padStart(2)} ${r.id.padEnd(42)} → ${m ? `R${m.officialRound} ${m.apiName}` : r.cancelledMain ? "(cancellata)" : "—"}`);
}

console.log("\nAggiornamenti calendario:");
for (const u of calendar.updates) {
  console.log(`  ${u.locked ? "🔒" : "  "} ${u.id} · ${u.field}: ${fmt(u.from)} → ${fmt(u.to)}`);
}
if (!calendar.updates.length) console.log("  nessuno");
console.log("Nuove gare:", calendar.creates.map((c) => `R${c.officialRound} ${c.name}`).join(", ") || "nessuna");
console.log("Da cancellare:", calendar.cancels.map((c) => c.id).join(", ") || "nessuna");
console.log("Ignorate (risultati salvati):", calendar.skipped.length);
console.log("Gare ufficiali passate senza abbinamento:", calendar.unmatchedPast.map((c) => `R${c.officialRound} ${c.apiName}`).join(", ") || "nessuna");
console.log("Round ricalcolati:", roundChanges.map((c) => `${c.id} ${c.from}→${c.to}`).join(", ") || "nessuno");

console.log("\nPiloti nuovi:", d.driverCreates.map((x) => `${x.name} (${x.teamId}, selectable=false)`).join(", ") || "nessuno");
console.log("Team nuovi:", d.teamCreates.map((x) => x.name).join(", ") || "nessuno");
console.log("Cambi squadra:", d.driverUpdates.map((x) => `${x.locked ? "🔒 " : ""}${x.name}: ${x.from} → ${x.to}`).join(", ") || "nessuno");
console.log("\nRiepilogo:", JSON.stringify(summary));
process.exit(0);
