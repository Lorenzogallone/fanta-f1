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
 * Fetches practice session results from OpenF1 API using laps endpoint (reliable method)
 * @param {number} season - Season year
 * @param {number} round - Race round number (used to match with Ergast data)
 * @param {string} sessionName - Session name: "Practice 1", "Practice 2", "Practice 3", "Sprint Qualifying", "Sprint Shootout"
 * @returns {Promise<Array|null>} Array of practice results or null
 */
export async function fetchPracticeSession(season, round, sessionName) {
  try {
    // Step 1: Get all sessions for the year
    const sessionsUrl = `${OPENF1_API_BASE_URL}/sessions?year=${season}`;
    const sessionsResponse = await rateLimitedFetch(sessionsUrl);

    if (!sessionsResponse.ok) {
      warn(`Failed to fetch sessions list for ${season}: ${sessionsResponse.status}`);
      return null;
    }

    const sessions = await sessionsResponse.json();

    // Group sessions by meeting_key and sort by date
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

    // Sort meetings by date to get proper round order
    const sortedMeetings = Object.entries(meetingMap)
      .sort(([, a], [, b]) => new Date(a.date) - new Date(b.date))
      .map(([key, data]) => ({ meeting_key: key, ...data }));

    // Get the meeting for this round (rounds start from 1, array from 0)
    const targetMeeting = sortedMeetings[round - 1];
    if (!targetMeeting) {
      warn(`No meeting found for ${season} R${round}. Total meetings: ${sortedMeetings.length}`);
      return null;
    }

    // Find the session with the matching name in this meeting
    // Special handling: Sprint Qualifying can be session_name="Sprint" + session_type="Qualifying"
    let targetSession = targetMeeting.sessions.find(
      s => s.session_name === sessionName
    );

    // If looking for "Sprint Shootout" or "Sprint Qualifying" and not found, try alternate matching
    if (!targetSession && (sessionName === "Sprint Shootout" || sessionName === "Sprint Qualifying")) {
      // Look for session_name="Sprint" with session_type="Qualifying"
      targetSession = targetMeeting.sessions.find(
        s => s.session_name === "Sprint" && s.session_type === "Qualifying"
      );
      if (targetSession) {
        info(`[OpenF1] Found sprint qualifying as session_name="Sprint" + session_type="Qualifying" for ${season} R${round}`);
      }
    }

    if (!targetSession) {
      // Log available sessions for debugging when target session not found
      const availableSessions = targetMeeting.sessions.map(s => `${s.session_name} (${s.session_type})`).join(', ');
      info(`[OpenF1] Session "${sessionName}" not found for ${season} R${round}.`);
      info(`[OpenF1] Available sessions: ${availableSessions}`);
      return null;
    }

    log(`[OpenF1] Found session "${sessionName}" for ${season} R${round} with key ${targetSession.session_key}`);

    const sessionKey = targetSession.session_key;

    // Step 2: Fetch all laps for this session (using reliable laps endpoint)
    const lapsUrl = `${OPENF1_API_BASE_URL}/laps?session_key=${sessionKey}`;
    const lapsResponse = await rateLimitedFetch(lapsUrl);

    if (!lapsResponse.ok) {
      warn(`[OpenF1] Laps not available for ${sessionName} ${season} R${round}: ${lapsResponse.status}`);
      return null;
    }

    const laps = await lapsResponse.json();

    if (!laps || laps.length === 0) {
      info(`[OpenF1] No laps data for ${sessionName} ${season} R${round}`);
      return null;
    }

    log(`[OpenF1] ✅ Got ${laps.length} laps for ${sessionName} ${season} R${round}`);

    // Step 3: Process laps to find best lap for each driver
    // Filter out invalid laps and prioritize accurate ones
    const driverBestLaps = {};

    laps.forEach((lap) => {
      // Skip invalid laps: pit laps, or laps without duration
      if (!lap.lap_duration || lap.is_pit_out_lap) return;

      const driverNumber = lap.driver_number;
      const lapTime = lap.lap_duration;

      // Update if this is the driver's first lap or a faster lap
      if (!driverBestLaps[driverNumber] || lapTime < driverBestLaps[driverNumber].time) {
        driverBestLaps[driverNumber] = {
          time: lapTime,
          lapNumber: lap.lap_number,
        };
      }
    });

    if (Object.keys(driverBestLaps).length === 0) {
      info(`[OpenF1] No valid laps found for ${sessionName} ${season} R${round}`);
      return null;
    }

    // Step 4: Get driver info to map numbers to names
    const driversUrl = `${OPENF1_API_BASE_URL}/drivers?session_key=${sessionKey}`;
    const driversResponse = await rateLimitedFetch(driversUrl);

    let driverInfo = {};
    if (driversResponse.ok) {
      const drivers = await driversResponse.json();
      drivers.forEach(d => {
        driverInfo[d.driver_number] = {
          name: normalizeDriverName(
            { givenName: d.first_name, familyName: d.last_name, permanentNumber: d.driver_number },
            { name: d.team_name }
          ),
          team: d.team_name,
        };
      });
    }

    // Step 5: Create sorted results array with fallback driver mapping
    const results = Object.entries(driverBestLaps)
      .map(([driverNumber, data]) => {
        const driverNum = parseInt(driverNumber);
        const driverName = driverInfo[driverNumber]?.name
          || DRIVER_NUMBER_MAPPING[driverNum]
          || `Driver #${driverNumber}`;

        return {
          driverNumber: driverNum,
          driver: driverName,
          constructor: driverInfo[driverNumber]?.team || "—",
          bestTime: data.time,
          bestTimeFormatted: formatLapTime(data.time),
          lapNumber: data.lapNumber,
        };
      })
      .sort((a, b) => a.bestTime - b.bestTime);

    // Add position and gap
    const leaderTime = results[0]?.bestTime || 0;
    results.forEach((result, idx) => {
      result.position = idx + 1;
      result.gap = idx === 0 ? "—" : `+${(result.bestTime - leaderTime).toFixed(3)}`;
    });

    log(`[OpenF1] ✅ Processed ${results.length} drivers for ${sessionName} ${season} R${round}`);

    return results;
  } catch (err) {
    error(`Error fetching ${sessionName} for ${season} R${round}:`, err);
    return null;
  }
}

/**
 * Formats lap time from seconds to MM:SS.mmm format
 * @param {number} seconds - Time in seconds
 * @returns {string} Formatted time string
 */
function formatLapTime(seconds) {
  if (!seconds) return "—";
  const minutes = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(3);
  return `${minutes}:${secs.padStart(6, '0')}`;
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
    // Step 1: Fetch critical sessions first (Sprint, Qualifying, Race)
    // These use Ergast API which is more reliable
    // Practice sessions are fetched separately with individual error handling
    const [sprint, qualifying, race] = await Promise.all([
      fetchSprint(season, round),
      fetchQualifying(season, round),
      fetchRace(season, round),
    ]);

    // Step 2: Fetch practice sessions with individual error handling
    // Each practice session can fail independently without affecting others
    let fp1 = null;
    let fp2 = null;
    let fp3 = null;
    let sprintQualifying = null;

    // Fetch FP1 (always present, except sprint weekends without FP1)
    try {
      fp1 = await fetchPracticeSession(season, round, "Practice 1");
      if (fp1) {
        log(`✅ [Practice Sessions] FP1 loaded for ${season} R${round}`);
      }
    } catch (err) {
      warn(`⚠️ [Practice Sessions] FP1 failed for ${season} R${round}:`, err.message);
    }

    // Step 3: Based on weekend type, fetch additional sessions
    if (sprint !== null) {
      // Sprint weekend: has Sprint Qualifying/Shootout, NO FP2/FP3
      info(`[Sprint Weekend] Detected sprint for ${season} R${round}. Searching for sprint qualifying...`);

      // Try all possible names for sprint qualifying (varies by season and API naming)
      const sprintQualifyingNames = [
        "Sprint Shootout",      // 2024+ name
        "Sprint Qualifying",    // 2023 and older
        "Sprint Quali",         // Alternative short name
        "Shootout",            // Alternative name
        "Sprint",              // Just "Sprint" as fallback
      ];

      for (const name of sprintQualifyingNames) {
        try {
          log(`[Sprint Weekend] Trying sprint qualifying name: "${name}"`);
          sprintQualifying = await fetchPracticeSession(season, round, name);
          if (sprintQualifying !== null) {
            info(`✅ [Sprint Weekend] Found sprint qualifying as: "${name}" for ${season} R${round}`);
            break;
          }
        } catch (err) {
          warn(`⚠️ [Sprint Weekend] Failed to fetch "${name}":`, err.message);
        }
      }

      // If still not found, log detailed warning
      if (!sprintQualifying) {
        warn(`❌ [Sprint Weekend] Sprint qualifying NOT FOUND for ${season} R${round}.`);
        warn(`[Sprint Weekend] Tried all variants: ${sprintQualifyingNames.join(', ')}`);
      }
    } else {
      // Normal weekend: has FP2 and FP3, NO Sprint Qualifying
      // Fetch FP2
      try {
        fp2 = await fetchPracticeSession(season, round, "Practice 2");
        if (fp2) {
          log(`✅ [Practice Sessions] FP2 loaded for ${season} R${round}`);
        }
      } catch (err) {
        warn(`⚠️ [Practice Sessions] FP2 failed for ${season} R${round}:`, err.message);
      }

      // Fetch FP3
      try {
        fp3 = await fetchPracticeSession(season, round, "Practice 3");
        if (fp3) {
          log(`✅ [Practice Sessions] FP3 loaded for ${season} R${round}`);
        }
      } catch (err) {
        warn(`⚠️ [Practice Sessions] FP3 failed for ${season} R${round}:`, err.message);
      }
    }

    return {
      fp1,
      fp2,
      fp3,
      sprintQualifying,
      qualifying,
      sprint,
      race,
      hasFP1: fp1 !== null,
      hasFP2: fp2 !== null,
      hasFP3: fp3 !== null,
      hasSprintQualifying: sprintQualifying !== null,
      hasQualifying: qualifying !== null,
      hasSprint: sprint !== null,
      hasRace: race !== null,
    };
  } catch (err) {
    error(`Error fetching sessions for ${season} R${round}:`, err);
    return {
      fp1: null,
      fp2: null,
      fp3: null,
      sprintQualifying: null,
      qualifying: null,
      sprint: null,
      race: null,
      hasFP1: false,
      hasFP2: false,
      hasFP3: false,
      hasSprintQualifying: false,
      hasQualifying: false,
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
