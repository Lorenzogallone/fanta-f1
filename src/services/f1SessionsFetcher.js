/**
 * @file F1 sessions fetcher service
 * Fetches all session data (FP1, FP2, FP3, Qualifying, Sprint, Race)
 * Uses OpenF1 API for practice sessions and Jolpica/Ergast API for qualifying, sprint, race
 */

import { resolveDriver, resolveTeam } from './f1DataResolver.js';
import { log, error, warn, info } from '../utils/logger';

const ERGAST_API_BASE_URL = "https://api.jolpi.ca/ergast/f1";
const OPENF1_API_BASE_URL = "https://api.openf1.org/v1";

// Rate limiting for OpenF1 API (max 3 requests per second)
// INCREASED to 600ms to avoid 429 errors - more conservative approach
let lastOpenF1Request = 0;
const OPENF1_MIN_INTERVAL = 600; // milliseconds between requests (very conservative to avoid 429)
const MAX_RETRIES = 4; // increased retries
const RETRY_BASE_DELAY = 2000; // increased base delay for exponential backoff

/**
 * Sleeps for a given amount of time
 * @param {number} ms - Milliseconds to sleep
 */
async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Rate-limited fetch for OpenF1 API with retry logic for 429 errors
 * @param {string} url - URL to fetch
 * @param {number} retryCount - Current retry attempt (default 0)
 * @returns {Promise<Response>} Fetch response
 */
async function rateLimitedFetch(url, retryCount = 0) {
  const now = Date.now();
  const timeSinceLastRequest = now - lastOpenF1Request;

  if (timeSinceLastRequest < OPENF1_MIN_INTERVAL) {
    await sleep(OPENF1_MIN_INTERVAL - timeSinceLastRequest);
  }

  lastOpenF1Request = Date.now();

  try {
    const response = await fetch(url);

    // Handle 429 Too Many Requests
    if (response.status === 429 && retryCount < MAX_RETRIES) {
      const retryDelay = RETRY_BASE_DELAY * Math.pow(2, retryCount);
      warn(`Rate limit hit (429) for ${url}. Retrying in ${retryDelay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`);
      await sleep(retryDelay);
      return rateLimitedFetch(url, retryCount + 1);
    }

    return response;
  } catch (err) {
    // Network error - retry with backoff
    if (retryCount < MAX_RETRIES) {
      const retryDelay = RETRY_BASE_DELAY * Math.pow(2, retryCount);
      warn(`Network error for ${url}. Retrying in ${retryDelay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`);
      await sleep(retryDelay);
      return rateLimitedFetch(url, retryCount + 1);
    }
    throw err;
  }
}

// Note: DRIVER_NAME_MAPPING removed - now using f1DataResolver for all driver/team resolution

/**
 * Mapping of driver numbers to names (2024-2025 season)
 * Used as fallback when API doesn't provide driver info
 */
const DRIVER_NUMBER_MAPPING = {
  1: "Max Verstappen",
  2: "Logan Sargeant", // 2024
  4: "Lando Norris",
  10: "Pierre Gasly",
  11: "Sergio Perez",
  14: "Fernando Alonso",
  16: "Charles Leclerc",
  18: "Lance Stroll",
  20: "Kevin Magnussen",
  22: "Yuki Tsunoda",
  23: "Alexander Albon",
  24: "Zhou Guanyu",
  27: "Nico Hülkenberg",
  31: "Esteban Ocon",
  38: "Oliver Bearman",
  43: "Franco Colapinto",
  44: "Lewis Hamilton",
  55: "Carlos Sainz Jr.",
  63: "George Russell",
  77: "Valtteri Bottas",
  81: "Oscar Piastri",
  // 2025 changes
  12: "Andrea Kimi Antonelli", // New at Mercedes
  17: "Jack Doohan", // New at Alpine
  25: "Isack Hadjar", // New at RB
  30: "Liam Lawson", // Racing Bulls
  50: "Gabriel Bortoleto", // New at Sauber
};

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
 * Converts time string to milliseconds for gap calculation
 * @param {string} time - Time in format "1:23.456"
 * @returns {number} Time in milliseconds
 */
function timeToMs(time) {
  if (!time) return 0;
  const parts = time.split(':');
  if (parts.length === 2) {
    const minutes = parseInt(parts[0]);
    const seconds = parseFloat(parts[1]);
    return (minutes * 60 + seconds) * 1000;
  }
  return parseFloat(time) * 1000;
}

/**
 * Calculates gap from leader
 * @param {number} leaderTimeMs - Leader time in milliseconds
 * @param {number} driverTimeMs - Driver time in milliseconds
 * @returns {string} Gap string (e.g., "+1.234")
 */
function calculateGap(leaderTimeMs, driverTimeMs) {
  if (leaderTimeMs === 0 || driverTimeMs === 0) return "—";
  const gap = (driverTimeMs - leaderTimeMs) / 1000;
  return gap > 0 ? `+${gap.toFixed(3)}` : "—";
}

/**
 * Fetches qualifying results for a race
 * @param {number} season - Season year
 * @param {number} round - Race round number
 * @returns {Promise<Array|null>} Array of qualifying results or null
 */
export async function fetchQualifying(season, round) {
  try {
    const url = `${ERGAST_API_BASE_URL}/${season}/${round}/qualifying.json`;
    const response = await fetch(url);

    if (!response.ok) return null;

    const data = await response.json();
    const races = data.MRData?.RaceTable?.Races;

    if (!races || races.length === 0) return null;

    const race = races[0];
    const qualifyingResults = race.QualifyingResults;

    if (!qualifyingResults || qualifyingResults.length === 0) return null;

    // Extract best time (Q3 > Q2 > Q1)
    const leaderTime = qualifyingResults[0].Q3 || qualifyingResults[0].Q2 || qualifyingResults[0].Q1;
    const leaderTimeMs = timeToMs(leaderTime);

    return qualifyingResults.map((result) => {
      const bestTime = result.Q3 || result.Q2 || result.Q1;
      const bestTimeMs = timeToMs(bestTime);

      return {
        position: result.position,
        driver: normalizeDriverName(result.Driver, result.Constructor),
        constructor: result.Constructor?.name,
        q1: result.Q1 || "—",
        q2: result.Q2 || "—",
        q3: result.Q3 || "—",
        bestTime: bestTime || "—",
        gap: calculateGap(leaderTimeMs, bestTimeMs),
      };
    });
  } catch (err) {
    error(`Error fetching qualifying for ${season} R${round}:`, err);
    return null;
  }
}

/**
 * Fetches sprint results for a race
 * @param {number} season - Season year
 * @param {number} round - Race round number
 * @returns {Promise<Array|null>} Array of sprint results or null
 */
export async function fetchSprint(season, round) {
  try {
    const url = `${ERGAST_API_BASE_URL}/${season}/${round}/sprint.json`;
    const response = await fetch(url);

    if (!response.ok) return null;

    const data = await response.json();
    const races = data.MRData?.RaceTable?.Races;

    if (!races || races.length === 0) return null;

    const race = races[0];
    const sprintResults = race.SprintResults;

    if (!sprintResults || sprintResults.length === 0) return null;

    // Leader time for gap calculation - find first driver with valid time
    let leaderTime = null;
    let leaderTimeMs = 0;
    for (const result of sprintResults) {
      if (result.Time?.time) {
        leaderTime = result.Time.time;
        leaderTimeMs = timeToMs(leaderTime);
        break;
      }
    }

    return sprintResults.map((result) => {
      const driverTime = result.Time?.time;
      const driverTimeMs = driverTime ? timeToMs(driverTime) : 0;

      // Calculate gap with improved handling
      let gap = "—";
      if (result.position === "1") {
        // Leader always shows dash
        gap = "—";
      } else if (leaderTimeMs > 0 && driverTimeMs > 0) {
        // Both leader and driver have valid times - calculate gap
        gap = calculateGap(leaderTimeMs, driverTimeMs);
      } else if (driverTime && !leaderTime) {
        // Driver has time but leader doesn't (edge case) - show time as gap
        gap = `+${driverTime}`;
      } else if (result.status && result.status !== "Finished") {
        // Show short status for DNF/retired drivers
        const statusMap = {
          "Retired": "RET",
          "Accident": "ACC",
          "Collision": "COL",
          "Spun off": "OFF",
          "Engine": "ENG",
          "Disqualified": "DSQ",
        };
        gap = statusMap[result.status] || result.status.substring(0, 3).toUpperCase();
      }

      return {
        position: result.position,
        driver: normalizeDriverName(result.Driver, result.Constructor),
        constructor: result.Constructor?.name,
        time: result.Time?.time || "—",
        gap,
        points: result.points || "0",
        status: result.status,
      };
    });
  } catch (err) {
    error(`Error fetching sprint for ${season} R${round}:`, err);
    return null;
  }
}

/**
 * Fetches sprint qualifying results from OpenF1 API
 * @param {number} season - Season year
 * @param {number} round - Race round number
 * @returns {Promise<Array|null>} Array of sprint qualifying results or null
 */
export async function fetchSprintQualifying(season, round) {
  try {
    // Get all sessions for the year
    const sessionsUrl = `${OPENF1_API_BASE_URL}/sessions?year=${season}`;
    const sessionsResponse = await rateLimitedFetch(sessionsUrl);

    if (!sessionsResponse.ok) return null;

    const sessions = await sessionsResponse.json();

    // Group sessions by meeting and sort by date
    const meetingMap = {};
    sessions.forEach(session => {
      if (!meetingMap[session.meeting_key]) {
        meetingMap[session.meeting_key] = {
          date: session.date_start,
          sessions: []
        };
      }
      meetingMap[session.meeting_key].sessions.push(session);
    });

    const sortedMeetings = Object.entries(meetingMap)
      .sort(([, a], [, b]) => new Date(a.date) - new Date(b.date))
      .map(([key, data]) => ({ meeting_key: key, ...data }));

    const targetMeeting = sortedMeetings[round - 1];
    if (!targetMeeting) return null;

    // Try different names for sprint qualifying
    const sprintQualifyingNames = [
      "Sprint Shootout",
      "Sprint Qualifying",
      "Sprint Quali",
      "Shootout"
    ];

    let targetSession = null;
    for (const name of sprintQualifyingNames) {
      targetSession = targetMeeting.sessions.find(s => s.session_name === name);
      if (targetSession) break;
    }

    // Also try Sprint session with Qualifying type
    if (!targetSession) {
      targetSession = targetMeeting.sessions.find(
        s => s.session_name === "Sprint" && s.session_type === "Qualifying"
      );
    }

    if (!targetSession) return null;

    // Fetch session results
    const resultsUrl = `${OPENF1_API_BASE_URL}/session_result?session_key=${targetSession.session_key}`;
    const resultsResponse = await rateLimitedFetch(resultsUrl);

    if (!resultsResponse.ok) return null;

    const sessionResults = await resultsResponse.json();
    if (!sessionResults || sessionResults.length === 0) return null;

    // Get driver info
    const driversUrl = `${OPENF1_API_BASE_URL}/drivers?session_key=${targetSession.session_key}`;
    const driversResponse = await rateLimitedFetch(driversUrl);

    let driverInfo = {};
    if (driversResponse.ok) {
      const drivers = await driversResponse.json();
      drivers.forEach(d => {
        const resolved = resolveDriver(
          { givenName: d.first_name, familyName: d.last_name, permanentNumber: d.driver_number },
          { name: d.team_name }
        );
        driverInfo[d.driver_number] = {
          name: resolved?.displayName || `${d.first_name} ${d.last_name}`,
          team: d.team_name
        };
      });
    }

    // Sort and format results
    sessionResults.sort((a, b) => a.position - b.position);

    return sessionResults.map(result => ({
      position: result.position,
      driver: driverInfo[result.driver_number]?.name || `Driver #${result.driver_number}`,
      constructor: driverInfo[result.driver_number]?.team || "—",
      time: result.time ? `${Math.floor(result.time / 60)}:${(result.time % 60).toFixed(3).padStart(6, '0')}` : "—",
      gap: result.gap_to_leader ? `+${result.gap_to_leader.toFixed(3)}` : "—",
    }));
  } catch (err) {
    warn(`Sprint qualifying not available for ${season} R${round}:`, err.message);
    return null;
  }
}

/**
 * Fetches race results
 * @param {number} season - Season year
 * @param {number} round - Race round number
 * @returns {Promise<Array|null>} Array of race results or null
 */
export async function fetchRace(season, round) {
  try {
    const url = `${ERGAST_API_BASE_URL}/${season}/${round}/results.json`;
    const response = await fetch(url);

    if (!response.ok) return null;

    const data = await response.json();
    const races = data.MRData?.RaceTable?.Races;

    if (!races || races.length === 0) return null;

    const race = races[0];
    const results = race.Results;

    if (!results || results.length === 0) return null;

    // Leader time for gap calculation
    const leaderTime = results[0].Time?.time;
    const leaderTimeMs = leaderTime ? timeToMs(leaderTime) : 0;

    return results.map((result) => {
      const driverTime = result.Time?.time;
      const driverTimeMs = driverTime ? timeToMs(driverTime) : 0;

      return {
        position: result.position,
        driver: normalizeDriverName(result.Driver, result.Constructor),
        constructor: result.Constructor?.name,
        time: result.Time?.time || "—",
        gap: result.position === "1" ? "—" : calculateGap(leaderTimeMs, driverTimeMs),
        points: result.points || "0",
        status: result.status,
        fastestLap: result.FastestLap?.rank === "1" ? "⚡" : "",
      };
    });
  } catch (err) {
    error(`Error fetching race for ${season} R${round}:`, err);
    return null;
  }
}

/**
 * Fetches all available sessions for a race
 * @param {number} season - Season year
 * @param {number} round - Race round number
 * @returns {Promise<Object>} Object with all session data
 */
export async function fetchAllSessions(season, round) {
  try {
    // Fetch critical sessions (Sprint, Qualifying, Race)
    const [sprint, qualifying, race] = await Promise.all([
      fetchSprint(season, round),
      fetchQualifying(season, round),
      fetchRace(season, round),
    ]);

    // If there's a sprint, try to fetch sprint qualifying
    let sprintQualifying = null;
    if (sprint !== null) {
      try {
        sprintQualifying = await fetchSprintQualifying(season, round);
        if (sprintQualifying) {
          log(`✅ Sprint Qualifying loaded for ${season} R${round}`);
        }
      } catch (err) {
        warn(`⚠️ Sprint Qualifying failed for ${season} R${round}:`, err.message);
      }
    }

    return {
      qualifying,
      sprintQualifying,
      sprint,
      race,
      hasQualifying: qualifying !== null,
      hasSprintQualifying: sprintQualifying !== null,
      hasSprint: sprint !== null,
      hasRace: race !== null,
    };
  } catch (err) {
    error(`Error fetching sessions for ${season} R${round}:`, err);
    return {
      qualifying: null,
      sprintQualifying: null,
      sprint: null,
      race: null,
      hasQualifying: false,
      hasSprintQualifying: false,
      hasSprint: false,
      hasRace: false,
    };
  }
}

/**
 * Fetches sessions for the last completed race
 * @returns {Promise<Object|null>} Last race sessions or null
 */
export async function fetchLastRaceSessions() {
  try {
    const url = `${ERGAST_API_BASE_URL}/current/last/results.json`;
    const response = await fetch(url);

    if (!response.ok) return null;

    const data = await response.json();
    const races = data.MRData?.RaceTable?.Races;

    if (!races || races.length === 0) return null;

    const race = races[0];
    const season = parseInt(race.season);
    const round = parseInt(race.round);

    const sessions = await fetchAllSessions(season, round);

    return {
      raceName: race.raceName,
      date: race.date,
      season,
      round,
      ...sessions,
    };
  } catch (err) {
    error("Error fetching last race sessions:", err);
    return null;
  }
}

/**
 * Checks if any session data is available for a race
 * @param {number} season - Season year
 * @param {number} round - Race round number
 * @returns {Promise<boolean>} True if any session is available
 */
export async function areSessionsAvailable(season, round) {
  try {
    const sessions = await fetchAllSessions(season, round);
    return (
      sessions.hasFP1 ||
      sessions.hasFP2 ||
      sessions.hasFP3 ||
      sessions.hasSprintQualifying ||
      sessions.hasQualifying ||
      sessions.hasSprint ||
      sessions.hasRace
    );
  } catch (error) {
    return false;
  }
}

/**
 * Fetches current driver standings
 * @param {number} season - Season year (optional, defaults to current)
 * @returns {Promise<Array|null>} Array of driver standings or null
 */
export async function fetchDriverStandings(season = "current") {
  try {
    const url = `${ERGAST_API_BASE_URL}/${season}/driverStandings.json`;
    const response = await fetch(url);

    if (!response.ok) return null;

    const data = await response.json();
    const standings = data.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings;

    if (!standings || standings.length === 0) return null;

    return standings.map((standing) => ({
      position: standing.position,
      points: standing.points,
      wins: standing.wins,
      driver: normalizeDriverName(standing.Driver, standing.Constructors?.[0]),
      constructor: standing.Constructors?.[0]?.name || "—",
    }));
  } catch (err) {
    error(`Error fetching driver standings for ${season}:`, err);
    return null;
  }
}

/**
 * Normalizes constructor/team names from API to match our app's team names
 * Uses the new f1DataResolver with cascading fallback system
 * @param {string} teamName - Team name from API
 * @returns {string} Normalized team name
 */
function normalizeTeamName(teamName) {
  if (!teamName) return "—";

  const resolved = resolveTeam(teamName);
  return resolved?.displayName || teamName;
}

/**
 * Fetches current constructor standings
 * @param {number} season - Season year (optional, defaults to current)
 * @returns {Promise<Array|null>} Array of constructor standings or null
 */
export async function fetchConstructorStandings(season = "current") {
  try {
    const url = `${ERGAST_API_BASE_URL}/${season}/constructorStandings.json`;
    const response = await fetch(url);

    if (!response.ok) return null;

    const data = await response.json();
    const standings = data.MRData?.StandingsTable?.StandingsLists?.[0]?.ConstructorStandings;

    if (!standings || standings.length === 0) return null;

    return standings.map((standing) => ({
      position: standing.position,
      points: standing.points,
      wins: standing.wins,
      constructor: normalizeTeamName(standing.Constructor?.name) || "—",
    }));
  } catch (err) {
    error(`Error fetching constructor standings for ${season}:`, err);
    return null;
  }
}
