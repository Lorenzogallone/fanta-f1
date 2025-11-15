/**
 * @file Minimal ICS parser for browser (no external dependencies)
 * Parses F1 calendar ICS files and extracts race events
 */

/**
 * Converts ICS date string (YYYYMMDDTHHMMSS or timestamp format) to Date object
 * @param {string} str - Date in ICS format
 * @returns {Date} Date object
 */
function parseICSDate(str) {
  // Format: 20250316T050000Z or 20250316T050000
  if (!str) return null;

  const clean = str.replace(/[TZ:-]/g, "");
  const year = parseInt(clean.substring(0, 4), 10);
  const month = parseInt(clean.substring(4, 6), 10) - 1; // 0-indexed
  const day = parseInt(clean.substring(6, 8), 10);
  const hour = parseInt(clean.substring(8, 10), 10) || 0;
  const minute = parseInt(clean.substring(10, 12), 10) || 0;
  const second = parseInt(clean.substring(12, 14), 10) || 0;

  return new Date(Date.UTC(year, month, day, hour, minute, second));
}

/**
 * Extracts properties from a VEVENT block
 * @param {string} eventBlock - VEVENT block text
 * @returns {Object} Object with summary and start properties
 */
function parseVEvent(eventBlock) {
  const summaryMatch = eventBlock.match(/SUMMARY:(.+)/);
  const dtStartMatch = eventBlock.match(/DTSTART[^:]*:(.+)/);

  return {
    summary: summaryMatch ? summaryMatch[1].trim() : "",
    start: dtStartMatch ? parseICSDate(dtStartMatch[1].trim()) : null,
  };
}

/**
 * Converts a race name to a URL-friendly slug
 * @param {string} str - Race name
 * @returns {string} URL slug
 */
export function makeSlug(str) {
  return str
    .toLowerCase()
    .normalize("NFD") // Decompose accents
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * Parses an ICS file and extracts F1 races
 * @param {string} icsText - ICS file content
 * @returns {Array} Array of races with all events
 */
export function parseF1Calendar(icsText) {
  // Extract all VEVENT blocks
  const eventBlocks = icsText.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) || [];

  // Temporary map: { slugRace: { name, quali, race, qualiSprint, sprint } }
  const racesMap = {};

  eventBlocks.forEach((block) => {
    const event = parseVEvent(block);
    const summary = event.summary;

    // 1) Standard qualifying - Pattern: "F1: Qualifiche (Race Name)"
    let match = summary.match(/^F1:\s*Qualifiche\s*\((.+)\)$/);
    if (match) {
      const raceName = match[1].trim();
      const slugName = makeSlug(raceName);
      racesMap[slugName] = racesMap[slugName] || {
        name: raceName,
        quali: null,
        race: null,
        qualiSprint: null,
        sprint: null,
      };
      racesMap[slugName].quali = event.start;
      return;
    }

    // 2) Main race (Grand Prix) - Pattern: "F1: Gran Premio (Race Name)"
    match = summary.match(/^F1:\s*Gran Premio\s*\((.+)\)$/);
    if (match) {
      const raceName = match[1].trim();
      const slugName = makeSlug(raceName);
      racesMap[slugName] = racesMap[slugName] || {
        name: raceName,
        quali: null,
        race: null,
        qualiSprint: null,
        sprint: null,
      };
      racesMap[slugName].race = event.start;
      return;
    }

    // 3) Sprint qualifying - Pattern: "F1: Qualifiche Sprint (Race Name)"
    match = summary.match(/^F1:\s*Qualifiche Sprint\s*\((.+)\)$/);
    if (match) {
      const raceName = match[1].trim();
      const slugName = makeSlug(raceName);
      racesMap[slugName] = racesMap[slugName] || {
        name: raceName,
        quali: null,
        race: null,
        qualiSprint: null,
        sprint: null,
      };
      racesMap[slugName].qualiSprint = event.start;
      return;
    }

    // 4) Sprint race - Pattern: "F1: Sprint (Race Name)"
    match = summary.match(/^F1:\s*Sprint\s*\((.+)\)$/);
    if (match) {
      const raceName = match[1].trim();
      const slugName = makeSlug(raceName);
      racesMap[slugName] = racesMap[slugName] || {
        name: raceName,
        quali: null,
        race: null,
        qualiSprint: null,
        sprint: null,
      };
      racesMap[slugName].sprint = event.start;
      return;
    }

    // Other events are ignored (P1, P2, P3, etc.)
  });

  // Transform map to array, filter races with quali and race,
  // sort by main race date and assign round numbers
  const racesArray = Object.values(racesMap)
    .filter((r) => r.quali && r.race)
    .sort((a, b) => a.race - b.race)
    .map((r, idx) => ({
      id: makeSlug(r.name),
      name: r.name,
      round: idx + 1,
      qualiUTC: r.quali,
      raceUTC: r.race,
      qualiSprintUTC: r.qualiSprint || null,
      sprintUTC: r.sprint || null,
    }));

  return racesArray;
}
