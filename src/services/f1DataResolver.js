/**
 * @file f1DataResolver.js
 * @description In-memory store of drivers and teams, used to map API names to
 * the names stored in the app (e.g. API "Carlos Sainz" → "Carlos Sainz Jr.").
 *
 * Data comes from the Firestore `drivers` and `teams` collections (loaded by
 * F1DataContext, which calls setData). Until then, or if Firestore is not
 * available, src/data/f1-data.json is used as fallback.
 */

import f1DataManual from '../data/f1-data.json';
import { seedDrivers, seedTeams } from '../data/f1Seed.js';
import { findDriver, findTeam } from '../../functions/shared/driverSync.mjs';
import { warn } from '../utils/logger';

class F1DataResolver {
  constructor() {
    this.drivers = seedDrivers(f1DataManual);
    this.teams = seedTeams(f1DataManual);
    this.source = 'seed';
    this.unknownDrivers = new Map();
    this.unknownTeams = new Map();
  }

  /**
   * Replaces the current data (called with the Firestore collections)
   * @param {Array<Object>} drivers - Drivers ({ id, name, teamId, apiAliases, ... })
   * @param {Array<Object>} teams - Teams ({ id, name, logo, apiAliases, ... })
   * @param {string} [source] - Data source label
   */
  setData(drivers, teams, source = 'firestore') {
    this.drivers = drivers;
    this.teams = teams;
    this.source = source;
  }

  /**
   * Team object in the legacy shape used by callers ({ id, displayName, logo })
   * @param {Object|null} team - Team from the store
   * @returns {Object|null}
   */
  toTeamResult(team) {
    return team ? { ...team, displayName: team.name, logo: team.logo || null } : null;
  }

  /**
   * Resolves a driver from an API response
   * @param {Object} apiDriver - { givenName, familyName, code?, driverId?, permanentNumber? }
   * @param {Object|string} [apiConstructor] - Constructor object or team name from API
   * @returns {Object|null} Driver with `displayName` (the app name) and `teamData`
   */
  resolveDriver(apiDriver, apiConstructor = null) {
    if (!apiDriver) return null;

    const driver = findDriver(this.drivers, apiDriver);
    if (driver) {
      const team = this.teams.find((t) => t.id === driver.teamId) || null;
      return {
        ...driver,
        displayName: driver.name,
        currentTeam: driver.teamId,
        teamData: this.toTeamResult(team),
        source: this.source,
      };
    }

    const fullName = `${apiDriver.givenName} ${apiDriver.familyName}`;
    const constructorName = typeof apiConstructor === 'string' ? apiConstructor : apiConstructor?.name;
    const team = constructorName ? this.resolveTeam(constructorName) : null;
    warn(`⚠️ Driver "${fullName}" not in the drivers list`);

    const unknown = {
      id: `${apiDriver.givenName}-${apiDriver.familyName}`.toLowerCase().replace(/\s+/g, '-'),
      displayName: fullName,
      name: fullName,
      firstName: apiDriver.givenName,
      lastName: apiDriver.familyName,
      number: apiDriver.permanentNumber || null,
      currentTeam: team?.isUnknown ? null : team?.id || null,
      teamData: team?.isUnknown ? null : team,
      isUnknown: true,
      source: 'fallback',
    };
    this.unknownDrivers.set(fullName, unknown);
    return unknown;
  }

  /**
   * Resolves a team from an API name
   * @param {string} apiTeamName - Team name from API
   * @returns {Object|null} Team with `displayName` and `logo`
   */
  resolveTeam(apiTeamName) {
    if (!apiTeamName) return null;
    const teamName = apiTeamName.trim();

    const team = findTeam(this.teams, teamName);
    if (team) return this.toTeamResult(team);

    warn(`⚠️ [Unknown Team] Team "${teamName}" not in the teams list`);
    const unknown = {
      id: teamName.toLowerCase().replace(/\s+/g, '-'),
      displayName: teamName,
      name: teamName,
      logo: null,
      isUnknown: true,
      source: 'fallback',
    };
    this.unknownTeams.set(teamName, unknown);
    return unknown;
  }

  /**
   * @returns {Array<Object>} All drivers (with `displayName`)
   */
  getAllDrivers() {
    return this.drivers.map((d) => ({ ...d, displayName: d.name }));
  }

  /**
   * @returns {Array<Object>} All teams (with `displayName`)
   */
  getAllTeams() {
    return this.teams.map((t) => this.toTeamResult(t));
  }

  /**
   * Gets the team of a driver by app name (or alias)
   * @param {string} driverName - Driver name
   * @returns {Object|null} Team object or null
   */
  getDriverTeam(driverName) {
    if (!driverName) return null;
    const driver =
      this.drivers.find((d) => d.name === driverName) ||
      this.drivers.find((d) => d.apiAliases?.includes(driverName));
    if (!driver?.teamId) return null;
    return this.toTeamResult(this.teams.find((t) => t.id === driver.teamId) || null);
  }

  /**
   * Gets a team logo path
   * @param {string} teamIdOrName - Team id, name or alias
   * @returns {string|null} Logo path or null
   */
  getTeamLogo(teamIdOrName) {
    if (!teamIdOrName) return null;
    const team =
      this.teams.find((t) => t.id === teamIdOrName || t.name === teamIdOrName) ||
      findTeam(this.teams, teamIdOrName);
    return team?.logo || null;
  }
}

// Singleton instance
const f1DataResolverInstance = new F1DataResolver();

export default f1DataResolverInstance;

export const resolveDriver = (apiDriver, apiConstructor) =>
  f1DataResolverInstance.resolveDriver(apiDriver, apiConstructor);

export const resolveTeam = (apiTeamName) =>
  f1DataResolverInstance.resolveTeam(apiTeamName);

export const getAllDrivers = () =>
  f1DataResolverInstance.getAllDrivers();

export const getAllTeams = () =>
  f1DataResolverInstance.getAllTeams();

export const getDriverTeam = (driverName) =>
  f1DataResolverInstance.getDriverTeam(driverName);

export const getTeamLogo = (teamIdOrName) =>
  f1DataResolverInstance.getTeamLogo(teamIdOrName);
