/**
 * @file Centralized points calculation utilities
 * Used in CalculatePoints.jsx, History.jsx and other components
 */

import { POINTS } from "../constants/racing";

/**
 * Calculates main race points for a submission
 * @param {Object} submission - User lineup with mainP1, mainP2, mainP3, mainJolly, mainJolly2
 * @param {Object} official - Official results with P1, P2, P3
 * @returns {number|null} Points earned or null if official results missing
 */
export function calculateMainPoints(submission, official) {
  if (!official) return null;

  const { mainP1, mainP2, mainP3, mainJolly, mainJolly2 } = submission;
  const { P1, P2, P3 } = official;

  // Penalty for empty lineup
  if (!mainP1 && !mainP2 && !mainP3) {
    return POINTS.PENALTY_EMPTY_LIST;
  }

  let points = 0;

  // Points for podium positions
  if (mainP1 === P1) points += POINTS.MAIN[1];
  if (mainP2 === P2) points += POINTS.MAIN[2];
  if (mainP3 === P3) points += POINTS.MAIN[3];

  // Jolly bonus points
  const podio = [P1, P2, P3];
  if (mainJolly && podio.includes(mainJolly)) {
    points += POINTS.BONUS_JOLLY_MAIN;
  }
  if (mainJolly2 && podio.includes(mainJolly2)) {
    points += POINTS.BONUS_JOLLY_MAIN;
  }

  return points;
}

/**
 * Calculates sprint race points for a submission
 * @param {Object} submission - Sprint lineup with sprintP1, sprintP2, sprintP3, sprintJolly
 * @param {Object} official - Official results with SP1, SP2, SP3
 * @returns {number|null} Points earned or null if no sprint
 */
export function calculateSprintPoints(submission, official) {
  if (!official?.SP1) return null;

  const { sprintP1, sprintP2, sprintP3, sprintJolly } = submission;
  const { SP1, SP2, SP3 } = official;

  // Penalty for empty lineup
  if (!sprintP1 && !sprintP2 && !sprintP3) {
    return POINTS.PENALTY_EMPTY_LIST;
  }

  let points = 0;

  // Points for sprint podium positions
  if (sprintP1 === SP1) points += POINTS.SPRINT[1];
  if (sprintP2 === SP2) points += POINTS.SPRINT[2];
  if (sprintP3 === SP3) points += POINTS.SPRINT[3];

  // Sprint jolly bonus points
  const sprintPodio = [SP1, SP2, SP3];
  if (sprintJolly && sprintPodio.includes(sprintJolly)) {
    points += POINTS.BONUS_JOLLY_SPRINT;
  }

  return points;
}

/**
 * Calculates individual points for each position (for detailed tables)
 * @param {Object} submission - User lineup
 * @param {Object} official - Official results
 * @returns {Object} Object with detailed points for each position
 */
export function calculateDetailedMainPoints(submission, official) {
  if (!official) {
    return {
      p1Pts: 0,
      p2Pts: 0,
      p3Pts: 0,
      j1Pts: 0,
      j2Pts: 0,
      total: null,
    };
  }

  const p1Pts = submission.mainP1 === official.P1 ? POINTS.MAIN[1] : 0;
  const p2Pts = submission.mainP2 === official.P2 ? POINTS.MAIN[2] : 0;
  const p3Pts = submission.mainP3 === official.P3 ? POINTS.MAIN[3] : 0;

  const podio = [official.P1, official.P2, official.P3];
  const j1Pts =
    submission.mainJolly && podio.includes(submission.mainJolly)
      ? POINTS.BONUS_JOLLY_MAIN
      : 0;
  const j2Pts =
    submission.mainJolly2 && podio.includes(submission.mainJolly2)
      ? POINTS.BONUS_JOLLY_MAIN
      : 0;

  return {
    p1Pts,
    p2Pts,
    p3Pts,
    j1Pts,
    j2Pts,
    total: p1Pts + p2Pts + p3Pts + j1Pts + j2Pts,
  };
}

/**
 * Calculates individual sprint points for each position (for detailed tables)
 * @param {Object} submission - Sprint lineup
 * @param {Object} official - Official results
 * @returns {Object} Object with detailed points for each position
 */
export function calculateDetailedSprintPoints(submission, official) {
  if (!official?.SP1) {
    return {
      sp1Pts: 0,
      sp2Pts: 0,
      sp3Pts: 0,
      jspPts: 0,
      total: null,
    };
  }

  const sp1Pts = submission.sprintP1 === official.SP1 ? POINTS.SPRINT[1] : 0;
  const sp2Pts = submission.sprintP2 === official.SP2 ? POINTS.SPRINT[2] : 0;
  const sp3Pts = submission.sprintP3 === official.SP3 ? POINTS.SPRINT[3] : 0;

  const sprintPodio = [official.SP1, official.SP2, official.SP3];
  const jspPts =
    submission.sprintJolly && sprintPodio.includes(submission.sprintJolly)
      ? POINTS.BONUS_JOLLY_SPRINT
      : 0;

  return {
    sp1Pts,
    sp2Pts,
    sp3Pts,
    jspPts,
    total: sp1Pts + sp2Pts + sp3Pts + jspPts,
  };
}

/**
 * Determines if this race has a sprint
 * @param {Object} official - Official results
 * @returns {boolean} True if sprint exists
 */
export function hasSprint(official) {
  return Boolean(official?.SP1);
}
