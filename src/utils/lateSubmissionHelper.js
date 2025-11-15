/**
 * Late Submission Helper
 * Calculates late submission window status for races to prevent race conditions
 */

import { TIME_CONSTANTS } from "../constants/racing";

/**
 * Calculates late submission window status for a race using a single timestamp
 * @param {string} mode - Submission mode: "main" or "sprint"
 * @param {Object} race - Race object with qualiUTC and qualiSprintUTC
 * @param {number} [currentTime] - Current timestamp (default: Date.now())
 * @returns {Object} Late window information with deadline, isOpen, isInLateWindow, lateWindowEnd
 */
export const getLateWindowInfo = (mode, race, currentTime = Date.now()) => {
  if (!race) {
    return {
      deadline: null,
      isOpen: false,
      isInLateWindow: false,
      lateWindowEnd: null,
    };
  }

  const deadlineTimestamp =
    mode === "main"
      ? race.qualiUTC?.seconds * 1000
      : race.qualiSprintUTC?.seconds * 1000;

  if (!deadlineTimestamp) {
    return {
      deadline: null,
      isOpen: false,
      isInLateWindow: false,
      lateWindowEnd: null,
    };
  }

  const lateWindowMs = TIME_CONSTANTS.LATE_SUBMISSION_WINDOW_MINUTES * 60 * 1000;
  const lateWindowEnd = deadlineTimestamp + lateWindowMs;

  return {
    deadline: deadlineTimestamp,
    isOpen: currentTime < deadlineTimestamp,
    isInLateWindow: currentTime > deadlineTimestamp && currentTime <= lateWindowEnd,
    lateWindowEnd,
  };
};
