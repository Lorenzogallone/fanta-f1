/**
 * @file Converts f1-data.json (initial data / offline fallback) to the shape of
 * the Firestore `drivers` and `teams` collections.
 * Takes the JSON as a parameter so it can be used by Vite and by Node scripts.
 */

/**
 * @param {Object} f1Data - Content of src/data/f1-data.json
 * @returns {Array<Object>} Teams: { id, name, logo, apiAliases, active }
 */
export function seedTeams(f1Data) {
  return Object.values(f1Data.teams).map((t) => ({
    id: t.id,
    name: t.displayName,
    logo: t.logo || null,
    apiAliases: t.apiAliases || [],
    active: true,
  }));
}

/**
 * @param {Object} f1Data - Content of src/data/f1-data.json
 * @returns {Array<Object>} Drivers: { id, name, firstName, lastName, number, teamId, apiAliases, selectable, active }
 */
export function seedDrivers(f1Data) {
  return Object.values(f1Data.drivers).map((d) => ({
    id: d.id,
    name: d.displayName,
    firstName: d.firstName,
    lastName: d.lastName,
    number: d.number ?? null,
    teamId: d.currentTeam || null,
    apiAliases: d.apiAliases || [],
    selectable: d.selectable ?? true,
    active: d.active ?? true,
  }));
}
