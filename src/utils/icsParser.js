// src/utils/icsParser.js
// Parser ICS minimale per browser (senza dipendenze esterne)

/**
 * Converte una stringa di data ICS (YYYYMMDDTHHMMSS o formato Timestamp) in Date
 * @param {string} str - Data nel formato ICS
 * @returns {Date} - Oggetto Date
 */
function parseICSDate(str) {
  // Formato: 20250316T050000Z o 20250316T050000
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
 * Estrae proprietà da un blocco VEVENT
 * @param {string} eventBlock - Testo del blocco VEVENT
 * @returns {Object} - Oggetto con summary e start
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
 * Converte un nome di gara in uno slug
 * @param {string} str - Nome della gara
 * @returns {string} - Slug
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
 * Parsa un file ICS e estrae le gare F1
 * @param {string} icsText - Contenuto del file ICS
 * @returns {Array} - Array di gare con tutti gli eventi
 */
export function parseF1Calendar(icsText) {
  // Estrai tutti i blocchi VEVENT
  const eventBlocks = icsText.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) || [];

  // Mappa temporanea: { slugRace: { name, quali, race, qualiSprint, sprint } }
  const racesMap = {};

  eventBlocks.forEach((block) => {
    const event = parseVEvent(block);
    const summary = event.summary;

    // 1) Qualifiche "normali" - Pattern: "F1: Qualifiche (Nome Gara)"
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

    // 2) Gara (Gran Premio normale) - Pattern: "F1: Gran Premio (Nome Gara)"
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

    // 3) Qualifiche Sprint - Pattern: "F1: Qualifiche Sprint (Nome Gara)"
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

    // 4) Gara Sprint - Pattern: "F1: Sprint (Nome Gara)"
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

    // Altri eventi vengono ignorati (P1, P2, P3, etc.)
  });

  // Trasforma map → array, filtra solo gare con qualifiche e gara,
  // ordina per data della gara principale e assegna il numero di round
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
