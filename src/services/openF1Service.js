/**
 * @file openF1Service.js
 * @description Service for interacting with OpenF1 API
 * API Documentation: https://openf1.org/
 */

const OPENF1_BASE_URL = "https://api.openf1.org/v1";

/**
 * Fetch current year meetings
 * @param {number} year - Year to fetch meetings for
 * @returns {Promise<Array>} Array of meetings
 */
export async function getMeetings(year = new Date().getFullYear()) {
  try {
    const response = await fetch(`${OPENF1_BASE_URL}/meetings?year=${year}`);
    if (!response.ok) throw new Error("Failed to fetch meetings");
    return await response.json();
  } catch (error) {
    console.error("Error fetching meetings:", error);
    return [];
  }
}

/**
 * Fetch sessions for a specific meeting
 * @param {string} meetingKey - Meeting key from OpenF1
 * @returns {Promise<Array>} Array of sessions
 */
export async function getSessions(meetingKey) {
  try {
    const response = await fetch(`${OPENF1_BASE_URL}/sessions?meeting_key=${meetingKey}`);
    if (!response.ok) throw new Error("Failed to fetch sessions");
    return await response.json();
  } catch (error) {
    console.error("Error fetching sessions:", error);
    return [];
  }
}

/**
 * Check if there's a live session currently happening
 * @returns {Promise<Object|null>} Live session object or null
 */
export async function getCurrentLiveSession() {
  try {
    const now = new Date();
    const year = now.getFullYear();

    // Get all sessions for current year
    const response = await fetch(
      `${OPENF1_BASE_URL}/sessions?year=${year}&session_type>=Practice 1`
    );
    if (!response.ok) return null;

    const sessions = await response.json();

    // Find session happening now
    const liveSession = sessions.find(session => {
      const start = new Date(session.date_start);
      const end = new Date(session.date_end);
      return now >= start && now <= end;
    });

    return liveSession || null;
  } catch (error) {
    console.error("Error checking live session:", error);
    return null;
  }
}

/**
 * Get next upcoming session
 * @returns {Promise<Object|null>} Next session object or null
 */
export async function getNextSession() {
  try {
    const now = new Date();
    const year = now.getFullYear();

    const response = await fetch(
      `${OPENF1_BASE_URL}/sessions?year=${year}&date_start>=${now.toISOString()}`
    );
    if (!response.ok) return null;

    const sessions = await response.json();

    // Sort by date and return the closest one
    return sessions.sort((a, b) =>
      new Date(a.date_start) - new Date(b.date_start)
    )[0] || null;
  } catch (error) {
    console.error("Error fetching next session:", error);
    return null;
  }
}

/**
 * Fetch position data for a session
 * @param {string} sessionKey - Session key
 * @returns {Promise<Array>} Position data
 */
export async function getSessionPositions(sessionKey) {
  try {
    const response = await fetch(`${OPENF1_BASE_URL}/position?session_key=${sessionKey}`);
    if (!response.ok) throw new Error("Failed to fetch positions");
    return await response.json();
  } catch (error) {
    console.error("Error fetching positions:", error);
    return [];
  }
}

/**
 * Fetch laps data for a session
 * @param {string} sessionKey - Session key
 * @param {number} driverNumber - Optional driver number filter
 * @returns {Promise<Array>} Laps data
 */
export async function getSessionLaps(sessionKey, driverNumber = null) {
  try {
    let url = `${OPENF1_BASE_URL}/laps?session_key=${sessionKey}`;
    if (driverNumber) url += `&driver_number=${driverNumber}`;

    const response = await fetch(url);
    if (!response.ok) throw new Error("Failed to fetch laps");
    return await response.json();
  } catch (error) {
    console.error("Error fetching laps:", error);
    return [];
  }
}

/**
 * Fetch stints (tire compound info) for a session
 * @param {string} sessionKey - Session key
 * @returns {Promise<Array>} Stints data
 */
export async function getSessionStints(sessionKey) {
  try {
    const response = await fetch(`${OPENF1_BASE_URL}/stints?session_key=${sessionKey}`);
    if (!response.ok) throw new Error("Failed to fetch stints");
    return await response.json();
  } catch (error) {
    console.error("Error fetching stints:", error);
    return [];
  }
}

/**
 * Fetch pit stops for a session
 * @param {string} sessionKey - Session key
 * @returns {Promise<Array>} Pit stops data
 */
export async function getSessionPitStops(sessionKey) {
  try {
    const response = await fetch(`${OPENF1_BASE_URL}/pit?session_key=${sessionKey}`);
    if (!response.ok) throw new Error("Failed to fetch pit stops");
    return await response.json();
  } catch (error) {
    console.error("Error fetching pit stops:", error);
    return [];
  }
}

/**
 * Fetch drivers for a session
 * @param {string} sessionKey - Session key
 * @returns {Promise<Array>} Drivers data
 */
export async function getSessionDrivers(sessionKey) {
  try {
    const response = await fetch(`${OPENF1_BASE_URL}/drivers?session_key=${sessionKey}`);
    if (!response.ok) throw new Error("Failed to fetch drivers");
    return await response.json();
  } catch (error) {
    console.error("Error fetching drivers:", error);
    return [];
  }
}

/**
 * Get tire compound color for display
 * @param {string} compound - Tire compound (SOFT, MEDIUM, HARD, INTERMEDIATE, WET)
 * @returns {Object} Color info { letter, color, background }
 */
export function getTireCompoundDisplay(compound) {
  const compounds = {
    SOFT: { letter: "S", color: "#ffffff", background: "#dc3545" }, // Red
    MEDIUM: { letter: "M", color: "#000000", background: "#ffc107" }, // Yellow
    HARD: { letter: "H", color: "#000000", background: "#f8f9fa" }, // White
    INTERMEDIATE: { letter: "I", color: "#ffffff", background: "#28a745" }, // Green
    WET: { letter: "W", color: "#ffffff", background: "#007bff" }, // Blue
  };

  return compounds[compound?.toUpperCase()] || {
    letter: "?",
    color: "#000",
    background: "#6c757d"
  };
}
