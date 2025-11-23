/**
 * @file F1 race results fetcher service
 * Automatically fetches F1 race results using Jolpica F1 API (official Ergast replacement)
 * Falls back to OpenF1 API for recent races
 */

import { resolveDriver } from './f1DataResolver.js';
import { log, error, warn } from '../utils/logger';

const API_BASE_URL = "https://api.jolpi.ca/ergast/f1";  // HTTPS not HTTP!
const OPENF1_API_BASE_URL = "https://api.openf1.org/v1";

/**
 * Fetches race results from OpenF1 API
 * @param {number} season - Season year
 * @param {number} round - Race round number
 * @returns {Promise<Object|null>} Race results or null
 */
async function fetchFromOpenF1(season, round) {
  try {
    log(`[OpenF1] Fetching race results for ${season} R${round}...`);

    // Step 1: Get all sessions for the year
    const sessionsUrl = `${OPENF1_API_BASE_URL}/sessions?year=${season}`;
    const sessionsResponse = await fetch(sessionsUrl);

    if (!sessionsResponse.ok) {
      warn(`[OpenF1] Failed to fetch sessions list: ${sessionsResponse.status}`);
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

    // Get the meeting for this round
    const targetMeeting = sortedMeetings[round - 1];
    if (!targetMeeting) {
      warn(`[OpenF1] No meeting found for ${season} R${round}`);
      return null;
    }

    // Find the Race session
    const raceSession = targetMeeting.sessions.find(
      s => s.session_name === "Race" || s.session_type === "Race"
    );

    if (!raceSession) {
      warn(`[OpenF1] No race session found for ${season} R${round}`);
      return null;
    }

    const sessionKey = raceSession.session_key;
    log(`[OpenF1] Found race session with key ${sessionKey}`);

    // Step 2: Fetch race results (classification)
    // Try /session_result endpoint first (beta but works for races)
    const resultsUrl = `${OPENF1_API_BASE_URL}/session_result?session_key=${sessionKey}`;
    const resultsResponse = await fetch(resultsUrl);

    if (!resultsResponse.ok) {
      warn(`[OpenF1] Session results not available: ${resultsResponse.status}`);
      return null;
    }

    const sessionResults = await resultsResponse.json();

    if (!sessionResults || sessionResults.length < 3) {
      warn(`[OpenF1] Incomplete race results (less than 3 drivers)`);
      return null;
    }

    // Step 3: Get driver info to map numbers to names
    const driversUrl = `${OPENF1_API_BASE_URL}/drivers?session_key=${sessionKey}`;
    const driversResponse = await fetch(driversUrl);

    let driverInfo = {};
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

    // Sort results by position
    sessionResults.sort((a, b) => a.position - b.position);

    // Extract top 3
    const mainResults = {
      P1: driverInfo[sessionResults[0]?.driver_number] || null,
      P2: driverInfo[sessionResults[1]?.driver_number] || null,
      P3: driverInfo[sessionResults[2]?.driver_number] || null,
    };

    log(`[OpenF1] ✅ Race results fetched:`, mainResults);

    return {
      raceName: raceSession.meeting_official_name || `Round ${round}`,
      date: raceSession.date_start?.split('T')[0] || null,
      round: round,
      main: mainResults,
      sprint: null, // Sprint handled separately if needed
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
 * First tries Jolpica/Ergast API, then falls back to OpenF1 for recent races
 * @param {number} season - Season year (e.g., 2025)
 * @param {number} round - Race round number
 * @returns {Promise<Object|null>} Object with race and sprint results, or null if unavailable
 */
export async function fetchRaceResults(season, round) {
  log(`🔄 Fetching results for ${season} Round ${round}...`);

  // STEP 1: Try Jolpica/Ergast API first (more reliable for historical data)
  try {
    const raceUrl = `${API_BASE_URL}/${season}/${round}/results.json`;
    const raceResponse = await fetch(raceUrl);

    if (raceResponse.ok) {
      const raceData = await raceResponse.json();
      const races = raceData.MRData?.RaceTable?.Races;

      if (races && races.length > 0) {
        const race = races[0];
        const results = race.Results;

        if (results && results.length >= 3) {
          // Extract top 3 (pass Constructor for team inference)
          const mainResults = {
            P1: normalizeDriverName(results[0]?.Driver, results[0]?.Constructor),
            P2: normalizeDriverName(results[1]?.Driver, results[1]?.Constructor),
            P3: normalizeDriverName(results[2]?.Driver, results[2]?.Constructor),
          };

          // Fetch sprint results (if available)
          let sprintResults = null;
          try {
            const sprintUrl = `${API_BASE_URL}/${season}/${round}/sprint.json`;
            const sprintResponse = await fetch(sprintUrl);

            if (sprintResponse.ok) {
              const sprintData = await sprintResponse.json();
              const sprints = sprintData.MRData?.RaceTable?.Races;

              if (sprints && sprints.length > 0) {
                const sprint = sprints[0];
                const sprintResultsList = sprint.SprintResults;

                if (sprintResultsList && sprintResultsList.length >= 3) {
                  sprintResults = {
                    SP1: normalizeDriverName(sprintResultsList[0]?.Driver, sprintResultsList[0]?.Constructor),
                    SP2: normalizeDriverName(sprintResultsList[1]?.Driver, sprintResultsList[1]?.Constructor),
                    SP3: normalizeDriverName(sprintResultsList[2]?.Driver, sprintResultsList[2]?.Constructor),
                  };
                  log(`✅ Sprint found for Round ${round}`);
                }
              }
            }
          } catch (err) {
            log(`ℹ️ No sprint for Round ${round}`);
          }

          const result = {
            raceName: race.raceName,
            date: race.date,
            round: race.round,
            main: mainResults,
            sprint: sprintResults,
          };

          log(`✅ Results fetched from Jolpica/Ergast:`, result);
          return result;
        }
      }
    }

    // Response not OK or no data
    warn(`⚠️ Jolpica/Ergast: No results (${raceResponse.status})`);
  } catch (err) {
    // Network error, CORS, or other fetch error
    warn(`⚠️ Jolpica/Ergast fetch failed:`, err.message);
  }

  // STEP 2: Fallback to OpenF1 API (faster updates for recent races)
  warn(`⚠️ Trying OpenF1 API fallback...`);

  try {
    const openF1Result = await fetchFromOpenF1(season, round);

    if (openF1Result) {
      log(`✅ Results fetched from OpenF1 fallback:`, openF1Result);
      return openF1Result;
    }

    warn(`⚠️ OpenF1: No results found`);
  } catch (err) {
    warn(`⚠️ OpenF1 fetch failed:`, err.message);
  }

  // No results available from either API
  warn(`⚠️ No results found for ${season} Round ${round} from any source`);
  return null;
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
  } catch (error) {
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
