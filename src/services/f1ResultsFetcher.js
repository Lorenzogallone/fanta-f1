/**
 * @file F1 race results fetcher service
 * Automatically fetches F1 race results using Jolpica F1 API (official Ergast replacement)
 */

const API_BASE_URL = "http://api.jolpi.ca/ergast/f1";

/**
 * Mapping of driver names from API to app format
 * Common API formats: "Verstappen", "Leclerc", "Norris", etc.
 */
const DRIVER_NAME_MAPPING = {
  // Red Bull Racing
  "Verstappen": "Max Verstappen",
  "Perez": "Sergio Perez",
  "Pérez": "Sergio Perez",

  // Ferrari
  "Leclerc": "Charles Leclerc",
  "Sainz": "Carlos Sainz",
  "Hamilton": "Lewis Hamilton",

  // McLaren
  "Norris": "Lando Norris",
  "Piastri": "Oscar Piastri",

  // Mercedes
  "Russell": "George Russell",
  "Antonelli": "Andrea Kimi Antonelli",

  // Aston Martin
  "Alonso": "Fernando Alonso",
  "Stroll": "Lance Stroll",

  // Alpine
  "Gasly": "Pierre Gasly",
  "Doohan": "Jack Doohan",

  // Williams
  "Albon": "Alexander Albon",
  "Sainz Jr.": "Carlos Sainz",

  // RB (Racing Bulls)
  "Tsunoda": "Yuki Tsunoda",
  "Hadjar": "Isack Hadjar",

  // Kick Sauber
  "Hulkenberg": "Nico Hulkenberg",
  "Bortoleto": "Gabriel Bortoleto",
  "Hülkenberg": "Nico Hulkenberg",

  // Haas
  "Ocon": "Esteban Ocon",
  "Bearman": "Oliver Bearman",
};

/**
 * Normalizes driver name from API format to app format
 * @param {Object} driver - Driver object from API
 * @returns {string|null} Full driver name or null if not found
 */
function normalizeDriverName(driver) {
  if (!driver) return null;

  const familyName = driver.familyName;

  // Check mapping first
  if (DRIVER_NAME_MAPPING[familyName]) {
    return DRIVER_NAME_MAPPING[familyName];
  }

  // Fallback: construct full name
  const fullName = `${driver.givenName} ${driver.familyName}`;
  console.warn(`⚠️ Pilota non mappato: ${fullName}. Usare mapping manuale.`);

  return fullName;
}

/**
 * Fetches results for a specific race
 * @param {number} season - Season year (e.g., 2025)
 * @param {number} round - Race round number
 * @returns {Promise<Object|null>} Object with race and sprint results, or null if unavailable
 */
export async function fetchRaceResults(season, round) {
  try {
    console.log(`🔄 Fetching risultati per ${season} Round ${round}...`);

    // Fetch main race results
    const raceUrl = `${API_BASE_URL}/${season}/${round}/results.json`;
    const raceResponse = await fetch(raceUrl);

    if (!raceResponse.ok) {
      throw new Error(`Errore HTTP: ${raceResponse.status}`);
    }

    const raceData = await raceResponse.json();
    const races = raceData.MRData?.RaceTable?.Races;

    if (!races || races.length === 0) {
      console.warn(`⚠️ Nessun risultato trovato per ${season} Round ${round}`);
      return null;
    }

    const race = races[0];
    const results = race.Results;

    if (!results || results.length < 3) {
      console.warn(`⚠️ Risultati incompleti (meno di 3 piloti)`);
      return null;
    }

    // Extract top 3
    const mainResults = {
      P1: normalizeDriverName(results[0]?.Driver),
      P2: normalizeDriverName(results[1]?.Driver),
      P3: normalizeDriverName(results[2]?.Driver),
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
              SP1: normalizeDriverName(sprintResultsList[0]?.Driver),
              SP2: normalizeDriverName(sprintResultsList[1]?.Driver),
              SP3: normalizeDriverName(sprintResultsList[2]?.Driver),
            };
            console.log(`✅ Sprint trovata per Round ${round}`);
          }
        }
      }
    } catch (err) {
      console.log(`ℹ️ Nessuna sprint per Round ${round}`);
    }

    const result = {
      raceName: race.raceName,
      date: race.date,
      round: race.round,
      main: mainResults,
      sprint: sprintResults,
    };

    console.log(`✅ Risultati fetchati con successo:`, result);
    return result;

  } catch (error) {
    console.error(`❌ Errore durante il fetch dei risultati:`, error);
    throw new Error(`Impossibile caricare i risultati: ${error.message}`);
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

  } catch (error) {
    console.error(`❌ Errore durante il fetch dell'ultima gara:`, error);
    throw error;
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
