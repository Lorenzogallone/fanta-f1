/**
 * @file racing.js
 * @description Scoring and timing constants.
 *
 * Drivers and teams are no longer hard-coded here: they live in the Firestore
 * `drivers` / `teams` collections (see contexts/F1DataContext.jsx), with
 * src/data/f1-data.json as initial data and fallback.
 */

/* ==================== SCORING SYSTEM ==================== */
export const POINTS = {
  // Points per position in main race
  MAIN: {
    1: 12,
    2: 10,
    3: 7,
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

/* ==================== TIME CONSTANTS ==================== */
export const TIME_CONSTANTS = {
  // Minutes of grace period after race to submit results
  GRACE_PERIOD_MINUTES: 90,

  // Late submission window (in minutes after deadline)
  LATE_SUBMISSION_WINDOW_MINUTES: 10,

  // Late submission penalty
  LATE_SUBMISSION_PENALTY: -3,
};
