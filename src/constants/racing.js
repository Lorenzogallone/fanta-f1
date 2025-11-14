/**
 * @file racing.js
 * @description Centralized constants for drivers, teams, and scoring
 * Avoids duplication across multiple components
 */

/* ==================== DRIVERS ==================== */
export const DRIVERS = [
  "Lando Norris",
  "Oscar Piastri",
  "Max Verstappen",
  "Charles Leclerc",
  "Lewis Hamilton",
  "George Russell",
  "Andrea Kimi Antonelli",
  "Yuki Tsunoda",
  "Fernando Alonso",
  "Lance Stroll",
  "Pierre Gasly",
  "Franco Colapinto",
  "Oliver Bearman",
  "Esteban Ocon",
  "Nico Hülkenberg",
  "Gabriel Bortoleto",
  "Liam Lawson",
  "Isack Hadjar",
  "Alexander Albon",
  "Carlos Sainz Jr.",
];

/* ==================== CONSTRUCTORS ==================== */
export const CONSTRUCTORS = [
  "Red Bull",
  "Ferrari",
  "Mercedes",
  "McLaren",
  "Aston Martin",
  "Alpine",
  "Haas",
  "Sauber",
  "Vcarb",
  "Williams",
];

/* ==================== DRIVER → TEAM MAPPING ==================== */
export const DRIVER_TEAM = {
  "Max Verstappen": "Red Bull",
  "Yuki Tsunoda": "Red Bull",
  "Charles Leclerc": "Ferrari",
  "Lewis Hamilton": "Ferrari",
  "George Russell": "Mercedes",
  "Andrea Kimi Antonelli": "Mercedes",
  "Lando Norris": "McLaren",
  "Oscar Piastri": "McLaren",
  "Fernando Alonso": "Aston Martin",
  "Lance Stroll": "Aston Martin",
  "Pierre Gasly": "Alpine",
  "Franco Colapinto": "Alpine",
  "Oliver Bearman": "Haas",
  "Esteban Ocon": "Haas",
  "Nico Hülkenberg": "Sauber",
  "Gabriel Bortoleto": "Sauber",
  "Liam Lawson": "Vcarb",
  "Isack Hadjar": "Vcarb",
  "Alexander Albon": "Williams",
  "Carlos Sainz Jr.": "Williams",
};

/* ==================== TEAM LOGOS (paths in /public) ==================== */
export const TEAM_LOGOS = {
  Ferrari: "/ferrari.png",
  Mercedes: "/mercedes.png",
  "Red Bull": "/redbull.png",
  McLaren: "/mclaren.png",
  "Aston Martin": "/aston.png",
  Alpine: "/alpine.png",
  Haas: "/haas.png",
  Williams: "/williams.png",
  Sauber: "/sauber.png",
  Vcarb: "/vcarb.png",
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
