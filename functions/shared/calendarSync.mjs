/**
 * @file Calendar sync logic (pure, no I/O), shared by the admin page and the
 * scheduled Cloud Function.
 *
 * Rules:
 * - races are matched to official rounds by `officialRound` when stored,
 *   otherwise by race date (±2 days);
 * - fields listed in `race.locked` are reported but never applied automatically;
 * - races with saved official results are never touched;
 * - nothing is ever deleted: future races missing from the official calendar
 *   are only marked as cancelled;
 * - `round` is only the display order, recomputed by race date.
 */

import {
  MATCH_TOLERANCE_MS,
  toDate,
  toSecondsMs,
  makeSlug,
  hasSavedResults,
} from "./syncUtils.mjs";

/** Fields kept in sync with the official calendar (and lockable) */
export const SYNC_FIELDS = ["name", "raceUTC", "qualiUTC", "sprintUTC", "qualiSprintUTC"];
export const DATE_FIELDS = ["raceUTC", "qualiUTC", "sprintUTC", "qualiSprintUTC"];
const REQUIRED_DATE_FIELDS = ["raceUTC", "qualiUTC"];

/**
 * Compares a stored field with the official value
 * @param {string} field - Field name
 * @param {*} a - Stored value
 * @param {*} b - Official value
 * @returns {boolean} True if equal
 */
function sameValue(field, a, b) {
  if (DATE_FIELDS.includes(field)) return toSecondsMs(a) === toSecondsMs(b);
  return (a ?? null) === (b ?? null);
}

/**
 * Matches app races to official races
 * @param {Array<Object>} dbRaces - Races with `id` and document fields
 * @param {Array<Object>} apiRaces - Output of normalizeJolpicaSchedule
 * @returns {Map<string, Object>} race id → official race
 */
export function matchRaces(dbRaces, apiRaces) {
  const byRound = new Map(apiRaces.map((r) => [r.officialRound, r]));
  const matches = new Map();
  const usedRounds = new Set();

  // 1. Stored officialRound wins
  for (const race of dbRaces) {
    const round = Number(race.officialRound);
    if (Number.isInteger(round) && byRound.has(round) && !usedRounds.has(round)) {
      matches.set(race.id, byRound.get(round));
      usedRounds.add(round);
    }
  }

  // 2. Remaining races (not cancelled, no officialRound) by closest date
  const candidates = [];
  for (const race of dbRaces) {
    if (matches.has(race.id) || race.officialRound != null || race.cancelledMain) continue;
    const date = toDate(race.raceUTC);
    if (!date) continue;
    for (const api of apiRaces) {
      if (usedRounds.has(api.officialRound)) continue;
      const diff = Math.abs(api.raceUTC - date);
      if (diff <= MATCH_TOLERANCE_MS) candidates.push({ race, api, diff });
    }
  }
  candidates.sort((a, b) => a.diff - b.diff);
  for (const { race, api } of candidates) {
    if (matches.has(race.id) || usedRounds.has(api.officialRound)) continue;
    matches.set(race.id, api);
    usedRounds.add(api.officialRound);
  }

  return matches;
}

/**
 * Computes the differences between the app calendar and the official one
 * @param {Array<Object>} dbRaces - Races with `id` and document fields
 * @param {Array<Object>} apiRaces - Output of normalizeJolpicaSchedule
 * @param {Date} [now] - Current time (future/past split)
 * @returns {Object} { updates, creates, cancels, skipped, unmatchedPast, matches }
 */
export function computeCalendarDiff(dbRaces, apiRaces, now = new Date()) {
  const matches = matchRaces(dbRaces, apiRaces);
  const updates = [];
  const cancels = [];
  const skipped = [];

  for (const race of dbRaces) {
    const api = matches.get(race.id);
    const locked = Array.isArray(race.locked) ? race.locked : [];

    if (hasSavedResults(race)) {
      if (api) skipped.push({ id: race.id, name: race.name, reason: "results" });
      continue;
    }

    if (!api) {
      const date = toDate(race.raceUTC);
      if (!race.cancelledMain && date && date > now) {
        cancels.push({
          id: race.id,
          name: race.name,
          raceUTC: date,
          hasSprint: Boolean(race.qualiSprintUTC || race.sprintUTC),
        });
      }
      continue;
    }

    if (Number(race.officialRound) !== api.officialRound) {
      updates.push({
        id: race.id,
        raceName: race.name,
        field: "officialRound",
        from: race.officialRound ?? null,
        to: api.officialRound,
        locked: false,
      });
    }

    // A race cancelled by a previous sync that is back in the calendar
    if (race.cancelledMain && race.cancelledBySync) {
      updates.push({
        id: race.id,
        raceName: race.name,
        field: "cancelledMain",
        from: true,
        to: false,
        locked: false,
      });
    }

    for (const field of SYNC_FIELDS) {
      const from = race[field] ?? null;
      const to = api[field] ?? null;
      if (sameValue(field, from, to)) continue;
      // Race and qualifying dates always exist: a missing value in the API is
      // incomplete data, never a reason to wipe the stored date (the lineup
      // deadline depends on it). Sprint dates may legitimately disappear.
      if (to == null && REQUIRED_DATE_FIELDS.includes(field)) continue;
      updates.push({
        id: race.id,
        raceName: race.name,
        field,
        from: DATE_FIELDS.includes(field) ? toDate(from) : from,
        to,
        locked: locked.includes(field),
      });
    }
  }

  const matchedRounds = new Set([...matches.values()].map((r) => r.officialRound));
  const unmatched = apiRaces.filter((r) => !matchedRounds.has(r.officialRound));
  const creates = unmatched.filter((r) => r.raceUTC > now);
  const unmatchedPast = unmatched.filter((r) => r.raceUTC <= now);

  return { updates, creates, cancels, skipped, unmatchedPast, matches };
}

/**
 * Display order: all races (cancelled included) sorted by race date
 * @param {Array<Object>} races - Races with `id` and `raceUTC`
 * @returns {Object} { [id]: round }
 */
export function computeRoundOrder(races) {
  const sorted = [...races].sort((a, b) => {
    const da = toDate(a.raceUTC)?.getTime() ?? Infinity;
    const db = toDate(b.raceUTC)?.getTime() ?? Infinity;
    return da - db || String(a.id).localeCompare(String(b.id));
  });
  const order = {};
  sorted.forEach((r, i) => {
    order[r.id] = i + 1;
  });
  return order;
}

/**
 * Id for a race created by the sync (same format as "Aggiungi gara")
 * @param {number} round - Display round
 * @param {string} name - Race name
 * @param {Set<string>} existingIds - Ids already used
 * @returns {string}
 */
function newRaceId(round, name, existingIds) {
  const base = `r${String(round).padStart(2, "0")}-${makeSlug(name)}`;
  let id = base;
  let n = 2;
  while (existingIds.has(id)) id = `${base}-${n++}`;
  return id;
}

/**
 * Turns a diff into Firestore writes ({ id, data } merged into races/{id})
 * @param {Array<Object>} dbRaces - Races with `id` and document fields
 * @param {Object} diff - Output of computeCalendarDiff
 * @param {Object} [options]
 * @param {boolean} [options.applyLocked=false] - Also apply locked fields
 * @returns {Object} { writes: [{ id, data, kind }], roundChanges: [{ id, name, from, to }] }
 */
export function buildCalendarWritePlan(dbRaces, diff, { applyLocked = false } = {}) {
  const writes = new Map();
  const projected = new Map(dbRaces.map((r) => [r.id, { ...r }]));
  const add = (id, data, kind) => {
    const w = writes.get(id) || { id, data: {}, kind };
    Object.assign(w.data, data);
    writes.set(id, w);
    Object.assign(projected.get(id) || {}, data);
  };

  for (const u of diff.updates) {
    if (u.locked && !applyLocked) continue;
    add(u.id, { [u.field]: u.to }, "update");
  }

  for (const c of diff.cancels) {
    add(
      c.id,
      {
        cancelledMain: true,
        ...(c.hasSprint ? { cancelledSprint: true } : {}),
        cancelledBySync: true,
      },
      "cancel"
    );
  }

  // Provisional rounds for new races, refined by the global reorder below
  const existingIds = new Set(dbRaces.map((r) => r.id));
  for (const api of diff.creates) {
    const provisional = computeRoundOrder([
      ...projected.values(),
      { id: "~new", raceUTC: api.raceUTC },
    ])["~new"];
    const id = newRaceId(provisional, api.name, existingIds);
    existingIds.add(id);
    const data = {
      id,
      name: api.name,
      officialRound: api.officialRound,
      raceUTC: api.raceUTC,
      qualiUTC: api.qualiUTC,
      sprintUTC: api.sprintUTC,
      qualiSprintUTC: api.qualiSprintUTC,
      cancelledMain: false,
      locked: [],
      createdBySync: true,
    };
    projected.set(id, { ...data });
    writes.set(id, { id, data: { ...data }, kind: "create" });
  }

  const order = computeRoundOrder([...projected.values()]);
  const roundChanges = [];
  for (const [id, round] of Object.entries(order)) {
    const before = projected.get(id);
    const original = dbRaces.find((r) => r.id === id);
    if (!original || original.round !== round) {
      if (original) roundChanges.push({ id, name: before.name, from: original.round, to: round });
      const w = writes.get(id) || { id, data: {}, kind: "round" };
      w.data.round = round;
      writes.set(id, w);
    }
  }

  return { writes: [...writes.values()], roundChanges };
}
