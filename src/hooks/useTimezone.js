/**
 * @file useTimezone.js
 * @description Hook for user timezone preference.
 * Priority: Firestore (users/{uid}.timezone) > localStorage > "Europe/Rome"
 * Saves to both Firestore and localStorage on change.
 * Falls back to localStorage-only for unauthenticated users.
 */

import { useState, useEffect, useCallback } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../services/firebase";
import { useAuth } from "./useAuth";

const STORAGE_KEY = "fanta-f1-timezone";
const DEFAULT_TZ = "Europe/Rome";

/**
 * Common timezone options.
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
  { value: "Asia/Kolkata", label: "India (IST)", flag: "🇮🇳" },
  { value: "Australia/Sydney", label: "Sydney (AEST)", flag: "🇦🇺" },
  { value: "Pacific/Auckland", label: "Auckland (NZST)", flag: "🇳🇿" },
];

function getLocalTz() {
  try {
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_TZ;
  } catch {
    return DEFAULT_TZ;
  }
}

/**
 * Hook for timezone preference.
 * @returns {{ timezone: string, setTimezone: (tz: string) => void }}
 */
export function useTimezone() {
  const { user, userProfile, updateUserProfile } = useAuth();

  // Initialise from localStorage so the first render already has a value
  const [timezone, setTimezoneState] = useState(getLocalTz);

  // When the Firestore profile loads, sync its timezone to local state
  useEffect(() => {
    if (userProfile?.timezone) {
      setTimezoneState(userProfile.timezone);
      try { localStorage.setItem(STORAGE_KEY, userProfile.timezone); } catch { /* ignore */ }
    }
  }, [userProfile?.timezone]);

  /**
   * Change timezone, persist to Firestore (if logged in) and localStorage.
   */
  const setTimezone = useCallback(async (tz) => {
    setTimezoneState(tz);
    try { localStorage.setItem(STORAGE_KEY, tz); } catch { /* ignore */ }

    if (user?.uid) {
      try {
        await updateDoc(doc(db, "users", user.uid), { timezone: tz });
        updateUserProfile({ timezone: tz });
      } catch { /* non-critical */ }
    }
  }, [user, updateUserProfile]);

  return { timezone, setTimezone };
}
