/**
 * @file F1DataContext.jsx
 * Provides drivers and teams from Firestore (`drivers`, `teams` collections).
 *
 * Read once per session (no realtime listener): the data changes very rarely,
 * so a listener would only cost reads. Admin pages call reload() after saving.
 * Falls back to src/data/f1-data.json if the collections are empty or not
 * readable (e.g. before the data migration).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { F1DataContext } from "../hooks/useF1Data";
import PropTypes from "prop-types";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../services/firebase";
import { useAuthContext } from "./AuthContext";
import f1DataResolver from "../services/f1DataResolver";
import f1DataManual from "../data/f1-data.json";
import { seedDrivers, seedTeams } from "../data/f1Seed";
import { warn } from "../utils/logger";
import { useWarm } from "../hooks/useWarm";

const byName = (a, b) => a.name.localeCompare(b.name);

/**
 * Loads drivers and teams after login and keeps f1DataResolver in sync.
 */
export function F1DataProvider({ children }) {
  const { user } = useAuthContext();
  const [data, setData] = useState(() => ({
    drivers: seedDrivers(f1DataManual),
    teams: seedTeams(f1DataManual),
    source: "seed",
  }));
  const [loading, setLoading] = useState(true);
  // Jolpica standings (prefetched by the warm-up): the pick lists follow them
  const standings = useWarm("standings");

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [driversSnap, teamsSnap] = await Promise.all([
        getDocs(collection(db, "drivers")),
        getDocs(collection(db, "teams")),
      ]);
      if (driversSnap.empty || teamsSnap.empty) {
        warn("[F1Data] drivers/teams empty, using f1-data.json");
        return;
      }
      const drivers = driversSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const teams = teamsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      f1DataResolver.setData(drivers, teams, "firestore");
      setData({ drivers, teams, source: "firestore" });
    } catch (err) {
      warn("[F1Data] Firestore read failed, using f1-data.json:", err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    reload();
  }, [user, reload]);

  const value = useMemo(() => {
    const teamById = new Map(data.teams.map((t) => [t.id, t]));
    const driverByName = new Map(data.drivers.map((d) => [d.name, d]));
    const teamByName = new Map(data.teams.map((t) => [t.name, t]));

    // Drivers grouped by team. Teams follow the constructors' championship and
    // drivers within a team the drivers' championship, so the usual picks come
    // first; without standings (start of season, offline) teams go alphabetically.
    const teamName = (d) => teamById.get(d.teamId)?.name || "~";
    const teamRank = new Map((standings?.constructors || []).map((s, i) => [s.constructor, i]));
    const driverRank = new Map((standings?.drivers || []).map((s, i) => [s.driver, i]));
    const rankOf = (map, key) => (map.has(key) ? map.get(key) : 999);
    const byTeam = (a, b) =>
      rankOf(teamRank, teamName(a)) - rankOf(teamRank, teamName(b)) ||
      teamName(a).localeCompare(teamName(b)) ||
      rankOf(driverRank, a.name) - rankOf(driverRank, b.name) ||
      byName(a, b);

    const getDriverTeam = (driverName) => {
      const driver = driverByName.get(driverName);
      if (driver) return teamById.get(driver.teamId)?.name || null;
      return f1DataResolver.getDriverTeam(driverName)?.displayName || null;
    };
    const getTeamLogo = (teamName) =>
      teamByName.get(teamName)?.logo || f1DataResolver.getTeamLogo(teamName);

    return {
      drivers: data.drivers,
      teams: data.teams,
      selectableDrivers: data.drivers.filter((d) => d.active !== false && d.selectable !== false).sort(byTeam),
      activeDrivers: data.drivers.filter((d) => d.active !== false).sort(byTeam),
      activeTeams: data.teams.filter((t) => t.active !== false).sort(byName),
      getDriverTeam,
      getTeamLogo,
      getDriverLogo: (driverName) => {
        const team = getDriverTeam(driverName);
        return team ? getTeamLogo(team) : null;
      },
      source: data.source,
      loading,
      reload,
    };
  }, [data, loading, reload, standings]);

  return <F1DataContext.Provider value={value}>{children}</F1DataContext.Provider>;
}

F1DataProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
