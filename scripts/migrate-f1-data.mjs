/**
 * One-off data migration for the F1 sync:
 *  1. creates `teams` and `drivers` from src/data/f1-data.json (names identical
 *     to those stored in formations/results; existing documents are skipped);
 *  2. adds `officialRound` to every race matched to the official calendar
 *     (cancelled races stay without it);
 *  3. fixes the race times passed with --fix (and locks them);
 *  4. initializes `locked: []` and recomputes `round` (display order by date).
 *
 * Dry run by default (read-only account): prints a before → after preview and
 * saves a JSON backup. With --apply it writes with targeted merges.
 *
 * Usage:
 *   FIREBASE_SERVICE_ACCOUNT='{...}' node scripts/migrate-f1-data.mjs \
 *     --backup-dir /path/to/dir \
 *     --fix r18-gran-premio-di-malaysiabahrain:raceUTC=2026-10-04T07:00:00Z \
 *     --fix gran-premio-di-miami:raceUTC=2026-05-03T20:00:00Z
 *   FIREBASE_SERVICE_ACCOUNT_WRITE='{...}' node scripts/migrate-f1-data.mjs ... --apply
 */

import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, Timestamp, FieldValue } from "firebase-admin/firestore";
import {
  fetchJolpicaSnapshot,
  matchRaces,
  computeRoundOrder,
  toDate,
} from "../functions/shared/f1Sync.mjs";
import { seedDrivers, seedTeams } from "../src/data/f1Seed.js";

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const argValues = (name) => args.flatMap((a, i) => (a === name ? [args[i + 1]] : []));
const backupDir = argValues("--backup-dir")[0] || ".";
const fixes = argValues("--fix").map((f) => {
  const m = /^([^:]+):(\w+)=(.+)$/.exec(f);
  if (!m) throw new Error(`Bad --fix "${f}" (expected id:field=ISO date)`);
  return { id: m[1], field: m[2], value: new Date(m[3]) };
});

const credVar = APPLY ? "FIREBASE_SERVICE_ACCOUNT_WRITE" : "FIREBASE_SERVICE_ACCOUNT";
if (!process.env[credVar]) {
  console.error(`Missing ${credVar}`);
  process.exit(1);
}
initializeApp({ credential: cert(JSON.parse(process.env[credVar])) });
const db = getFirestore();

const readAll = async (name) =>
  (await db.collection(name).get()).docs.map((d) => ({ id: d.id, ...d.data() }));

/** JSON replacer: Timestamps as ISO strings */
const jsonReplacer = (k, v) =>
  v && typeof v === "object" && typeof v._seconds === "number"
    ? { __timestamp: new Date(v._seconds * 1000).toISOString() }
    : v;

const fmt = (v) => {
  if (v === undefined) return "(assente)";
  if (v instanceof Date || v?.toDate) return toDate(v).toISOString().replace(".000Z", "Z");
  return JSON.stringify(v);
};

// ── Read everything ──────────────────────────────────────────────────────────
const f1Data = JSON.parse(await readFile(new URL("../src/data/f1-data.json", import.meta.url), "utf8"));
const [races, drivers, teams, ranking] = await Promise.all([
  readAll("races"), readAll("drivers"), readAll("teams"), readAll("ranking"),
]);
const submissions = [];
for (const r of races) {
  const snap = await db.collection("races").doc(r.id).collection("submissions").get();
  snap.docs.forEach((d) => submissions.push({ raceId: r.id, id: d.id, ...d.data() }));
}

// ── Backup ───────────────────────────────────────────────────────────────────
await mkdir(backupDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupFile = path.join(backupDir, `f1-migration-backup-${stamp}.json`);
await writeFile(backupFile, JSON.stringify({ races, drivers, teams }, jsonReplacer, 2));
console.log(`Backup: ${backupFile} (${races.length} races, ${drivers.length} drivers, ${teams.length} teams)`);

const problems = [];

// ── 1. Teams and drivers ─────────────────────────────────────────────────────
const existingTeamIds = new Set(teams.map((t) => t.id));
const existingDriverIds = new Set(drivers.map((d) => d.id));
const newTeams = seedTeams(f1Data).filter((t) => !existingTeamIds.has(t.id))
  .map((t) => ({ ...t, source: "seed" }));
const newDrivers = seedDrivers(f1Data).filter((d) => !existingDriverIds.has(d.id))
  .map((d) => ({ ...d, selectable: true, active: true, source: "seed", locked: [] }));

const allDriverNames = new Set([...drivers, ...newDrivers].map((d) => d.name));
const allTeamNames = new Set([...teams, ...newTeams].map((t) => t.name));

// Every name already stored must map to a driver/team with the same name
const usedDrivers = new Map();
const useDriver = (name, where) => {
  if (!name) return;
  if (!usedDrivers.has(name)) usedDrivers.set(name, where);
};
for (const s of submissions) {
  for (const f of ["mainP1", "mainP2", "mainP3", "mainJolly", "mainJolly2", "sprintP1", "sprintP2", "sprintP3", "sprintJolly"]) {
    useDriver(s[f], `races/${s.raceId}/submissions/${s.id}.${f}`);
  }
}
for (const r of races) {
  for (const f of ["P1", "P2", "P3", "SP1", "SP2", "SP3"]) useDriver(r.officialResults?.[f], `races/${r.id}.officialResults.${f}`);
}
const usedTeams = new Map();
for (const p of ranking) {
  (p.championshipPiloti || []).forEach((n) => useDriver(n, `ranking/${p.id}.championshipPiloti`));
  (p.championshipCostruttori || []).forEach((n) => n && !usedTeams.has(n) && usedTeams.set(n, `ranking/${p.id}`));
}
for (const [name, where] of usedDrivers) {
  if (!allDriverNames.has(name)) problems.push(`Pilota "${name}" (${where}) non presente in drivers`);
}
for (const [name, where] of usedTeams) {
  if (!allTeamNames.has(name)) problems.push(`Team "${name}" (${where}) non presente in teams`);
}

// ── 2–5. Races ───────────────────────────────────────────────────────────────
const season = Number(argValues("--season")[0]) || new Date().getUTCFullYear();
const snapshot = await fetchJolpicaSnapshot(season);
const matches = matchRaces(races, snapshot.schedule);

const raceChanges = new Map(); // id → { field: { from, to, write } }
const change = (race, field, to, write = to) => {
  const c = raceChanges.get(race.id) || {};
  c[field] = { from: race[field], to, write };
  raceChanges.set(race.id, c);
};

const usedRounds = new Map();
for (const race of races) {
  const api = matches.get(race.id);
  if (!api) {
    if (!race.cancelledMain) problems.push(`Gara ${race.id} non cancellata e senza abbinamento ufficiale`);
    continue;
  }
  if (usedRounds.has(api.officialRound)) problems.push(`Round ufficiale ${api.officialRound} abbinato due volte`);
  usedRounds.set(api.officialRound, race.id);
  if (race.officialRound !== api.officialRound) change(race, "officialRound", api.officialRound);
}

const projected = races.map((r) => ({ ...r }));
for (const fix of fixes) {
  const race = races.find((r) => r.id === fix.id);
  if (!race) { problems.push(`--fix: gara ${fix.id} non trovata`); continue; }
  change(race, fix.field, fix.value, Timestamp.fromDate(fix.value));
  projected.find((r) => r.id === fix.id)[fix.field] = fix.value;
}

for (const race of races) {
  const fixedFields = fixes.filter((f) => f.id === race.id).map((f) => f.field);
  const current = Array.isArray(race.locked) ? race.locked : undefined;
  const next = [...new Set([...(current || []), ...fixedFields])];
  if (!current || next.length !== current.length) change(race, "locked", next);
}

const order = computeRoundOrder(projected);
for (const race of races) {
  if (race.round !== order[race.id]) change(race, "round", order[race.id]);
}

// ── Preview ──────────────────────────────────────────────────────────────────
console.log(`\nAbbinamento (stagione ${season}):`);
for (const r of [...races].sort((a, b) => a.round - b.round)) {
  const m = matches.get(r.id);
  console.log(`  DB R${String(r.round).padStart(2)} ${r.id.padEnd(42)} → ${m ? `R${m.officialRound} ${m.apiName}` : r.cancelledMain ? "cancellata (nessun round ufficiale)" : "NESSUNO"}`);
}

console.log(`\nTeam da creare (${newTeams.length}):`);
newTeams.forEach((t) => console.log(`  teams/${t.id}: name=${fmt(t.name)} logo=${fmt(t.logo)} aliases=${t.apiAliases.length}`));
console.log(`\nPiloti da creare (${newDrivers.length}):`);
newDrivers.forEach((d) => console.log(`  drivers/${d.id}: name=${fmt(d.name)} team=${d.teamId} #${d.number} selectable=${d.selectable} active=${d.active}`));
console.log(`  Nomi usati in formazioni/risultati/campionato: ${usedDrivers.size} piloti, ${usedTeams.size} team — tutti presenti: ${problems.filter((p) => p.startsWith("Pilota") || p.startsWith("Team")).length === 0 ? "sì" : "NO"}`);

console.log(`\nGare da aggiornare (${raceChanges.size}):`);
for (const [id, fields] of raceChanges) {
  console.log(`  races/${id}`);
  for (const [field, c] of Object.entries(fields)) console.log(`      ${field}: ${fmt(c.from)} → ${fmt(c.to)}`);
}

if (problems.length) {
  console.log("\n❌ Problemi (nessuna scrittura):");
  problems.forEach((p) => console.log("  - " + p));
  process.exit(1);
}

if (!APPLY) {
  console.log("\nProva senza scrittura completata. Rilancia con --apply (FIREBASE_SERVICE_ACCOUNT_WRITE) per scrivere.");
  process.exit(0);
}

// ── Apply (targeted merges only) ─────────────────────────────────────────────
const batch = db.batch();
let count = 0;
for (const t of newTeams) {
  const { id, ...data } = t;
  batch.set(db.collection("teams").doc(id), { ...data, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  count++;
}
for (const d of newDrivers) {
  const { id, ...data } = d;
  batch.set(db.collection("drivers").doc(id), { ...data, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  count++;
}
for (const [id, fields] of raceChanges) {
  const data = Object.fromEntries(Object.entries(fields).map(([f, c]) => [f, c.write]));
  batch.set(db.collection("races").doc(id), data, { merge: true });
  count++;
}
await batch.commit();
console.log(`\n✅ Scritti ${count} documenti.`);
process.exit(0);
