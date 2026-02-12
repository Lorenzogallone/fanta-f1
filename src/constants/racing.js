/**
 * @file racing.js
 * @description Centralized constants for drivers, teams, and scoring
 * Avoids duplication across multiple components
 *
 * NOTE: This file now uses f1DataResolver for dynamic driver/team resolution
 * Static constants are kept for backward compatibility
 */

import f1DataResolver from '../services/f1DataResolver.js';

/* ==================== DRIVERS ==================== */
export const DRIVERS = [
  "Lando Norris",
  "Oscar Piastri",
  "Max Verstappen",
  "Isack Hadjar",
  "Charles Leclerc",
  "Lewis Hamilton",
  "George Russell",
  "Andrea Kimi Antonelli",
  "Fernando Alonso",
  "Lance Stroll",
  "Alexander Albon",
  "Carlos Sainz Jr.",
  "Liam Lawson",
  "Arvid Lindblad",
  "Pierre Gasly",
  "Franco Colapinto",
  "Esteban Ocon",
  "Oliver Bearman",
  "Nico Hülkenberg",
  "Gabriel Bortoleto",
  "Sergio Pérez",
  "Valtteri Bottas",
];

/* ==================== CONSTRUCTORS ==================== */
export const CONSTRUCTORS = [
  "McLaren",
  "Ferrari",
  "Red Bull",
  "Mercedes",
  "Aston Martin",
  "Williams",
  "Racing Bulls",
  "Alpine",
  "Haas",
  "Audi",
  "Cadillac",
];

/* ==================== DRIVER → TEAM MAPPING ==================== */
export const DRIVER_TEAM = {
  "Lando Norris": "McLaren",
  "Oscar Piastri": "McLaren",
  "Max Verstappen": "Red Bull",
  "Isack Hadjar": "Red Bull",
  "Charles Leclerc": "Ferrari",
  "Lewis Hamilton": "Ferrari",
  "George Russell": "Mercedes",
  "Andrea Kimi Antonelli": "Mercedes",
  "Fernando Alonso": "Aston Martin",
  "Lance Stroll": "Aston Martin",
  "Alexander Albon": "Williams",
  "Carlos Sainz Jr.": "Williams",
  "Carlos Sainz": "Williams", // Alias without Jr for API compatibility
  "Liam Lawson": "Racing Bulls",
  "Arvid Lindblad": "Racing Bulls",
  "Pierre Gasly": "Alpine",
  "Franco Colapinto": "Alpine",
  "Esteban Ocon": "Haas",
  "Oliver Bearman": "Haas",
  "Nico Hülkenberg": "Audi",
  "Gabriel Bortoleto": "Audi",
  "Sergio Pérez": "Cadillac",
  "Sergio Perez": "Cadillac", // Alias without accent for API compatibility
  "Valtteri Bottas": "Cadillac",
};

/* ==================== TEAM LOGOS (paths in /public) ==================== */
export const TEAM_LOGOS = {
  McLaren: "/mclaren.png",
  Ferrari: "/ferrari.png",
  "Red Bull": "/redbull.png",
  Mercedes: "/mercedes.png",
  "Aston Martin": "/aston.png",
  Williams: "/williams.png",
  "Racing Bulls": "/vcarb.png",
  Alpine: "/alpine.png",
  Haas: "/haas.png",
  Audi: "/sauber.png",
  Cadillac: "/cadillac.png",
};

/* ==================== SCORING SYSTEM ==================== */
export const POINTS = {
  // Points per position in main race
  MAIN: {
    1: 12,
    2: 10,
    3: 8,
  },

  // Points per position in sprint
  SPRINT: {
    1: 8,
    2: 6,
    3: 4,
  },

  // Joker bonus (independent of position, if finishes on podium)
  BONUS_JOLLY_MAIN: 5,
  BONUS_JOLLY_SPRINT: 2,

  // Empty lineup penalty
  PENALTY_EMPTY_LIST: -3,
};

/* ==================== DRIVER SELECT OPTIONS ==================== */
// Pre-computed to avoid duplication in AdminPanel and FormationApp
export const DRIVER_OPTIONS = DRIVERS.map((d) => ({ value: d, label: d }));

/* ==================== TIME CONSTANTS ==================== */
export const TIME_CONSTANTS = {
  // Minutes of grace period after race to submit results
  GRACE_PERIOD_MINUTES: 90,

  // Late submission window (in minutes after deadline)
  LATE_SUBMISSION_WINDOW_MINUTES: 10,

  // Late submission penalty
  LATE_SUBMISSION_PENALTY: -3,
};

/* ==================== DYNAMIC HELPER FUNCTIONS ==================== */
/**
 * Gets a driver's team (with dynamic fallback from API)
 * @param {string} driverName - Driver name
 * @returns {string|null} Team name or null
 */
export function getDriverTeamDynamic(driverName) {
  // First try with static mapping (faster)
  if (DRIVER_TEAM[driverName]) {
    return DRIVER_TEAM[driverName];
  }

  // Fallback: use resolver (includes API cache and unknowns)
  const team = f1DataResolver.getDriverTeam(driverName);
  return team?.displayName || null;
}

/**
 * Gets a team's logo (with dynamic fallback)
 * @param {string} teamName - Team name
 * @returns {string|null} Logo path or null
 */
export function getTeamLogoDynamic(teamName) {
  // First try with static mapping
  if (TEAM_LOGOS[teamName]) {
    return TEAM_LOGOS[teamName];
  }

  // Fallback: use resolver
  return f1DataResolver.getTeamLogo(teamName);
}

/**
 * Gets all drivers (static + from API cache)
 * @returns {Array<string>} List of driver names
 */
export function getAllDriversDynamic() {
  const allDrivers = f1DataResolver.getAllDrivers();
  return allDrivers.map(d => d.displayName);
}

/**
 * Gets all teams (static + from API cache)
 * @returns {Array<string>} List of team names
 */
export function getAllTeamsDynamic() {
  const allTeams = f1DataResolver.getAllTeams();
  return allTeams.map(t => t.displayName);
}

/**
 * Checks if a driver exists (static or dynamic)
 * @param {string} driverName - Driver name
 * @returns {boolean}
 */
export function isDriverValid(driverName) {
  if (DRIVERS.includes(driverName)) return true;

  const allDrivers = getAllDriversDynamic();
  return allDrivers.includes(driverName);
}

/**
 * Checks if a team exists (static or dynamic)
 * @param {string} teamName - Team name
 * @returns {boolean}
 */
export function isTeamValid(teamName) {
  if (CONSTRUCTORS.includes(teamName)) return true;

  const allTeams = getAllTeamsDynamic();
  return allTeams.includes(teamName);
}
