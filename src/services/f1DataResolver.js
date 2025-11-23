/**
 * @file f1DataResolver.js
 * @description F1 data resolution system with cascading fallback
 */

import f1DataManual from '../data/f1-data.json';
import { log, error, warn, info } from '../utils/logger';

const ERGAST_API_BASE_URL = "https://api.jolpi.ca/ergast/f1";
const CACHE_KEY_DRIVERS = "fanta-f1-drivers-cache";
const CACHE_KEY_TEAMS = "fanta-f1-teams-cache";

class F1DataResolver {
  constructor() {
    this.manualData = f1DataManual;
    this.apiCache = this.loadCache();
    this.unknownDrivers = new Map();
    this.unknownTeams = new Map();
    this.syncInProgress = false;
  }

  /**
   * Resolves driver from API response with cascading fallback
   * @param {Object} apiDriver - Driver object from API
   * @param {Object|string} [apiConstructor] - Constructor object or team name from API
   * @returns {Object|null} Resolved driver with team and logo
   */
  resolveDriver(apiDriver, apiConstructor = null) {
    if (!apiDriver) return null;

    const fullName = `${apiDriver.givenName} ${apiDriver.familyName}`;
    const familyName = apiDriver.familyName;

    if (this.manualData.config.preferApiData && this.apiCache?.drivers) {
      const fromApi = this.findDriverInApiCache(familyName, fullName);
      if (fromApi) {
        return fromApi;
      }
    }

    const fromManual = this.findDriverInManualData(familyName, fullName);
    if (fromManual) {
      return fromManual;
    }

    if (!this.manualData.config.preferApiData && this.apiCache?.drivers) {
      const fromApi = this.findDriverInApiCache(familyName, fullName);
      if (fromApi) {
        return fromApi;
      }
    }

    if (apiConstructor) {
      const constructorName = typeof apiConstructor === 'string'
        ? apiConstructor
        : apiConstructor.name;

      if (constructorName) {
        const inferredTeam = this.resolveTeam(constructorName);

        if (inferredTeam) {
          warn(`⚠️ [Inferred] Driver "${fullName}" not mapped, but team inferred from API: ${inferredTeam.displayName}`);

          const inferred = {
            id: `${apiDriver.givenName}-${apiDriver.familyName}`.toLowerCase().replace(/\s+/g, '-'),
            displayName: fullName,
            firstName: apiDriver.givenName,
            lastName: apiDriver.familyName,
            number: apiDriver.permanentNumber || null,
            currentTeam: inferredTeam.id,
            teamData: inferredTeam,
            isUnknown: true,
            source: 'inferred'
          };

          this.unknownDrivers.set(fullName, inferred);

          return inferred;
        }
      }
    }

    error(`❌ [Fallback] Driver "${fullName}" completely unknown. Showing name only.`);

    const fallback = {
      id: `${apiDriver.givenName}-${apiDriver.familyName}`.toLowerCase().replace(/\s+/g, '-'),
      displayName: fullName,
      firstName: apiDriver.givenName,
      lastName: apiDriver.familyName,
      number: apiDriver.permanentNumber || null,
      currentTeam: null,
      teamData: null,
      isUnknown: true,
      source: 'fallback'
    };

    this.unknownDrivers.set(fullName, fallback);

    return fallback;
  }

  /**
   * Finds driver in API cache
   * @param {string} familyName - Driver family name
   * @param {string} fullName - Driver full name
   * @returns {Object|null} Driver data or null
   */
  findDriverInApiCache(familyName, fullName) {
    if (!this.apiCache?.drivers) return null;

    for (const driver of Object.values(this.apiCache.drivers)) {
      if (driver.lastName === familyName || driver.displayName === fullName) {
        // Add team data
        const team = this.manualData.teams[driver.currentTeam];
        return {
          ...driver,
          teamData: team || null,
          source: 'api-cache'
        };
      }
    }
    return null;
  }

  /**
   * Finds driver in manual database
   * @param {string} familyName - Driver family name
   * @param {string} fullName - Driver full name
   * @returns {Object|null} Driver data or null
   */
  findDriverInManualData(familyName, fullName) {
    for (const driver of Object.values(this.manualData.drivers)) {
      // Search by alias
      if (driver.apiAliases.includes(familyName) ||
          driver.apiAliases.includes(fullName)) {

        const team = this.manualData.teams[driver.currentTeam];

        return {
          ...driver,
          teamData: team || null,
          source: 'manual'
        };
      }
    }
    return null;
  }

  /**
   * Resolves team from API name with cascading fallback
   * @param {string} apiTeamName - Team name from API
   * @returns {Object|null} Resolved team with logo
   */
  resolveTeam(apiTeamName) {
    if (!apiTeamName) return null;

    const teamName = apiTeamName.trim();

    // 🔍 LEVEL 1: Search in API cache (if preferApiData)
    if (this.manualData.config.preferApiData && this.apiCache?.teams) {
      const fromApi = this.findTeamInApiCache(teamName);
      if (fromApi) {
        return fromApi;
      }
    }

    // 🔍 LEVEL 2: Search in manual database
    const fromManual = this.findTeamInManualData(teamName);
    if (fromManual) {
      return fromManual;
    }

    // 🔍 LEVEL 3: API cache as fallback
    if (!this.manualData.config.preferApiData && this.apiCache?.teams) {
      const fromApi = this.findTeamInApiCache(teamName);
      if (fromApi) {
        return fromApi;
      }
    }

    // 🔍 LEVEL 4: Fallback - unknown team
    warn(`⚠️ [Unknown Team] Team "${teamName}" non mappato in nessuna fonte`);

    const unknownTeam = {
      id: teamName.toLowerCase().replace(/\s+/g, '-'),
      displayName: teamName,
      logo: null,
      isUnknown: true,
      source: 'fallback'
    };

    this.unknownTeams.set(teamName, unknownTeam);

    return unknownTeam;
  }

  /**
   * Finds team in API cache
   * @param {string} teamName - Team name
   * @returns {Object|null} Team data or null
   */
  findTeamInApiCache(teamName) {
    if (!this.apiCache?.teams) return null;

    for (const team of Object.values(this.apiCache.teams)) {
      if (team.displayName === teamName || team.apiAliases?.includes(teamName)) {
        return { ...team, source: 'api-cache' };
      }
    }
    return null;
  }

  /**
   * Finds team in manual database
   * @param {string} teamName - Team name
   * @returns {Object|null} Team data or null
   */
  findTeamInManualData(teamName) {
    for (const team of Object.values(this.manualData.teams)) {
      if (team.apiAliases.includes(teamName)) {
        return { ...team, source: 'manual' };
      }
    }
    return null;
  }

  /**
   * Synchronizes driver and team data from Ergast API
   * @returns {Promise<Object|null>} Updated cache or null on error
   */
  async syncFromAPI() {
    if (!this.manualData.config.enableApiSync) {
      log('⏭️ Sync API disabilitato in config');
      return null;
    }

    if (this.syncInProgress) {
      log('⏳ Sync già in corso, skip...');
      return null;
    }

    try {
      this.syncInProgress = true;
      log('🔄 Sincronizzazione dati da Ergast API...');

      // Fetch driver standings (includes current team)
      const response = await fetch(
        `${ERGAST_API_BASE_URL}/current/driverStandings.json`
      );

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const data = await response.json();

      const standings = data.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings;

      if (!standings || standings.length === 0) {
        warn('⚠️ Nessun dato standings disponibile da API');
        return null;
      }

      const apiDrivers = {};
      const apiTeams = {};

      standings.forEach(standing => {
        const driver = standing.Driver;
        const constructor = standing.Constructors?.[0];

        if (!driver || !constructor) return;

        const driverId = `${driver.givenName}-${driver.familyName}`
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/ü/g, 'u')
          .replace(/ö/g, 'o')
          .replace(/ä/g, 'a');

        // Find corresponding team in our manual database
        let teamId = null;
        const manualTeam = this.findTeamInManualData(constructor.name);
        if (manualTeam) {
          teamId = manualTeam.id;
        } else {
          // Team not found, use constructorId from API
          teamId = constructor.constructorId;

          // Add unknown team to cache
          if (!apiTeams[teamId]) {
            apiTeams[teamId] = {
              id: teamId,
              displayName: constructor.name,
              logo: null,
              apiAliases: [constructor.name, constructor.constructorId],
              isUnknown: true,
              syncedAt: new Date().toISOString()
            };
          }
        }

        apiDrivers[driverId] = {
          id: driverId,
          displayName: `${driver.givenName} ${driver.familyName}`,
          firstName: driver.givenName,
          lastName: driver.familyName,
          number: driver.permanentNumber,
          currentTeam: teamId,
          apiCode: driver.code,
          apiAliases: [
            driver.familyName,
            `${driver.givenName} ${driver.familyName}`,
            driver.code
          ],
          syncedAt: new Date().toISOString()
        };
      });

      // Save to cache
      this.apiCache = {
        drivers: apiDrivers,
        teams: apiTeams,
        lastSync: new Date().toISOString()
      };

      this.saveCache();

      log(`✅ Sincronizzati ${Object.keys(apiDrivers).length} piloti da API`);

      if (Object.keys(apiTeams).length > 0) {
        warn(`⚠️ Trovati ${Object.keys(apiTeams).length} team non mappati:`, Object.keys(apiTeams));
      }

      return this.apiCache;

    } catch (err) {
      error('❌ Errore durante sync API:', err);
      return null;
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Loads cache from localStorage
   * @returns {Object|null} Cache data or null
   */
  loadCache() {
    try {
      const cachedDrivers = localStorage.getItem(CACHE_KEY_DRIVERS);
      const cachedTeams = localStorage.getItem(CACHE_KEY_TEAMS);

      if (!cachedDrivers && !cachedTeams) return null;

      const driversData = cachedDrivers ? JSON.parse(cachedDrivers) : null;
      const teamsData = cachedTeams ? JSON.parse(cachedTeams) : null;

      // Check drivers cache expiration
      if (driversData) {
        const cacheAge = Date.now() - new Date(driversData.lastSync).getTime();
        const maxAge = this.manualData.config.cacheExpirationHours * 60 * 60 * 1000;

        if (cacheAge > maxAge) {
          log('⏰ Cache piloti scaduta');
          localStorage.removeItem(CACHE_KEY_DRIVERS);
          return null;
        }

        log(`📦 Cache piloti caricata (age: ${Math.round(cacheAge / 1000 / 60)} min)`);

        return {
          drivers: driversData.drivers,
          teams: teamsData?.teams || {},
          lastSync: driversData.lastSync
        };
      }

      return null;
    } catch (err) {
      error('❌ Errore caricamento cache:', err);
      return null;
    }
  }

  /**
   * Saves cache to localStorage
   */
  saveCache() {
    try {
      if (!this.apiCache) return;

      // Save drivers and teams separately
      localStorage.setItem(CACHE_KEY_DRIVERS, JSON.stringify({
        drivers: this.apiCache.drivers,
        lastSync: this.apiCache.lastSync
      }));

      if (this.apiCache.teams && Object.keys(this.apiCache.teams).length > 0) {
        localStorage.setItem(CACHE_KEY_TEAMS, JSON.stringify({
          teams: this.apiCache.teams,
          lastSync: this.apiCache.lastSync
        }));
      }

      log('💾 Cache salvata in localStorage');
    } catch (err) {
      error('❌ Errore salvataggio cache:', err);
    }
  }

  /**
   * Clears cache from localStorage
   */
  clearCache() {
    localStorage.removeItem(CACHE_KEY_DRIVERS);
    localStorage.removeItem(CACHE_KEY_TEAMS);
    this.apiCache = null;
    this.unknownDrivers.clear();
    this.unknownTeams.clear();
    log('🗑️ Cache pulita');
  }

  /**
   * Exports unknown drivers found during runtime
   * @returns {Object|null} JSON object with unknown drivers or null
   */
  exportUnknownDrivers() {
    const unknowns = Array.from(this.unknownDrivers.values());

    if (unknowns.length === 0) {
      log('✅ Nessun pilota sconosciuto trovato');
      return null;
    }

    log('📋 Piloti non mappati trovati:');
    log(unknowns);

    // Generate JSON to copy to f1-data.json
    const jsonToAdd = {};
    unknowns.forEach(driver => {
      jsonToAdd[driver.id] = {
        id: driver.id,
        displayName: driver.displayName,
        firstName: driver.firstName,
        lastName: driver.lastName,
        number: driver.number,
        currentTeam: driver.currentTeam,
        apiAliases: [
          driver.lastName,
          driver.displayName
        ]
      };
    });

    log('📝 JSON da aggiungere a f1-data.json:');
    log(JSON.stringify(jsonToAdd, null, 2));

    return jsonToAdd;
  }

  /**
   * Exports unknown teams found during runtime
   * @returns {Array|null} Array of unknown teams or null
   */
  exportUnknownTeams() {
    const unknowns = Array.from(this.unknownTeams.values());

    if (unknowns.length === 0) {
      log('✅ Nessun team sconosciuto trovato');
      return null;
    }

    log('📋 Team non mappati trovati:');
    log(unknowns);

    return Array.from(this.unknownTeams.values());
  }

  /**
   * Gets all drivers from all sources
   * @returns {Array} Array of all drivers
   */
  getAllDrivers() {
    const drivers = [];
    const seen = new Set();

    // From manual (priority)
    Object.values(this.manualData.drivers).forEach(d => {
      drivers.push({ ...d, source: 'manual' });
      seen.add(d.displayName);
    });

    // From API cache (only those not already in manual)
    if (this.apiCache?.drivers) {
      Object.values(this.apiCache.drivers).forEach(d => {
        if (!seen.has(d.displayName)) {
          const team = this.manualData.teams[d.currentTeam];
          drivers.push({ ...d, teamData: team, source: 'api' });
          seen.add(d.displayName);
        }
      });
    }

    // Unknown found at runtime
    this.unknownDrivers.forEach(d => {
      if (!seen.has(d.displayName)) {
        drivers.push(d);
        seen.add(d.displayName);
      }
    });

    return drivers;
  }

  /**
   * Gets all teams from all sources
   * @returns {Array} Array of all teams
   */
  getAllTeams() {
    const teams = [];
    const seen = new Set();

    // From manual
    Object.values(this.manualData.teams).forEach(t => {
      teams.push({ ...t, source: 'manual' });
      seen.add(t.displayName);
    });

    // From API cache
    if (this.apiCache?.teams) {
      Object.values(this.apiCache.teams).forEach(t => {
        if (!seen.has(t.displayName)) {
          teams.push({ ...t, source: 'api' });
          seen.add(t.displayName);
        }
      });
    }

    // Unknown teams
    this.unknownTeams.forEach(t => {
      if (!seen.has(t.displayName)) {
        teams.push(t);
        seen.add(t.displayName);
      }
    });

    return teams;
  }

  /**
   * Gets team for a driver by name
   * @param {string} driverName - Driver name
   * @returns {Object|null} Team object or null
   */
  getDriverTeam(driverName) {
    const driver = this.getAllDrivers().find(
      d => d.displayName === driverName ||
           d.apiAliases?.includes(driverName)
    );

    if (!driver || !driver.currentTeam) return null;

    return this.manualData.teams[driver.currentTeam] ||
           this.apiCache?.teams?.[driver.currentTeam] ||
           null;
  }

  /**
   * Gets team logo path
   * @param {string} teamIdOrName - Team ID or name
   * @returns {string|null} Logo path or null
   */
  getTeamLogo(teamIdOrName) {
    const team = this.manualData.teams[teamIdOrName] ||
                 Object.values(this.manualData.teams).find(
                   t => t.displayName === teamIdOrName ||
                        t.apiAliases.includes(teamIdOrName)
                 ) ||
                 this.apiCache?.teams?.[teamIdOrName];

    return team?.logo || null;
  }
}

// Singleton instance
const f1DataResolverInstance = new F1DataResolver();

// Export singleton instance
export default f1DataResolverInstance;

// Export funzioni helper per backward compatibility
export const resolveDriver = (apiDriver, apiConstructor) =>
  f1DataResolverInstance.resolveDriver(apiDriver, apiConstructor);

export const resolveTeam = (apiTeamName) =>
  f1DataResolverInstance.resolveTeam(apiTeamName);

export const syncFromAPI = () =>
  f1DataResolverInstance.syncFromAPI();

export const getAllDrivers = () =>
  f1DataResolverInstance.getAllDrivers();

export const getAllTeams = () =>
  f1DataResolverInstance.getAllTeams();

export const getDriverTeam = (driverName) =>
  f1DataResolverInstance.getDriverTeam(driverName);

export const getTeamLogo = (teamIdOrName) =>
  f1DataResolverInstance.getTeamLogo(teamIdOrName);

export const exportUnknownDrivers = () =>
  f1DataResolverInstance.exportUnknownDrivers();

export const exportUnknownTeams = () =>
  f1DataResolverInstance.exportUnknownTeams();

export const clearCache = () =>
  f1DataResolverInstance.clearCache();
