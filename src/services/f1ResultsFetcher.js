/**
 * @file F1 race results fetcher service
 * Automatically fetches F1 race results using Jolpica F1 API (official Ergast replacement)
 * Falls back to OpenF1 API for recent races
 */

import { resolveDriver } from './f1DataResolver.js';
import { fetchRace } from './f1SessionsFetcher.js';
import { log, error, warn } from '../utils/logger';

const API_BASE_URL = "http://api.jolpi.ca/ergast/f1";

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
  try {
    log(`🔄 Fetching results for ${season} Round ${round}...`);

    // STEP 1: Try Jolpica/Ergast API first (more reliable for historical data)
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

    // STEP 2: Fallback to OpenF1 API (faster updates for recent races)
    warn(`⚠️ No results from Jolpica/Ergast, trying OpenF1 API fallback...`);

    const openF1Results = await fetchRace(season, round);

    if (openF1Results && openF1Results.length >= 3) {
      const mainResults = {
        P1: openF1Results[0]?.driver || null,
        P2: openF1Results[1]?.driver || null,
        P3: openF1Results[2]?.driver || null,
      };

      const result = {
        raceName: `Round ${round}`, // OpenF1 doesn't provide race name in results
        date: null,
        round: round,
        main: mainResults,
        sprint: null, // Sprint handled separately if needed
      };

      log(`✅ Results fetched from OpenF1 fallback:`, result);
      return result;
    }

    // No results available from either API
    warn(`⚠️ No results found for ${season} Round ${round} from any source`);
    return null;

  } catch (err) {
    error(`❌ Error during fetching results:`, err);
    throw new Error(`Unable to load results: ${err.message}`);
  }
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
