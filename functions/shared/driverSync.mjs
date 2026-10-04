/**
 * @file Driver/team matching and sync logic (pure, no I/O), shared by the web
 * app (results resolver, admin page) and the scheduled Cloud Function.
 *
 * Rules:
 * - a driver's `name` is the value stored in formations and never changes;
 * - drivers already known get their team updated from the last race
 *   (unless `teamId` is in `locked`);
 * - drivers that appear in the season results and are unknown are added as
 *   reserves (`selectable: false`);
 * - nobody is ever deactivated or deleted.
 */

import { makeSlug, normalizeName } from "./syncUtils.mjs";

/**
 * Finds a team by name, alias or API constructor id
 * @param {Array<Object>} teams - Teams with `id`, `name`, `apiAliases`
 * @param {string|Object} apiTeam - Team name or { name, constructorId }
 * @returns {Object|null} Team or null
 */
export function findTeam(teams, apiTeam) {
  if (!apiTeam) return null;
  const keys = (typeof apiTeam === "string"
    ? [apiTeam]
    : [apiTeam.name, apiTeam.constructorId]
  )
    .filter(Boolean)
    .map(normalizeName);
  if (keys.length === 0) return null;

  for (const key of keys) {
    const team = teams.find(
      (t) =>
        normalizeName(t.id) === key ||
        normalizeName(t.name) === key ||
        (t.apiAliases || []).some((a) => normalizeName(a) === key)
    );
    if (team) return team;
  }
  return null;
}

/**
 * Finds a driver from an API driver object, trying the most specific keys
 * first: full name, API driver id, 3-letter code, then family name.
 * @param {Array<Object>} drivers - Drivers with `id`, `name`, `apiAliases`
 * @param {Object} apiDriver - { givenName, familyName, driverId?, code? }
 * @returns {Object|null} Driver or null
 */
export function findDriver(drivers, apiDriver) {
  if (!apiDriver) return null;
  const full = [apiDriver.givenName, apiDriver.familyName].filter(Boolean).join(" ");
  const keys = [full, apiDriver.driverId, apiDriver.code, apiDriver.familyName]
    .filter(Boolean)
    .map(normalizeName);

  for (const key of keys) {
    const driver = drivers.find(
      (d) =>
        normalizeName(d.name) === key ||
        normalizeName(d.id) === key ||
        (d.apiAliases || []).some((a) => normalizeName(a) === key)
    );
    if (driver) return driver;
  }
  return null;
}

/**
 * Builds a new team document for an unknown API constructor
 * @param {Object} constructor - { name, constructorId }
 * @param {Set<string>} usedIds - Ids already taken
 * @returns {Object} Team with `id`
 */
function newTeam(constructor, usedIds) {
  let id = makeSlug(constructor.name || constructor.constructorId);
  while (usedIds.has(id)) id = `${id}-x`;
  usedIds.add(id);
  return {
    id,
    name: constructor.name,
    logo: null,
    apiAliases: [...new Set([constructor.name, constructor.constructorId].filter(Boolean))],
    active: true,
    source: "api",
  };
}

/**
 * Computes driver/team changes from a Jolpica snapshot
 * @param {Array<Object>} drivers - Current drivers (with `id`)
 * @param {Array<Object>} teams - Current teams (with `id`)
 * @param {Object} snapshot - { standings, lastResults } from fetchJolpicaSnapshot
 * @returns {Object} { teamCreates, driverCreates, driverUpdates }
 */
export function computeDriverSync(drivers, teams, snapshot) {
  const allTeams = [...teams];
  const usedTeamIds = new Set(teams.map((t) => t.id));
  const usedDriverIds = new Set(drivers.map((d) => d.id));
  const teamCreates = [];
  const driverCreates = [];
  const driverUpdates = [];

  const teamFor = (constructor) => {
    if (!constructor) return null;
    let team = findTeam(allTeams, constructor);
    if (!team) {
      team = newTeam(constructor, usedTeamIds);
      allTeams.push(team);
      teamCreates.push(team);
    }
    return team;
  };

  // 1. Unknown drivers who started a race this season → reserves
  const knownDrivers = [...drivers];
  for (const s of snapshot.standings || []) {
    const api = s.driver;
    if (!api || findDriver(knownDrivers, api)) continue;
    const team = teamFor(s.constructors?.[s.constructors.length - 1]);
    const name = [api.givenName, api.familyName].filter(Boolean).join(" ");
    let id = makeSlug(name);
    while (usedDriverIds.has(id)) id = `${id}-x`;
    usedDriverIds.add(id);
    const driver = {
      id,
      name,
      firstName: api.givenName || "",
      lastName: api.familyName || "",
      number: api.permanentNumber ? parseInt(api.permanentNumber, 10) : null,
      teamId: team?.id || null,
      apiAliases: [...new Set([name, api.familyName, api.code, api.driverId].filter(Boolean))],
      selectable: false,
      active: true,
      source: "api",
      locked: [],
    };
    knownDrivers.push(driver);
    driverCreates.push(driver);
  }

  // 2. Team changes from the last race classification
  for (const r of snapshot.lastResults || []) {
    const driver = findDriver(drivers, r.driver);
    if (!driver) continue;
    const team = teamFor(r.constructor);
    if (!team || team.id === driver.teamId) continue;
    driverUpdates.push({
      id: driver.id,
      name: driver.name,
      field: "teamId",
      from: driver.teamId || null,
      to: team.id,
      locked: (driver.locked || []).includes("teamId"),
    });
  }

  return { teamCreates, driverCreates, driverUpdates };
}

/**
 * Turns a driver diff into Firestore writes
 * @param {Object} diff - Output of computeDriverSync
 * @param {Object} [options]
 * @param {boolean} [options.applyLocked=false] - Also apply locked fields
 * @returns {Array<Object>} [{ collection, id, data, kind }]
 */
export function buildDriverWritePlan(diff, { applyLocked = false } = {}) {
  const writes = [];
  for (const t of diff.teamCreates) {
    const { id, ...data } = t;
    writes.push({ collection: "teams", id, data, kind: "create" });
  }
  for (const d of diff.driverCreates) {
    const { id, ...data } = d;
    writes.push({ collection: "drivers", id, data, kind: "create" });
  }
  for (const u of diff.driverUpdates) {
    if (u.locked && !applyLocked) continue;
    writes.push({ collection: "drivers", id: u.id, data: { [u.field]: u.to }, kind: "update" });
  }
  return writes;
}
