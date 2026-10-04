/**
 * @file Entry point of the F1 sync (calendar + drivers), shared by the admin
 * page ("Sincronizza ora") and the scheduled Cloud Function.
 * Pure: callers fetch the snapshot and the documents, then apply `writes`
 * with their own Firestore SDK (always merge, never delete).
 */

import { computeCalendarDiff, buildCalendarWritePlan } from "./calendarSync.mjs";
import { computeDriverSync, buildDriverWritePlan } from "./driverSync.mjs";

export { fetchJolpicaSnapshot, translateRaceName, normalizeJolpicaSchedule } from "./jolpica.mjs";
export { computeCalendarDiff, computeRoundOrder, matchRaces, SYNC_FIELDS, DATE_FIELDS } from "./calendarSync.mjs";
export { computeDriverSync, findDriver, findTeam } from "./driverSync.mjs";
export { toDate, makeSlug, hasSavedResults } from "./syncUtils.mjs";

/** Document that stores the outcome of the last sync */
export const SYNC_STATUS_DOC = { collection: "config", id: "f1Sync" };

/**
 * Computes every change the sync would make
 * @param {Object} input
 * @param {Object} input.snapshot - Output of fetchJolpicaSnapshot
 * @param {Array<Object>} input.races - races/{id} documents (with `id`)
 * @param {Array<Object>} input.drivers - drivers/{id} documents (with `id`)
 * @param {Array<Object>} input.teams - teams/{id} documents (with `id`)
 * @param {Date} [input.now] - Current time
 * @returns {Object} { calendar, roundChanges, drivers, writes, summary }
 */
export function computeF1Sync({ snapshot, races, drivers, teams, now = new Date() }) {
  const calendar = computeCalendarDiff(races, snapshot.schedule, now);
  const calendarPlan = buildCalendarWritePlan(races, calendar);
  // Without the drivers collection (not migrated yet) every API driver would
  // look new: skip the driver part instead of adding them all as reserves
  const driverDiff = drivers.length > 0 && teams.length > 0
    ? computeDriverSync(drivers, teams, snapshot)
    : { teamCreates: [], driverCreates: [], driverUpdates: [], skipped: true };
  const driverWrites = buildDriverWritePlan(driverDiff);

  const writes = [
    ...calendarPlan.writes.map((w) => ({ collection: "races", ...w })),
    ...driverWrites,
  ];

  const summary = {
    calendar: {
      updated: calendar.updates.filter((u) => !u.locked).length,
      lockedSkipped: calendar.updates.filter((u) => u.locked).length,
      created: calendar.creates.length,
      cancelled: calendar.cancels.length,
      skippedWithResults: calendar.skipped.length,
      roundChanges: calendarPlan.roundChanges.length,
    },
    drivers: {
      created: driverDiff.driverCreates.length,
      teamChanges: driverDiff.driverUpdates.filter((u) => !u.locked).length,
      lockedSkipped: driverDiff.driverUpdates.filter((u) => u.locked).length,
      teamsCreated: driverDiff.teamCreates.length,
      skipped: Boolean(driverDiff.skipped),
    },
    writes: writes.length,
  };

  return {
    calendar,
    roundChanges: calendarPlan.roundChanges,
    drivers: driverDiff,
    writes,
    summary,
  };
}
