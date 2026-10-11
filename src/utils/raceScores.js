/**
 * @file raceScores.js
 * @description Per-pick and per-session scores of a race lineup, for display.
 * Stored points win; otherwise the pointsCalculator rules are applied.
 */
import { POINTS } from "../constants/racing";

/**
 * Bootstrap tone for a points value: green if positive, red if negative, grey otherwise.
 * @param {number|null} value - Points value
 * @returns {string} Bootstrap variant
 */
export function scoreTone(value) {
  if (value > 0) return "success";
  if (value < 0) return "danger";
  return "secondary";
}

/**
 * Computes the per-pick points and the main / sprint / total scores of a lineup.
 * Stored points (pointsEarned / pointsEarnedSprint) win; otherwise the same rules
 * as pointsCalculator are applied, so not-yet-saved lineups show a coherent total.
 * @param {Object} s - Submission
 * @param {Object} official - Official results
 * @param {number} multiplier - 2 for the double points race, 1 otherwise
 * @param {boolean} sprintScored - Whether the sprint counts for this race
 * @returns {Object} { main, sprint, mainTotal, sprintTotal, total }
 */
export function computeScores(s, official, multiplier, sprintScored) {
  const hit = (ok, pts) => (ok ? pts * multiplier : 0);
  const podium = [official.P1, official.P2, official.P3];
  const main = {
    P1: hit(s.mainP1 && s.mainP1 === official.P1, POINTS.MAIN[1]),
    P2: hit(s.mainP2 && s.mainP2 === official.P2, POINTS.MAIN[2]),
    P3: hit(s.mainP3 && s.mainP3 === official.P3, POINTS.MAIN[3]),
    J1: hit(s.mainJolly && podium.includes(s.mainJolly), POINTS.BONUS_JOLLY_MAIN),
    J2: hit(s.mainJolly2 && podium.includes(s.mainJolly2), POINTS.BONUS_JOLLY_MAIN),
  };

  let mainTotal = s.pointsEarned;
  if (mainTotal === undefined) {
    const perfectPodium = main.P1 && main.P2 && main.P3; // 29 → 30
    mainTotal = s.mainP1
      ? main.P1 + main.P2 + main.P3 + (perfectPodium ? multiplier : 0) + main.J1 + main.J2
      : POINTS.PENALTY_EMPTY_LIST * multiplier;
    if (s.isLate && s.latePenalty) mainTotal += s.latePenalty * multiplier;
  }

  const sprintPodium = [official.SP1, official.SP2, official.SP3];
  const sprint = {
    SP1: hit(sprintScored && s.sprintP1 && s.sprintP1 === official.SP1, POINTS.SPRINT[1]),
    SP2: hit(sprintScored && s.sprintP2 && s.sprintP2 === official.SP2, POINTS.SPRINT[2]),
    SP3: hit(sprintScored && s.sprintP3 && s.sprintP3 === official.SP3, POINTS.SPRINT[3]),
    J: hit(sprintScored && s.sprintJolly && sprintPodium.includes(s.sprintJolly), POINTS.BONUS_JOLLY_SPRINT),
  };

  let sprintTotal = null;
  if (sprintScored) {
    sprintTotal = s.pointsEarnedSprint;
    if (sprintTotal === undefined) {
      sprintTotal = s.sprintP1
        ? sprint.SP1 + sprint.SP2 + sprint.SP3 + sprint.J
        : POINTS.PENALTY_EMPTY_LIST * multiplier;
      if (s.isLateSprint && s.latePenaltySprint) sprintTotal += s.latePenaltySprint * multiplier;
    }
  }

  // Without a sprint the total equals the main race score
  return { main, sprint, mainTotal, sprintTotal, total: mainTotal + (sprintTotal ?? 0) };
}
