/**
 * @file useTimezone.js
 * @description Hook for user timezone preference with localStorage persistence.
 * Provides timezone value and a setter, plus a formatDateTime utility.
 */

import { useState, useCallback } from "react";

const STORAGE_KEY = "fanta-f1-timezone";
const DEFAULT_TZ = "Europe/Rome";

/**
 * Common timezone options grouped by region.
 * Each entry: { value: IANA timezone, label: display name, flag }
 */
export const TIMEZONE_OPTIONS = [
  { value: "Europe/Rome", label: "Roma (CET)", flag: "🇮🇹" },
  { value: "Europe/London", label: "Londra (GMT)", flag: "🇬🇧" },
  { value: "Europe/Paris", label: "Parigi (CET)", flag: "🇫🇷" },
  { value: "Europe/Berlin", label: "Berlino (CET)", flag: "🇩🇪" },
  { value: "Europe/Madrid", label: "Madrid (CET)", flag: "🇪🇸" },
  { value: "Europe/Zurich", label: "Zurigo (CET)", flag: "🇨🇭" },
  { value: "Europe/Amsterdam", label: "Amsterdam (CET)", flag: "🇳🇱" },
  { value: "Europe/Brussels", label: "Bruxelles (CET)", flag: "🇧🇪" },
  { value: "Europe/Vienna", label: "Vienna (CET)", flag: "🇦🇹" },
  { value: "Europe/Athens", label: "Atene (EET)", flag: "🇬🇷" },
  { value: "Europe/Lisbon", label: "Lisbona (WET)", flag: "🇵🇹" },
  { value: "America/New_York", label: "New York (EST)", flag: "🇺🇸" },
  { value: "America/Chicago", label: "Chicago (CST)", flag: "🇺🇸" },
  { value: "America/Denver", label: "Denver (MST)", flag: "🇺🇸" },
  { value: "America/Los_Angeles", label: "Los Angeles (PST)", flag: "🇺🇸" },
  { value: "America/Sao_Paulo", label: "San Paolo (BRT)", flag: "🇧🇷" },
  { value: "Asia/Dubai", label: "Dubai (GST)", flag: "🇦🇪" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)", flag: "🇯🇵" },
  { value: "Asia/Shanghai", label: "Shanghai (CST)", flag: "🇨🇳" },
  { value: "Asia/Singapore", label: "Singapore (SGT)", flag: "🇸🇬" },
  { value: "Australia/Sydney", label: "Sydney (AEST)", flag: "🇦🇺" },
];

/**
 * Hook for timezone preference.
 * @returns {{ timezone: string, setTimezone: (tz: string) => void, formatDateTime: Function }}
 */
export function useTimezone() {
  const [timezone, setTimezoneState] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || DEFAULT_TZ;
    } catch {
      return DEFAULT_TZ;
    }
  });

  const setTimezone = useCallback((tz) => {
    setTimezoneState(tz);
    try {
      localStorage.setItem(STORAGE_KEY, tz);
    } catch {
      // localStorage not available
    }
  }, []);

  /**
   * Format a Firestore timestamp or Date to localized date/time string.
   * @param {Object|Date|number} timestamp - Firestore Timestamp, Date, or ms
   * @param {string} locale - e.g. "it-IT" or "en-GB"
   * @param {Object} options - Intl.DateTimeFormat options (without timeZone)
   * @returns {string} Formatted date/time string
   */
  const formatDateTime = useCallback((timestamp, locale, options = {}) => {
    if (!timestamp) return "—";
    let date;
    if (timestamp.toDate) {
      date = timestamp.toDate();
    } else if (timestamp.seconds) {
      date = new Date(timestamp.seconds * 1000);
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else if (typeof timestamp === "number") {
      date = new Date(timestamp);
    } else {
      return "—";
    }
    return date.toLocaleString(locale, { ...options, timeZone: timezone });
  }, [timezone]);

  return { timezone, setTimezone, formatDateTime };
}
