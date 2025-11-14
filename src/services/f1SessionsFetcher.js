/**
 * @file F1 sessions fetcher service
 * Fetches all session data (FP1, FP2, FP3, Qualifying, Sprint, Race)
 * Uses OpenF1 API for practice sessions and Jolpica/Ergast API for qualifying, sprint, race
 */

const ERGAST_API_BASE_URL = "https://api.jolpi.ca/ergast/f1";
const OPENF1_API_BASE_URL = "https://api.openf1.org/v1";

/**
 * Mapping of driver names from API to app format
 */
const DRIVER_NAME_MAPPING = {
  "Verstappen": "Max Verstappen",
  "Perez": "Sergio Perez",
  "Pérez": "Sergio Perez",
  "Leclerc": "Charles Leclerc",
  "Sainz": "Carlos Sainz",
  "Hamilton": "Lewis Hamilton",
  "Norris": "Lando Norris",
  "Piastri": "Oscar Piastri",
  "Russell": "George Russell",
  "Antonelli": "Andrea Kimi Antonelli",
  "Alonso": "Fernando Alonso",
  "Stroll": "Lance Stroll",
  "Gasly": "Pierre Gasly",
  "Doohan": "Jack Doohan",
  "Albon": "Alexander Albon",
  "Tsunoda": "Yuki Tsunoda",
  "Hadjar": "Isack Hadjar",
  "Hulkenberg": "Nico Hulkenberg",
  "Bortoleto": "Gabriel Bortoleto",
  "Hülkenberg": "Nico Hulkenberg",
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
  if (DRIVER_NAME_MAPPING[familyName]) {
    return DRIVER_NAME_MAPPING[familyName];
  }
  return `${driver.givenName} ${driver.familyName}`;
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
 * Fetches practice session results from OpenF1 API
 * @param {number} season - Season year
 * @param {number} round - Race round number (used to match with Ergast data)
 * @param {string} sessionName - Session name: "Practice 1", "Practice 2", "Practice 3", "Sprint Qualifying", "Sprint Shootout"
 * @returns {Promise<Array|null>} Array of practice results or null
 */
export async function fetchPracticeSession(season, round, sessionName) {
  try {
    // Step 1: Get all sessions for the year
    const sessionsUrl = `${OPENF1_API_BASE_URL}/sessions?year=${season}`;
    const sessionsResponse = await fetch(sessionsUrl);

    if (!sessionsResponse.ok) return null;

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
    if (!targetMeeting) return null;

    // Find the session with the matching name in this meeting
    const targetSession = targetMeeting.sessions.find(
      s => s.session_name === sessionName
    );

    if (!targetSession) return null;

    const sessionKey = targetSession.session_key;

    // Step 2: Fetch all laps for this session
    const lapsUrl = `${OPENF1_API_BASE_URL}/laps?session_key=${sessionKey}`;
    const lapsResponse = await fetch(lapsUrl);

    if (!lapsResponse.ok) return null;

    const laps = await lapsResponse.json();

    if (!laps || laps.length === 0) return null;

    // Step 3: Process laps to find best lap for each driver
    const driverBestLaps = {};

    laps.forEach((lap) => {
      if (!lap.lap_duration || lap.is_pit_out_lap) return; // Skip invalid/pit laps

      const driverNumber = lap.driver_number;
      const lapTime = lap.lap_duration;

      if (!driverBestLaps[driverNumber] || lapTime < driverBestLaps[driverNumber].time) {
        driverBestLaps[driverNumber] = {
          time: lapTime,
          lapNumber: lap.lap_number,
        };
      }
    });

    // Step 4: Get driver info to map numbers to names
    const driversUrl = `${OPENF1_API_BASE_URL}/drivers?session_key=${sessionKey}`;
    const driversResponse = await fetch(driversUrl);

    let driverInfo = {};
    if (driversResponse.ok) {
      const drivers = await driversResponse.json();
      drivers.forEach(d => {
        const fullName = `${d.first_name} ${d.last_name}`;
        driverInfo[d.driver_number] = {
          name: normalizeDriverName({ givenName: d.first_name, familyName: d.last_name }),
          team: d.team_name,
        };
      });
    }

    // Step 5: Create sorted results array
    const results = Object.entries(driverBestLaps)
      .map(([driverNumber, data]) => ({
        driverNumber: parseInt(driverNumber),
        driver: driverInfo[driverNumber]?.name || `Driver #${driverNumber}`,
        constructor: driverInfo[driverNumber]?.team || "—",
        bestTime: data.time,
        bestTimeFormatted: formatLapTime(data.time),
        lapNumber: data.lapNumber,
      }))
      .sort((a, b) => a.bestTime - b.bestTime);

    // Add position and gap
    const leaderTime = results[0]?.bestTime || 0;
    results.forEach((result, idx) => {
      result.position = idx + 1;
      result.gap = idx === 0 ? "—" : `+${(result.bestTime - leaderTime).toFixed(3)}`;
    });

    return results;
  } catch (error) {
    console.error(`Error fetching ${sessionName} for ${season} R${round}:`, error);
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
        driver: normalizeDriverName(result.Driver),
        constructor: result.Constructor?.name,
        q1: result.Q1 || "—",
        q2: result.Q2 || "—",
        q3: result.Q3 || "—",
        bestTime: bestTime || "—",
        gap: calculateGap(leaderTimeMs, bestTimeMs),
      };
    });
  } catch (error) {
    console.error(`Error fetching qualifying for ${season} R${round}:`, error);
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

    // Leader time for gap calculation
    const leaderTime = sprintResults[0].Time?.time;
    const leaderTimeMs = leaderTime ? timeToMs(leaderTime) : 0;

    return sprintResults.map((result) => {
      const driverTime = result.Time?.time;
      const driverTimeMs = driverTime ? timeToMs(driverTime) : 0;

      return {
        position: result.position,
        driver: normalizeDriverName(result.Driver),
        constructor: result.Constructor?.name,
        time: result.Time?.time || "—",
        gap: result.position === "1" ? "—" : calculateGap(leaderTimeMs, driverTimeMs),
        points: result.points || "0",
        status: result.status,
      };
    });
  } catch (error) {
    console.error(`Error fetching sprint for ${season} R${round}:`, error);
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
        driver: normalizeDriverName(result.Driver),
        constructor: result.Constructor?.name,
        time: result.Time?.time || "—",
        gap: result.position === "1" ? "—" : calculateGap(leaderTimeMs, driverTimeMs),
        points: result.points || "0",
        status: result.status,
        fastestLap: result.FastestLap?.rank === "1" ? "⚡" : "",
      };
    });
  } catch (error) {
    console.error(`Error fetching race for ${season} R${round}:`, error);
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
    // Fetch basic sessions first
    const [fp1, fp2, fp3, qualifying, sprint, race] = await Promise.all([
      fetchPracticeSession(season, round, "Practice 1"),
      fetchPracticeSession(season, round, "Practice 2"),
      fetchPracticeSession(season, round, "Practice 3"),
      fetchQualifying(season, round),
      fetchSprint(season, round),
      fetchRace(season, round),
    ]);

    // Try to fetch sprint qualifying with multiple possible names
    let sprintQualifying = null;
    const sprintQualifyingNames = season >= 2024
      ? ["Sprint Qualifying", "Sprint Shootout", "Sprint"]
      : ["Sprint Shootout", "Sprint Qualifying", "Sprint"];

    for (const name of sprintQualifyingNames) {
      sprintQualifying = await fetchPracticeSession(season, round, name);
      if (sprintQualifying !== null) {
        break; // Found it, stop trying other names
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
  } catch (error) {
    console.error(`Error fetching sessions for ${season} R${round}:`, error);
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
  } catch (error) {
    console.error("Error fetching last race sessions:", error);
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
