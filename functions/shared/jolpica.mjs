/**
 * @file Jolpica (Ergast replacement) access shared by the web app and the
 * Cloud Functions. Fetches the season snapshot used by the sync: schedule,
 * driver standings (every driver who started a race) and the last race
 * classification (current driver → team pairs).
 */

import { hashValue } from "./syncUtils.mjs";

export const JOLPICA_BASE_URL = "https://api.jolpi.ca/ergast/f1";

/**
 * Italian names of the official races. Keys are Jolpica `raceName` values;
 * values follow the names already used in the app.
 */
const RACE_NAMES_IT = {
  "Australian Grand Prix": "Gran Premio d'Australia",
  "Chinese Grand Prix": "Gran Premio di Cina",
  "Japanese Grand Prix": "Gran Premio del Giappone",
  "Bahrain Grand Prix": "Gran Premio del Bahrein",
  "Bahrain Grand Prix in Malaysia": "Gran Premio di Malaysia/Bahrain",
  "Saudi Arabian Grand Prix": "Gran Premio dell'Arabia Saudita",
  "Miami Grand Prix": "Gran Premio di Miami",
  "Emilia Romagna Grand Prix": "Gran Premio dell'Emilia-Romagna",
  "Canadian Grand Prix": "Gran Premio del Canada",
  "Monaco Grand Prix": "Gran Premio di Monaco",
  "Barcelona Grand Prix": "Gran Premio di Barcellona",
  "Spanish Grand Prix": "Gran Premio di Spagna",
  "Madrid Grand Prix": "Gran Premio di Madrid",
  "Austrian Grand Prix": "Gran Premio d'Austria",
  "British Grand Prix": "Gran Premio di Gran Bretagna",
  "Belgian Grand Prix": "Gran Premio del Belgio",
  "Hungarian Grand Prix": "Gran Premio d'Ungheria",
  "Dutch Grand Prix": "Gran Premio d'Olanda",
  "Italian Grand Prix": "Gran Premio d'Italia",
  "Azerbaijan Grand Prix": "Gran Premio d'Azerbaijan",
  "Singapore Grand Prix": "Gran Premio di Singapore",
  "United States Grand Prix": "Gran Premio degli Stati Uniti d'America",
  "Mexico City Grand Prix": "Gran Premio di Città del Messico",
  "Mexican Grand Prix": "Gran Premio del Messico",
  "Brazilian Grand Prix": "Gran Premio del Brasile",
  "São Paulo Grand Prix": "Gran Premio di San Paolo",
  "Las Vegas Grand Prix": "Gran Premio di Las Vegas",
  "Qatar Grand Prix": "Gran Premio del Qatar",
  "Abu Dhabi Grand Prix": "Gran Premio di Abu Dhabi",
  "Portuguese Grand Prix": "Gran Premio del Portogallo",
  "French Grand Prix": "Gran Premio di Francia",
  "German Grand Prix": "Gran Premio di Germania",
  "Russian Grand Prix": "Gran Premio di Russia",
  "Turkish Grand Prix": "Gran Premio di Turchia",
  "Malaysian Grand Prix": "Gran Premio di Malesia",
  "Korean Grand Prix": "Gran Premio di Corea",
  "Indian Grand Prix": "Gran Premio dell'India",
  "Vietnamese Grand Prix": "Gran Premio del Vietnam",
  "South African Grand Prix": "Gran Premio del Sudafrica",
  "Argentine Grand Prix": "Gran Premio d'Argentina",
};

/**
 * Translates an official (English) race name to Italian
 * @param {string} name - Jolpica raceName (e.g. "Miami Grand Prix")
 * @returns {string} Italian name (e.g. "Gran Premio di Miami")
 */
export function translateRaceName(name) {
  if (!name) return name;
  if (RACE_NAMES_IT[name]) return RACE_NAMES_IT[name];
  const m = /^(.+?) Grand Prix$/.exec(name);
  return m ? `Gran Premio di ${m[1]}` : name;
}

/**
 * Builds a UTC Date from Jolpica date/time fields
 * @param {Object|null} session - Object with `date` and optional `time`
 * @returns {Date|null}
 */
function sessionDate(session) {
  if (!session?.date) return null;
  const d = new Date(`${session.date}T${session.time || "12:00:00Z"}`);
  return isNaN(d) ? null : d;
}

/**
 * Normalizes the Jolpica schedule to the fields stored on races/{id}
 * @param {Array} races - MRData.RaceTable.Races
 * @returns {Array<Object>} [{ officialRound, apiName, name, raceUTC, qualiUTC, sprintUTC, qualiSprintUTC }]
 */
export function normalizeJolpicaSchedule(races) {
  return (races || [])
    .map((r) => ({
      officialRound: parseInt(r.round, 10),
      apiName: r.raceName,
      name: translateRaceName(r.raceName),
      raceUTC: sessionDate(r),
      qualiUTC: sessionDate(r.Qualifying),
      sprintUTC: sessionDate(r.Sprint),
      qualiSprintUTC: sessionDate(r.SprintQualifying),
    }))
    .filter((r) => Number.isInteger(r.officialRound) && r.raceUTC);
}

/**
 * GET helper returning parsed JSON, or null on 404
 * @param {Function} fetchFn - fetch implementation
 * @param {string} path - Path after the base URL
 * @returns {Promise<Object|null>}
 */
async function getJson(fetchFn, path) {
  const res = await fetchFn(`${JOLPICA_BASE_URL}/${path}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Jolpica ${path}: HTTP ${res.status}`);
  return res.json();
}

/**
 * Fetches everything the sync needs for a season (3 requests, sequential to
 * respect Jolpica's 4 req/s limit). Throws on network/HTTP errors, and when
 * the schedule is empty, so callers never act on partial data.
 * @param {number} season - Season year
 * @param {Function} [fetchFn] - fetch implementation
 * @returns {Promise<Object>} { season, schedule, standings, lastResults, hash }
 */
export async function fetchJolpicaSnapshot(season, fetchFn = fetch) {
  const scheduleJson = await getJson(fetchFn, `${season}.json?limit=100`);
  const schedule = normalizeJolpicaSchedule(scheduleJson?.MRData?.RaceTable?.Races);
  if (schedule.length === 0) {
    throw new Error(`Jolpica: empty schedule for ${season}`);
  }

  const standingsJson = await getJson(fetchFn, `${season}/driverStandings.json?limit=100`);
  const standings = (
    standingsJson?.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings || []
  ).map((s) => ({
    driver: s.Driver,
    constructors: s.Constructors || [],
  }));

  const lastJson = await getJson(fetchFn, `${season}/last/results.json`);
  const lastRace = lastJson?.MRData?.RaceTable?.Races?.[0] || null;
  const lastResults = (lastRace?.Results || []).map((r) => ({
    driver: r.Driver,
    constructor: r.Constructor,
  }));

  const hash = hashValue({
    schedule: schedule.map((r) => [
      r.officialRound,
      r.apiName,
      r.raceUTC?.getTime() ?? null,
      r.qualiUTC?.getTime() ?? null,
      r.sprintUTC?.getTime() ?? null,
      r.qualiSprintUTC?.getTime() ?? null,
    ]),
    standings: standings
      .map((s) => [s.driver?.driverId, s.constructors.map((c) => c.constructorId)])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    last: [
      lastRace?.round ?? null,
      lastResults
        .map((r) => [r.driver?.driverId, r.constructor?.constructorId])
        .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    ],
  });

  return {
    season,
    schedule,
    standings,
    lastRound: lastRace ? parseInt(lastRace.round, 10) : null,
    lastResults,
    hash,
  };
}
