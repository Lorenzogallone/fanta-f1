/**
 * @file useF1Data.js
 * @description Access to drivers and teams provided by F1DataProvider.
 */
import { createContext, useContext } from "react";

/** Context object (the provider lives in contexts/F1DataContext.jsx) */
export const F1DataContext = createContext(null);

/**
 * Hook to access drivers and teams.
 * @returns {Object} { drivers, teams, selectableDrivers, activeDrivers, activeTeams,
 *   getDriverTeam, getTeamLogo, getDriverLogo, loading, source, reload }
 */
export function useF1Data() {
  const context = useContext(F1DataContext);
  if (!context) {
    throw new Error("useF1Data must be used within F1DataProvider");
  }
  return context;
}
