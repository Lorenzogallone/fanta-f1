/**
 * @file F1 race results fetcher service
 * Automatically fetches F1 race results using Jolpica F1 API (official Ergast replacement)
 * Falls back to OpenF1 API for recent races
 */

import { resolveDriver } from './f1DataResolver.js';
import { resolveOfficialRound, findOpenF1Meeting } from './f1RaceMatcher.js';
import { rateLimitedFetch } from './f1SessionsFetcher.js';
import { log, error, warn } from '../utils/logger';

const API_BASE_URL = "https://api.jolpi.ca/ergast/f1";  // HTTPS not HTTP!
const OPENF1_API_BASE_URL = "https://api.openf1.org/v1";

/**
 * Fetches the top 3 drivers of an OpenF1 session
 * @param {number} sessionKey - OpenF1 session key
 * @returns {Promise<Array<string>|null>} Driver names [P1, P2, P3] or null
 */
async function fetchOpenF1Top3(sessionKey) {
  const resultsResponse = await rateLimitedFetch(`${OPENF1_API_BASE_URL}/session_result?session_key=${sessionKey}`);
  if (!resultsResponse.ok) return null;

  const sessionResults = await resultsResponse.json();
  if (!Array.isArray(sessionResults) || sessionResults.length < 3) return null;

  const driversResponse = await rateLimitedFetch(`${OPENF1_API_BASE_URL}/drivers?session_key=${sessionKey}`);
  const driverInfo = {};
  if (driversResponse.ok) {
    const drivers = await driversResponse.json();
    drivers.forEach(d => {
      // Use resolveDriver for consistent name mapping
      const resolved = resolveDriver(
        { givenName: d.first_name, familyName: d.last_name, permanentNumber: d.driver_number },
        { name: d.team_name }
      );
      driverInfo[d.driver_number] = resolved?.displayName || `${d.first_name} ${d.last_name}`;
    });
  }

  // Drivers without a classified position (DNF/DSQ) go last
  const classified = sessionResults
    .filter(r => Number.isInteger(r.position))
    .sort((a, b) => a.position - b.position);

  if (classified.length < 3) return null;
  return classified.slice(0, 3).map(r => driverInfo[r.driver_number] || null);
}

/**
 * Fetches race and sprint top 3 from OpenF1. The two are independent: on a
 * sprint Saturday the race is still missing but the sprint is already there.
 * @param {number} season - Season year
 * @param {number} round - Official race round number
 * @param {Date|Object|string} [raceDate] - Race date, used to match the meeting
 * @param {number} [officialRound] - Official round stored on the race
 * @returns {Promise<Object|null>} { raceName, date, round, main|null, sprint|null } or null
 */
async function fetchFromOpenF1(season, round, raceDate, officialRound) {
  try {
    log(`[OpenF1] Fetching race results for ${season} R${round}...`);

    // Find the meeting by race date (robust to testing/cancelled meetings)
    const meetingSessions = await findOpenF1Meeting(season, { raceDate, round, officialRound, fetchFn: rateLimitedFetch });
    if (!meetingSessions) {
      warn(`[OpenF1] No meeting found for ${season} R${round}`);
      return null;
    }

    const started = (session) => !session?.date_start || new Date(session.date_start) <= new Date();
    const top3 = async (name) => {
      const session = meetingSessions.find((x) => x.session_name === name);
      if (!session || !started(session)) return null;
      return fetchOpenF1Top3(session.session_key);
    };

    const [raceTop3, sprintTop3] = await Promise.all([top3("Race"), top3("Sprint")]);
    const mainResults = raceTop3 ? { P1: raceTop3[0], P2: raceTop3[1], P3: raceTop3[2] } : null;
    const sprintResults = sprintTop3 ? { SP1: sprintTop3[0], SP2: sprintTop3[1], SP3: sprintTop3[2] } : null;

    if (!mainResults && !sprintResults) {
      warn(`[OpenF1] No race or sprint classification yet for ${season} R${round}`);
      return null;
    }

    const anySession = meetingSessions.find((x) => x.session_name === "Race") || meetingSessions[0];
    log(`[OpenF1] ✅ Results fetched:`, { main: mainResults, sprint: sprintResults });
    return {
      raceName: anySession?.meeting_official_name || `Round ${round}`,
      date: anySession?.date_start?.split('T')[0] || null,
      round,
      main: mainResults,
      sprint: sprintResults,
    };
  } catch (err) {
    error(`[OpenF1] Error fetching race results:`, err);
    return null;
  }
}

/**
 * Normalizes driver name from API format to app format
 * Uses the new f1DataResolver with cascading fallback system
 * @param {Object} driver - Driver object from API
 * @param {Object} constructor - Constructor object from API (optional)
 * @returns {string|null} Full driver name or null if not found
 */
function normalizeDriverName(driver, constructor = null) {
  if (!driver) return null;

  const resolved = resolveDriver(driver, constructor);
  return resolved?.displayName || null;
}

/**
 * Fetches results for a specific race
 * First tries Jolpica/Ergast API, then falls back to OpenF1 for recent races.
 * Uses the stored officialRound when available; otherwise, when raceDate is
 * given, the race is matched by date, so local round numbers that differ from
 * the official calendar still work.
 * @param {number} season - Season year (e.g., 2025)
 * @param {number} localRound - Race round number stored in the app
 * @param {Date|Object|string} [raceDate] - Race date (UTC)
 * @param {number} [officialRound] - Official round stored on the race
 * @param {boolean} [hasSprint] - Sprint weekend: also look the sprint up on OpenF1 when Jolpica lacks it
 * @returns {Promise<Object|null>} { main|null, sprint|null, ... }: either can be missing; null when neither is available
 */
export async function fetchRaceResults(season, localRound, raceDate, officialRound, hasSprint = false) {
  const round = await resolveOfficialRound(season, localRound, raceDate, officialRound);
  log(`🔄 Fetching results for ${season} Round ${round ?? `? (local R${localRound})`}...`);

  const top3From = (list, prefix) => (list && list.length >= 3
    ? {
        [`${prefix}1`]: normalizeDriverName(list[0]?.Driver, list[0]?.Constructor),
        [`${prefix}2`]: normalizeDriverName(list[1]?.Driver, list[1]?.Constructor),
        [`${prefix}3`]: normalizeDriverName(list[2]?.Driver, list[2]?.Constructor),
      }
    : null);

  // Jolpica race and sprint classifications, fetched independently: either
  // can be missing (sprint Saturday, or the sprint not published yet)
  const jolpica = async (path, key) => {
    try {
      const res = await fetch(`${API_BASE_URL}/${season}/${round}/${path}.json`);
      if (!res.ok) return null;
      const race = (await res.json()).MRData?.RaceTable?.Races?.[0];
      return race ? { race, list: race[key] } : null;
    } catch (err) {
      warn(`⚠️ Jolpica ${path} fetch failed:`, err.message);
      return null;
    }
  };

  let main = null;
  let sprint = null;
  let meta = {};

  // STEP 1: Jolpica/Ergast (more reliable for historical data)
  if (round !== null) {
    const [raceRes, sprintRes] = await Promise.all([
      jolpica("results", "Results"),
      jolpica("sprint", "SprintResults"),
    ]);
    main = top3From(raceRes?.list, "P");
    sprint = top3From(sprintRes?.list, "SP");
    const any = raceRes?.race || sprintRes?.race;
    if (any) meta = { raceName: any.raceName, date: any.date, round: any.round };
    if (main) log(`✅ Race results from Jolpica for Round ${round}`);
    if (sprint) log(`✅ Sprint results from Jolpica for Round ${round}`);
  }

  // STEP 2: OpenF1 fallback for whatever is still missing (faster updates).
  // The sprint is only looked up on sprint weekends.
  if (!main || (!sprint && hasSprint)) {
    try {
      const openF1Result = await fetchFromOpenF1(season, round, raceDate, officialRound);
      if (openF1Result) {
        main = main || openF1Result.main;
        sprint = sprint || openF1Result.sprint;
        if (!meta.raceName) meta = { raceName: openF1Result.raceName, date: openF1Result.date, round: openF1Result.round };
      }
    } catch (err) {
      warn(`⚠️ OpenF1 fetch failed:`, err.message);
    }
  }

  if (!main && !sprint) {
    warn(`⚠️ No results found for ${season} Round ${round} from any source`);
    return null;
  }

  return { ...meta, round: meta.round ?? round, main, sprint };
}

/**
 * Fetches results of the last completed race in the current season
 * @returns {Promise<Object|null>} Last race results or null
 */
export async function fetchLastRaceResults() {
  try {
    const url = `${API_BASE_URL}/current/last/results.json`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Errore HTTP: ${response.status}`);
    }

    const data = await response.json();
    const races = data.MRData?.RaceTable?.Races;

    if (!races || races.length === 0) {
      return null;
    }

    const race = races[0];
    const season = race.season;
    const round = race.round;

    // Use main function to get all details
    return await fetchRaceResults(season, round);

  } catch (err) {
    error(`❌ Error during fetching the last race:`, err);
    throw err;
  }
}

/**
 * Checks if race results are available
 * @param {number} season - Season year
 * @param {number} round - Race round number
 * @returns {Promise<boolean>} True if results are available
 */
export async function areResultsAvailable(season, round) {
  try {
    const url = `${API_BASE_URL}/${season}/${round}/results.json`;
    const response = await fetch(url);

    if (!response.ok) return false;

    const data = await response.json();
    const races = data.MRData?.RaceTable?.Races;

    return races && races.length > 0 && races[0].Results && races[0].Results.length >= 3;
  } catch {
    return false;
  }
}

/**
 * Extracts season and round from a race date
 * @param {Date} raceDate - Race date
 * @returns {Object} Object with season and estimatedRound numbers
 */
export function extractSeasonAndRound(raceDate) {
  const season = raceDate.getFullYear();

  // Approximate round estimate based on date
  // F1 starts around March, with ~24 races in ~9 months
  const startOfSeason = new Date(season, 2, 1); // March 1st
  const daysSinceStart = Math.floor((raceDate - startOfSeason) / (1000 * 60 * 60 * 24));
  const estimatedRound = Math.max(1, Math.floor(daysSinceStart / 14) + 1); // ~every 2 weeks

  return { season, estimatedRound };
}
