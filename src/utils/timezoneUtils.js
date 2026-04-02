/**
 * @file timezoneUtils.js
 * @description Utilities for timezone display names and abbreviations.
 * Converts IANA timezone identifiers to human-readable labels.
 */

/**
 * Map of IANA timezone to short abbreviation (EST, CET, GMT, etc.)
 * Approximate abbreviations based on standard time (may vary during DST).
 */
const TIMEZONE_ABBREVIATIONS = {
  "Europe/Rome": "CET",
  "Europe/London": "GMT",
  "Europe/Paris": "CET",
  "Europe/Berlin": "CET",
  "Europe/Madrid": "CET",
  "Europe/Zurich": "CET",
  "Europe/Amsterdam": "CET",
  "Europe/Brussels": "CET",
  "Europe/Vienna": "CET",
  "Europe/Athens": "EET",
  "Europe/Lisbon": "WET",
  "America/New_York": "EST",
  "America/Chicago": "CST",
  "America/Denver": "MST",
  "America/Los_Angeles": "PST",
  "America/Sao_Paulo": "BRT",
  "Asia/Dubai": "GST",
  "Asia/Tokyo": "JST",
  "Asia/Shanghai": "CST",
  "Asia/Singapore": "SGT",
  "Australia/Sydney": "AEST",
};

/**
 * Map of IANA timezone to full name (e.g., "Central European Time").
 */
const TIMEZONE_NAMES = {
  "Europe/Rome": "Central European Time",
  "Europe/London": "Greenwich Mean Time",
  "Europe/Paris": "Central European Time",
  "Europe/Berlin": "Central European Time",
  "Europe/Madrid": "Central European Time",
  "Europe/Zurich": "Central European Time",
  "Europe/Amsterdam": "Central European Time",
  "Europe/Brussels": "Central European Time",
  "Europe/Vienna": "Central European Time",
  "Europe/Athens": "Eastern European Time",
  "Europe/Lisbon": "Western European Time",
  "America/New_York": "Eastern Standard Time",
  "America/Chicago": "Central Standard Time",
  "America/Denver": "Mountain Standard Time",
  "America/Los_Angeles": "Pacific Standard Time",
  "America/Sao_Paulo": "Brasília Time",
  "Asia/Dubai": "Gulf Standard Time",
  "Asia/Tokyo": "Japan Standard Time",
  "Asia/Shanghai": "China Standard Time",
  "Asia/Singapore": "Singapore Standard Time",
  "Australia/Sydney": "Australian Eastern Standard Time",
};

/**
 * Get the abbreviation for a timezone (e.g., "CET", "EST").
 * @param {string} timezone - IANA timezone (e.g., "Europe/Rome")
 * @returns {string} Abbreviation (e.g., "CET") or timezone as fallback
 */
export function getTimezoneAbbreviation(timezone) {
  return TIMEZONE_ABBREVIATIONS[timezone] || timezone;
}

/**
 * Get the full name for a timezone.
 * @param {string} timezone - IANA timezone (e.g., "Europe/Rome")
 * @returns {string} Full name (e.g., "Central European Time") or timezone as fallback
 */
export function getTimezoneName(timezone) {
  return TIMEZONE_NAMES[timezone] || timezone;
}

/**
 * Get formatted timezone display string.
 * @param {string} timezone - IANA timezone
 * @returns {string} e.g., "CET (Central European Time)"
 */
export function getTimezoneDisplay(timezone) {
  const abbr = getTimezoneAbbreviation(timezone);
  const name = getTimezoneName(timezone);
  return name ? `${abbr} (${name})` : abbr;
}
