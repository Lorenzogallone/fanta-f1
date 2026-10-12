/**
 * @file warmup.js
 * @description In-memory data cache shared by the pages, filled while the launch
 * splash is up (warmUp) so every section opens with its content already there.
 *
 * Pages read the cache first (peek / useWarm) and refresh in the background
 * (load with refresh=true): no loaders after the first launch, data stays fresh.
 * The ranking is kept live by a single shared Firestore listener.
 */

import {
  collection, doc, getDoc, getDocs, onSnapshot, orderBy, query,
} from "firebase/firestore";
import { db } from "./firebase";
import { getChampionshipDeadlineMs } from "../utils/championshipDeadline";
import { computeChampionshipStatistics } from "./statisticsService";
import { getRacePhoto } from "./racePhotoService";
import { fetchAllSessions, fetchDriverStandings, fetchConstructorStandings } from "./f1SessionsFetcher";
import { error } from "../utils/logger";

const cache = new Map();
const listeners = new Map();
const inflight = new Map();
const warmed = new Map();

/** @returns {*} The cached value for key, or undefined */
export const peek = (key) => cache.get(key);

/** Stores a value and notifies the subscribers of that key */
export function put(key, value) {
  cache.set(key, value);
  (listeners.get(key) || []).forEach((cb) => cb(value));
}

/**
 * Subscribes to changes of a key
 * @returns {Function} Unsubscribe
 */
export function subscribe(key, cb) {
  const set = listeners.get(key) || new Set();
  set.add(cb);
  listeners.set(key, set);
  return () => set.delete(cb);
}

/**
 * Memoized async load: one request per key, the result cached.
 * With refresh=true a cached value is returned at once and the loader still
 * runs in the background, updating the cache (stale-while-revalidate).
 * @template T
 * @param {string} key
 * @param {() => Promise<T>} loader
 * @param {boolean} [refresh=false]
 * @returns {Promise<T>}
 */
export function load(key, loader, refresh = false) {
  if (inflight.has(key)) return inflight.get(key);
  const run = () => {
    const p = loader()
      .then((v) => { put(key, v); return v; })
      .finally(() => inflight.delete(key));
    inflight.set(key, p);
    return p;
  };
  if (cache.has(key)) {
    if (refresh) run().catch(error);
    return Promise.resolve(cache.get(key));
  }
  return run();
}

/* ---------- Loaders ---------- */

const docs = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));

/** Season calendar, by date ascending */
export const loadRaces = (refresh) =>
  load("races", async () => docs(await getDocs(query(collection(db, "races"), orderBy("raceUTC", "asc")))), refresh);

/** users/{uid} → profile data */
export const loadUsers = (refresh) =>
  load("users", async () => {
    const snap = await getDocs(collection(db, "users"));
    const map = {};
    snap.docs.forEach((d) => { map[d.id] = d.data(); });
    return map;
  }, refresh);

/** Official championship results (null until calculated) */
export const loadChampionship = (refresh) =>
  load("championship", async () => {
    const snap = await getDoc(doc(db, "championship", "results"));
    return snap.exists() ? snap.data() : null;
  }, refresh);

export const loadDeadlineMs = (refresh) => load("championshipDeadlineMs", getChampionshipDeadlineMs, refresh);

/** Championship statistics, computed from the cached calendar and ranking (no extra reads) */
export const loadStatistics = (refresh) =>
  load("statistics", async () => {
    const [races, ranking] = await Promise.all([loadRaces(refresh), loadRankingOnce()]);
    return computeChampionshipStatistics(races, ranking);
  }, refresh);

/** Admin photo override of a race (null if none); read once per session */
export const loadRacePhoto = (raceId, refresh) => load(`racePhoto:${raceId}`, () => getRacePhoto(raceId), refresh);

export const submissionKey = (raceId, uid) => `sub:${raceId}:${uid}`;

/** The user's lineup for a race (null if none) */
export const loadSubmission = (raceId, uid, refresh) =>
  load(submissionKey(raceId, uid), async () => {
    const snap = await getDoc(doc(db, "races", raceId, "submissions", uid));
    return snap.exists() ? snap.data() : null;
  }, refresh);

export const sessionsKey = (race) => `sessions:${race.raceUTC.toDate().getFullYear()}-${race.round}`;

/** Jolpica sessions of a race weekend */
export const loadSessions = (race, refresh) =>
  load(sessionsKey(race), () => {
    const season = race.raceUTC.toDate().getFullYear();
    return fetchAllSessions(season, race.round, race.raceUTC, race.officialRound);
  }, refresh);

/** Jolpica driver and constructor standings */
export const loadStandings = (refresh) =>
  load("standings", async () => {
    const [drivers, constructors] = await Promise.all([fetchDriverStandings(), fetchConstructorStandings()]);
    return { drivers, constructors };
  }, refresh);

export const participantKey = (userId, viewerUid) => `participant:${userId}:${viewerUid || ""}`;

/**
 * Everything the player page shows: ranking entry, profile, position, race history.
 * Championship picks of other players stay hidden until the championship deadline.
 */
export const loadParticipant = (userId, viewerUid, refresh) =>
  load(participantKey(userId, viewerUid), async () => {
    // Ranking entry, profile, deadline and calendar come from the cache when there
    const [allRanking, users, deadlineMs, races] = await Promise.all([
      loadRankingOnce(),
      loadUsers(),
      loadDeadlineMs(),
      loadRaces(),
    ]);
    const userData = allRanking.find((r) => r.id === userId);
    if (!userData) return { notFound: true };
    const profileData = users[userId] || null;
    const championshipDeadlinePassed = deadlineMs ? Date.now() > deadlineMs : false;
    const showChampionship = championshipDeadlinePassed || viewerUid === userId;

    // Position with ties (competition ranking)
    const sorted = [...allRanking].sort((a, b) => (b.puntiTotali || 0) - (a.puntiTotali || 0));
    let pos = 1;
    let participantPosition = null;
    for (let i = 0; i < sorted.length; i++) {
      if (i > 0 && (sorted[i].puntiTotali || 0) < (sorted[i - 1].puntiTotali || 0)) pos = i + 1;
      if (sorted[i].id === userId) { participantPosition = pos; break; }
    }

    const now = Date.now();
    const pastRaces = races.filter((r) => r.raceUTC.toMillis() < now).reverse();
    const raceHistory = (
      await Promise.all(
        pastRaces.map(async (r) => {
          if (!r.officialResults) return null;
          try {
            const sub = await getDoc(doc(db, "races", r.id, "submissions", userId));
            return {
              raceId: r.id,
              raceName: r.name,
              round: r.round,
              raceUTC: r.raceUTC,
              submission: sub.exists() ? sub.data() : null,
              officialResults: r.officialResults,
              cancelledSprint: r.cancelledSprint || false,
              cancelledMain: r.cancelledMain || false,
            };
          } catch (err) {
            error(`Error fetching submission for race ${r.id}:`, err);
            return null;
          }
        })
      )
    ).filter(Boolean);

    return {
      participant: {
        userId,
        name: userData.name,
        puntiTotali: userData.puntiTotali || 0,
        pointsByRace: userData.pointsByRace || {},
        jolly: userData.jolly ?? 0,
        championshipPiloti: showChampionship ? (userData.championshipPiloti || []) : [],
        championshipCostruttori: showChampionship ? (userData.championshipCostruttori || []) : [],
        championshipPts: showChampionship ? (userData.championshipPts || 0) : 0,
      },
      userProfile: profileData
        ? { firstName: profileData.firstName || "", lastName: profileData.lastName || "", photoURL: profileData.photoURL || "" }
        : null,
      participantPosition,
      championshipDeadlinePassed,
      totalCompletedRaces: pastRaces.length,
      raceHistory,
    };
  }, refresh);

/* ---------- Live ranking (one shared listener) ---------- */

let rankingUnsub = null;
let rankingWaiters = [];

/** Starts the shared ranking listener (by points descending); idempotent */
export function watchRanking() {
  if (rankingUnsub) return;
  rankingUnsub = onSnapshot(
    query(collection(db, "ranking"), orderBy("puntiTotali", "desc")),
    (snap) => put("ranking", docs(snap)),
    (err) => {
      // Firestore ends the listener on an error (e.g. permission-denied after
      // sign-out): forget it so the next watchRanking() starts a fresh one
      error("[warmup] ranking listener:", err);
      rankingUnsub = null;
      rankingWaiters.splice(0).forEach(({ reject }) => reject(err));
    }
  );
}

/** Resolves with the ranking as soon as the listener has delivered it */
export function loadRankingOnce() {
  watchRanking();
  if (cache.has("ranking")) return Promise.resolve(cache.get("ranking"));
  return new Promise((resolve, reject) => {
    const waiter = { reject };
    rankingWaiters.push(waiter);
    const off = subscribe("ranking", (v) => {
      off();
      rankingWaiters = rankingWaiters.filter((w) => w !== waiter);
      resolve(v);
    });
  });
}

/** Drops everything (on sign-out): the next user starts from a clean cache */
export function resetWarmup() {
  if (rankingUnsub) rankingUnsub();
  rankingUnsub = null;
  rankingWaiters.splice(0).forEach(({ reject }) => reject(new Error("warmup reset")));
  cache.clear();
  inflight.clear();
  warmed.clear();
}

/* ---------- Warm-up ---------- */

/** Races closest to today: the one the Mondiale F1 page opens on */
const closestRace = (races, now = Date.now()) =>
  races.reduce((best, r) =>
    !best || Math.abs(r.raceUTC.toMillis() - now) < Math.abs(best.raceUTC.toMillis() - now) ? r : best, null);

/**
 * Loads what the main sections need before the splash goes away:
 * calendar, live ranking, profiles, championship, the user's lineup and player
 * page, the page chunks. External (Jolpica) data is fetched in the background.
 * @param {string} uid - Signed-in user
 * @returns {Promise<void>}
 */
export function warmUp(uid) {
  if (warmed.has(uid)) return warmed.get(uid);
  const p = (async () => {
    const chunks = [
      import("../pages/Home"),
      import("../pages/Formations"),
      import("../pages/History"),
      import("../pages/RaceResults"),
      import("../pages/ParticipantDetail"),
      import("../pages/Statistics"),
    ];
    // Chunks are awaited at most briefly: the charts bundle shouldn't hold the splash
    chunks.forEach((c) => c.catch(() => {}));
    const chunksOrTimeout = Promise.race([Promise.all(chunks), new Promise((r) => setTimeout(r, 2500))]);
    const [races] = await Promise.all([
      loadRaces(),
      loadRankingOnce(),
      loadUsers(),
      loadChampionship(),
      loadDeadlineMs(),
      loadStatistics(),
      chunksOrTimeout,
    ]);

    const now = Date.now();
    const nextRace = races.find((r) => !r.cancelledMain && r.raceUTC.toMillis() > now);
    await Promise.all([
      nextRace ? loadSubmission(nextRace.id, uid) : null,
      nextRace ? loadRacePhoto(nextRace.id).catch(error) : null,
      loadParticipant(uid, uid),
    ]);

    // Not awaited: the F1 pages open at once and fill in if these are still on the way
    const closest = closestRace(races, now);
    if (closest) loadSessions(closest).catch(error);
    loadStandings().catch(error);
  })().catch((err) => {
    error("[warmup]", err);
  });
  warmed.set(uid, p);
  return p;
}
