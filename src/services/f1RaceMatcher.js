/**
 * @file F1 race matcher
 * Maps an app race (identified by its date) to the official round on Jolpica
 * and to the meeting on OpenF1.
 *
 * Races store the official round in `officialRound` (set by the calendar
 * sync). When it is missing, races are matched by DATE, never by the `round`
 * stored in Firestore: that is only the display order and can differ from
 * the official calendar (cancelled or manually added races).
 */

import { log, warn } from '../utils/logger';

const ERGAST_API_BASE_URL = "https://api.jolpi.ca/ergast/f1";
const OPENF1_API_BASE_URL = "https://api.openf1.org/v1";

// Max distance between the app race date and the official race date
const MATCH_TOLERANCE_MS = 2 * 24 * 60 * 60 * 1000; // 2 days

// In-memory caches (one request per season per page load)
const scheduleCache = new Map();
const openF1SessionsCache = new Map();

/**
 * Converts a Date, Firestore Timestamp or ISO string to a Date
 * @param {Date|Object|string|number} value - Date-like value
 * @returns {Date|null} Date or null if invalid
 */
function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === "function") return value.toDate();
  if (typeof value.seconds === "number") return new Date(value.seconds * 1000);
  const d = new Date(value);
  return isNaN(d) ? null : d;
}

/**
 * Returns the item whose date is closest to the target, within tolerance
 * @param {Array} items - Items to search
 * @param {Function} getDate - Extracts a Date from an item
 * @param {Date} target - Target date
 * @returns {Object|null} Closest item or null
 */
function findClosestByDate(items, getDate, target) {
  let best = null;
  let bestDiff = Infinity;
  for (const item of items) {
    const d = getDate(item);
    if (!d) continue;
    const diff = Math.abs(d - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = item;
    }
  }
  return bestDiff <= MATCH_TOLERANCE_MS ? best : null;
}

/**
 * Fetches the official season schedule from Jolpica (cached)
 * @param {number} season - Season year
 * @returns {Promise<Array>} Races of the season (empty on error)
 */
export async function fetchSeasonSchedule(season) {
  if (scheduleCache.has(season)) return scheduleCache.get(season);

  const promise = (async () => {
    try {
      const response = await fetch(`${ERGAST_API_BASE_URL}/${season}.json?limit=100`);
      if (!response.ok) {
        warn(`[RaceMatcher] Schedule ${season} not available: ${response.status}`);
        return [];
      }
      const data = await response.json();
      return data.MRData?.RaceTable?.Races || [];
    } catch (err) {
      warn(`[RaceMatcher] Schedule ${season} fetch failed:`, err.message);
      return [];
    }
  })();

  scheduleCache.set(season, promise);
  const races = await promise;
  // Don't keep failed lookups cached, so a later call can retry
  if (races.length === 0) scheduleCache.delete(season);
  return races;
}

/**
 * Finds the official Jolpica race matching an app race date
 * @param {number} season - Season year
 * @param {Date|Object|string} raceDate - App race date (UTC)
 * @returns {Promise<Object|null>} { round, raceName, date } or null
 */
export async function findOfficialRace(season, raceDate) {
  const target = toDate(raceDate);
  if (!target) return null;

  const races = await fetchSeasonSchedule(season);
  const match = findClosestByDate(
    races,
    (r) => toDate(`${r.date}T${r.time || "12:00:00Z"}`),
    target
  );

  if (!match) {
    warn(`[RaceMatcher] No official race found near ${target.toISOString()} in ${season}`);
    return null;
  }

  return {
    round: parseInt(match.round),
    raceName: match.raceName,
    date: match.date,
  };
}

/**
 * Resolves the official round for an app race.
 * A stored `officialRound` always wins. Otherwise, without a date the local
 * round is trusted; with a date, only a race matched by date is accepted:
 * returning the local round could load another GP.
 * @param {number} season - Season year
 * @param {number} localRound - Round stored in the app
 * @param {Date|Object|string} [raceDate] - App race date (UTC)
 * @param {number} [officialRound] - Official round stored on the race
 * @returns {Promise<number|null>} Official round, or null if no race matches the date
 */
export async function resolveOfficialRound(season, localRound, raceDate, officialRound) {
  if (officialRound != null && Number.isInteger(Number(officialRound))) {
    return Number(officialRound);
  }
  if (!raceDate) return localRound;
  const official = await findOfficialRace(season, raceDate);
  if (!official) return null;
  if (official.round !== Number(localRound)) {
    log(`[RaceMatcher] Local R${localRound} → official R${official.round} (${official.raceName})`);
  }
  return official.round;
}

/**
 * Returns the official race date for a round (used when no app date is known)
 * @param {number} season - Season year
 * @param {number} round - Official round
 * @returns {Promise<Date|null>} Race date or null
 */
async function getOfficialRaceDate(season, round) {
  const races = await fetchSeasonSchedule(season);
  const race = races.find((r) => parseInt(r.round) === Number(round));
  return race ? toDate(`${race.date}T${race.time || "12:00:00Z"}`) : null;
}

/**
 * Finds the OpenF1 meeting (all its sessions) for a race.
 * Matches the "Race" session by date, so pre-season testing and
 * cancelled meetings never shift the result.
 * @param {number} season - Season year
 * @param {Object} options
 * @param {Date|Object|string} [options.raceDate] - App race date (UTC)
 * @param {number} [options.round] - Official round (used if no date)
 * @param {number} [options.officialRound] - Stored official round: its official date is used first
 * @param {Function} [options.fetchFn] - Fetch implementation (e.g. rate-limited)
 * @returns {Promise<Array|null>} Sessions of the meeting or null
 */
export async function findOpenF1Meeting(season, { raceDate, round, officialRound, fetchFn = fetch } = {}) {
  const target =
    (officialRound ? await getOfficialRaceDate(season, officialRound) : null) ||
    toDate(raceDate) ||
    (round ? await getOfficialRaceDate(season, round) : null);
  if (!target) {
    warn(`[RaceMatcher] Cannot match OpenF1 meeting: no date for ${season} R${round}`);
    return null;
  }

  let sessions = openF1SessionsCache.get(season);
  if (!sessions) {
    const response = await fetchFn(`${OPENF1_API_BASE_URL}/sessions?year=${season}`);
    if (!response.ok) {
      warn(`[RaceMatcher] OpenF1 sessions ${season} not available: ${response.status}`);
      return null;
    }
    sessions = await response.json();
    if (!Array.isArray(sessions)) return null;
    openF1SessionsCache.set(season, sessions);
  }

  const raceSessions = sessions.filter(
    (s) => s.session_name === "Race" && !s.is_cancelled
  );
  const raceSession = findClosestByDate(raceSessions, (s) => toDate(s.date_start), target);

  if (!raceSession) {
    warn(`[RaceMatcher] No OpenF1 race session near ${target.toISOString()}`);
    return null;
  }

  return sessions.filter((s) => s.meeting_key === raceSession.meeting_key && !s.is_cancelled);
}
