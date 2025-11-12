// src/services/f1ResultsFetcher.js
/**
 * Service per fetchare automaticamente i risultati delle gare F1
 * Usa Jolpica F1 API (sostituto ufficiale di Ergast)
 */

const API_BASE_URL = "http://api.jolpi.ca/ergast/f1";

/**
 * Mapping nomi piloti dall'API ai nomi utilizzati nell'app
 * Formati API comuni: "Verstappen", "Leclerc", "Norris", ecc.
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
 * Normalizza il nome del pilota dall'API al formato dell'app
 * @param {Object} driver - Oggetto driver dall'API
 * @returns {string|null} - Nome completo del pilota o null se non trovato
 */
function normalizeDriverName(driver) {
  if (!driver) return null;

  const familyName = driver.familyName;

  // Controlla prima nel mapping
  if (DRIVER_NAME_MAPPING[familyName]) {
    return DRIVER_NAME_MAPPING[familyName];
  }

  // Fallback: costruisci nome completo
  const fullName = `${driver.givenName} ${driver.familyName}`;
  console.warn(`⚠️ Pilota non mappato: ${fullName}. Usare mapping manuale.`);

  return fullName;
}

/**
 * Fetcha i risultati di una gara specifica
 * @param {number} season - Anno della stagione (es. 2025)
 * @param {number} round - Numero round della gara
 * @returns {Promise<Object|null>} - Oggetto con risultati gara e sprint, o null se non disponibili
 */
export async function fetchRaceResults(season, round) {
  try {
    console.log(`🔄 Fetching risultati per ${season} Round ${round}...`);

    // Fetch risultati gara principale
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

    // Estrai top 3
    const mainResults = {
      P1: normalizeDriverName(results[0]?.Driver),
      P2: normalizeDriverName(results[1]?.Driver),
      P3: normalizeDriverName(results[2]?.Driver),
    };

    // Fetch risultati sprint (se disponibili)
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
 * Fetcha i risultati dell'ultima gara disputata della stagione corrente
 * @returns {Promise<Object|null>} - Risultati ultima gara o null
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

    // Usa la funzione principale per ottenere tutti i dettagli
    return await fetchRaceResults(season, round);

  } catch (error) {
    console.error(`❌ Errore durante il fetch dell'ultima gara:`, error);
    throw error;
  }
}

/**
 * Verifica se i risultati di una gara sono già disponibili
 * @param {number} season - Anno della stagione
 * @param {number} round - Numero round della gara
 * @returns {Promise<boolean>} - true se i risultati sono disponibili
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
 * Estrae season e round da una data di gara
 * @param {Date} raceDate - Data della gara
 * @returns {Object} - { season: number, estimatedRound: number }
 */
export function extractSeasonAndRound(raceDate) {
  const season = raceDate.getFullYear();

  // Stima approssimativa del round basata sulla data
  // F1 inizia a marzo circa, con ~24 gare in ~9 mesi
  const startOfSeason = new Date(season, 2, 1); // 1 marzo
  const daysSinceStart = Math.floor((raceDate - startOfSeason) / (1000 * 60 * 60 * 24));
  const estimatedRound = Math.max(1, Math.floor(daysSinceStart / 14) + 1); // ~ogni 2 settimane

  return { season, estimatedRound };
}
