/**
 * @file Seeds the local Firebase emulators with a realistic test league, so the
 * app can be run end to end without touching production:
 *
 *   firebase emulators:start --only auth,firestore --project demo-fanta
 *   node scripts/seed-emulator.mjs
 *   VITE_USE_EMULATORS=true npm run dev   (see .env.example)
 *
 * Data: the current season calendar from Jolpica (results for the past races
 * when available), drivers/teams from src/data/f1-data.json, 8 players with
 * random lineups and the points the app's rules would give them.
 * Accounts: p1@test.it … p8@test.it, password "password123"; p1 is admin.
 * Never run against production: it refuses to start without the emulator hosts.
 */

import { readFile } from "fs/promises";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { seedDrivers, seedTeams } from "../src/data/f1Seed.js";

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.error("Set FIRESTORE_EMULATOR_HOST and FIREBASE_AUTH_EMULATOR_HOST (this script is for the emulators only)");
  process.exit(1);
}

const PROJECT = process.env.GCLOUD_PROJECT || "demo-fanta";
initializeApp({ projectId: PROJECT });
const db = getFirestore();
const auth = getAuth();

const POINTS = { MAIN: { 1: 12, 2: 10, 3: 7 }, SPRINT: { 1: 8, 2: 6, 3: 4 }, JOLLY_MAIN: 5, JOLLY_SPRINT: 2, EMPTY: -3 };
const PLAYERS = [
  ["p1", "Lorenzo", "Lorenzo", "Gallone"], ["p2", "Marco", "Marco", "Rossi"], ["p3", "Giulia", "Giulia", "Bianchi"],
  ["p4", "Andrea", "Andrea", "Verdi"], ["p5", "Sara", "Sara", "Neri"], ["p6", "Luca", "Luca", "Ferrari"],
  ["p7", "Chiara", "Chiara", "Russo"], ["p8", "Matteo", "Matteo", "Conti"],
];

// Deterministic pseudo-random, so re-seeding gives the same league
let seed = 42;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const pick = (arr, n, weights) => {
  const pool = arr.map((v, i) => ({ v, w: weights ? weights[i] : 1 }));
  const out = [];
  while (out.length < n && pool.length) {
    const total = pool.reduce((s, p) => s + p.w, 0);
    let r = rnd() * total;
    const idx = pool.findIndex((p) => (r -= p.w) < 0);
    out.push(pool.splice(idx < 0 ? pool.length - 1 : idx, 1)[0].v);
  }
  return out;
};

const slug = (s) => s.toLowerCase().replace(/grand prix/g, "gp").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const ts = (date, time) => Timestamp.fromDate(new Date(`${date}T${time || "12:00:00Z"}`));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function jolpica(path) {
  const res = await fetch(`https://api.jolpi.ca/ergast/f1/${path}`);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

async function main() {
  const f1Data = JSON.parse(await readFile(new URL("../src/data/f1-data.json", import.meta.url), "utf8"));
  const teams = seedTeams(f1Data);
  const drivers = seedDrivers(f1Data);
  const driverNames = drivers.filter((d) => d.selectable !== false).map((d) => d.name);
  // Top teams first: the "strong" drivers are picked more often, like a real league
  const strength = drivers.map((d) => ({ mclaren: 6, ferrari: 5, "red-bull": 5, mercedes: 5 }[d.teamId] || 1.5));

  /* ---------- Calendar (Jolpica current season) ---------- */
  const cal = await jolpica("current.json?limit=40");
  const apiRaces = cal.MRData.RaceTable.Races;
  const season = cal.MRData.RaceTable.season;
  const now = Date.now();
  const races = apiRaces.map((r) => ({
    id: slug(`${season}-${r.raceName}`),
    name: r.raceName.replace("Grand Prix", "GP"),
    round: Number(r.round),
    officialRound: Number(r.round),
    raceUTC: ts(r.date, r.time),
    qualiUTC: r.Qualifying ? ts(r.Qualifying.date, r.Qualifying.time) : ts(r.date, "14:00:00Z"),
    ...(r.Sprint ? { sprintUTC: ts(r.Sprint.date, r.Sprint.time) } : {}),
    ...(r.SprintQualifying ? { qualiSprintUTC: ts(r.SprintQualifying.date, r.SprintQualifying.time) } : {}),
    locked: [],
  }));

  /* ---------- Official results for the past races ---------- */
  for (const race of races) {
    if (race.raceUTC.toMillis() > now) continue;
    const toName = (res) => {
      const full = `${res.Driver.givenName} ${res.Driver.familyName}`;
      const d = drivers.find((x) => x.name === full || (x.apiAliases || []).includes(full) || x.lastName === res.Driver.familyName);
      return d ? d.name : full;
    };
    try {
      const r = await jolpica(`${season}/${race.officialRound}/results.json`);
      const list = r.MRData.RaceTable.Races[0]?.Results || [];
      if (list.length >= 3) race.officialResults = { P1: toName(list[0]), P2: toName(list[1]), P3: toName(list[2]) };
      if (race.sprintUTC) {
        await sleep(300);
        const s = await jolpica(`${season}/${race.officialRound}/sprint.json`);
        const sl = s.MRData.RaceTable.Races[0]?.SprintResults || [];
        if (sl.length >= 3 && race.officialResults) Object.assign(race.officialResults, { SP1: toName(sl[0]), SP2: toName(sl[1]), SP3: toName(sl[2]) });
      }
    } catch (e) {
      console.warn(`no results for R${race.round} (${e.message}), making some up`);
    }
    if (!race.officialResults) {
      const [P1, P2, P3] = pick(driverNames, 3, strength);
      race.officialResults = { P1, P2, P3 };
      if (race.sprintUTC) { const [SP1, SP2, SP3] = pick(driverNames, 3, strength); Object.assign(race.officialResults, { SP1, SP2, SP3 }); }
    }
    race.pointsCalculated = true;
    await sleep(300);
  }

  /* ---------- Lineups and points ---------- */
  const ranking = Object.fromEntries(PLAYERS.map(([uid, nick]) => [uid, {
    name: nick, puntiTotali: 0, jolly: 1, usedLateSubmission: false, pointsByRace: {},
    championshipPiloti: [], championshipCostruttori: [], championshipPts: 0,
  }]));
  const submissions = []; // { raceId, uid, data }
  const nextRace = races.find((r) => r.raceUTC.toMillis() > now);

  for (const race of races) {
    const past = race.raceUTC.toMillis() <= now;
    const isNext = race === nextRace;
    if (!past && !isNext) continue;
    for (const [uid, nick] of PLAYERS) {
      if (isNext && rnd() < 0.5) continue; // half the league hasn't submitted yet
      if (past && rnd() < 0.08) continue; // the odd missed race
      const [mainP1, mainP2, mainP3, mainJolly] = pick(driverNames, 4, strength);
      const data = {
        userId: uid, user: nick, mainP1, mainP2, mainP3, mainJolly,
        submittedAt: Timestamp.fromMillis(race.qualiUTC.toMillis() - Math.floor(rnd() * 36e5 * 20)),
      };
      if (race.sprintUTC && rnd() < 0.8) {
        const [sprintP1, sprintP2, sprintP3, sprintJolly] = pick(driverNames, 4, strength);
        Object.assign(data, { sprintP1, sprintP2, sprintP3, sprintJolly });
      }
      if (past) {
        const o = race.officialResults;
        const podium = [o.P1, o.P2, o.P3];
        let mainPts = 0;
        if (data.mainP1 === o.P1) mainPts += POINTS.MAIN[1];
        if (data.mainP2 === o.P2) mainPts += POINTS.MAIN[2];
        if (data.mainP3 === o.P3) mainPts += POINTS.MAIN[3];
        if (podium.includes(data.mainJolly)) mainPts += POINTS.JOLLY_MAIN;
        let sprintPts = 0;
        if (o.SP1) {
          if (!data.sprintP1) sprintPts = POINTS.EMPTY;
          else {
            if (data.sprintP1 === o.SP1) sprintPts += POINTS.SPRINT[1];
            if (data.sprintP2 === o.SP2) sprintPts += POINTS.SPRINT[2];
            if (data.sprintP3 === o.SP3) sprintPts += POINTS.SPRINT[3];
            if ([o.SP1, o.SP2, o.SP3].includes(data.sprintJolly)) sprintPts += POINTS.JOLLY_SPRINT;
          }
        }
        data.pointsEarned = mainPts;
        data.pointsEarnedSprint = sprintPts;
        ranking[uid].pointsByRace[race.id] = { mainPts, sprintPts, perfectPodium: false };
        ranking[uid].puntiTotali += mainPts + sprintPts;
      }
      submissions.push({ raceId: race.id, uid, data });
    }
    // Empty-lineup penalty for whoever missed a past race
    if (past) {
      for (const [uid] of PLAYERS) {
        if (!submissions.some((s) => s.raceId === race.id && s.uid === uid)) {
          ranking[uid].pointsByRace[race.id] = { mainPts: POINTS.EMPTY, sprintPts: 0, perfectPodium: false };
          ranking[uid].puntiTotali += POINTS.EMPTY;
        }
      }
    }
  }

  /* ---------- Write ---------- */
  const batchWrite = async (ops) => {
    for (let i = 0; i < ops.length; i += 400) {
      const b = db.batch();
      ops.slice(i, i + 400).forEach((op) => op(b));
      await b.commit();
    }
  };
  const ops = [];
  teams.forEach((t) => ops.push((b) => b.set(db.doc(`teams/${t.id}`), t)));
  drivers.forEach((d) => ops.push((b) => b.set(db.doc(`drivers/${d.id}`), { ...d, source: "seed" })));
  races.forEach((r) => ops.push((b) => b.set(db.doc(`races/${r.id}`), r)));
  submissions.forEach((s) => ops.push((b) => b.set(db.doc(`races/${s.raceId}/submissions/${s.uid}`), s.data)));
  for (const [uid, nick, first, last] of PLAYERS) {
    ops.push((b) => b.set(db.doc(`ranking/${uid}`), ranking[uid]));
    ops.push((b) => b.set(db.doc(`users/${uid}`), {
      email: `${uid}@test.it`, nickname: nick, firstName: first, lastName: last, provider: "password", createdAt: Timestamp.now(),
    }));
  }
  await batchWrite(ops);

  for (const [uid, nick] of PLAYERS) {
    try { await auth.deleteUser(uid); } catch { /* first run */ }
    await auth.createUser({ uid, email: `${uid}@test.it`, password: "password123", displayName: nick, emailVerified: true });
  }
  await auth.setCustomUserClaims("p1", { admin: true });

  console.log(`Seeded ${races.length} races (${races.filter((r) => r.officialResults).length} with results), ${submissions.length} lineups, ${PLAYERS.length} players. Next race: ${nextRace?.name}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
