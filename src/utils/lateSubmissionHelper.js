// src/utils/lateSubmissionHelper.js
import { TIME_CONSTANTS } from "../constants/racing";

/**
 * Calcola lo stato della finestra late submission per una gara.
 * Usa un timestamp unico per evitare race conditions.
 *
 * @param {string} mode - "main" o "sprint"
 * @param {Object} race - Oggetto gara con qualiUTC e qualiSprintUTC
 * @param {number} [currentTime] - Timestamp corrente (default: Date.now())
 * @returns {Object} Informazioni sulla finestra late
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
