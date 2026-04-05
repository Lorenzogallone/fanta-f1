/**
 * @file Cloud Functions for FantaF1 Push Notifications
 * @description Scheduled functions that send qualifying reminders.
 * @version 3.0.0
 *
 * Notification schedule per session type (Main Race and Sprint treated separately):
 *   - Daytime session  (user tz >= 09:00): 1 ora prima + 5 minuti prima
 *   - Nighttime session (user tz < 09:00): sera precedente alle 21:00 (user tz) + 5 minuti prima
 *
 * Timezone-aware: notifications adapt to each user's configured timezone.
 * Fallback: users without a timezone preference default to Europe/Rome (CET).
 * All notification text is in Italian, professional tone, no emoji.
 */
/* eslint-env node */

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();
const db = getFirestore();

// ─── Configuration ───────────────────────────────────────────────────────────

/** How often the 1h check runs (every 10 minutes) */
const CHECK_INTERVAL_1H_MS = 10 * 60 * 1000;

/** How often the 5min check runs (every 1 minute) */
const CHECK_INTERVAL_5MIN_MS = 1 * 60 * 1000;

/** Default timezone (fallback when user has no preference) */
const TIMEZONE = "Europe/Rome";

/** All supported timezones (mirrors TIMEZONE_OPTIONS in useTimezone.js) */
const SUPPORTED_TIMEZONES = [
  "Europe/Rome", "Europe/London", "Europe/Paris", "Europe/Berlin",
  "Europe/Madrid", "Europe/Zurich", "Europe/Amsterdam", "Europe/Brussels",
  "Europe/Vienna", "Europe/Athens", "Europe/Lisbon",
  "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "America/Sao_Paulo", "Asia/Dubai", "Asia/Tokyo", "Asia/Shanghai",
  "Asia/Singapore", "Asia/Kolkata", "Australia/Sydney", "Pacific/Auckland",
];

/**
 * URL base dell'app. Usato per costruire URL assoluti delle icone nelle notifiche:
 * i path relativi non vengono risolti correttamente da FCM su Android quando
 * l'app non è aperta in primo piano.
 */
const SITE_URL = "https://fanta-f1-bfb7b.web.app";

/** Icona principale della notifica (192px, formato corretto per Android) */
const NOTIFICATION_ICON = `${SITE_URL}/FantaF1_Logo_192.png`;

/** Badge monocromatico per la status bar di Android */
const NOTIFICATION_BADGE = `${SITE_URL}/FantaF1_Logo_192.png`;

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * Returns the hour (0–23) for a given UTC Date in the specified timezone.
 * @param {Date} dateUTC
 * @param {string} tz  IANA timezone (e.g., "Europe/Rome")
 * @returns {number}
 */
function getHourInTz(dateUTC, tz) {
  const str = dateUTC.toLocaleString("en-US", {
    timeZone: tz,
    hour: "numeric",
    hour12: false,
  });
  return parseInt(str, 10);
}

/** @deprecated Use getHourInTz(dateUTC, tz) */
function getCETHour(dateUTC) { return getHourInTz(dateUTC, TIMEZONE); }

/**
 * Returns true when the session falls in the "nighttime" band (local hour < 9).
 * @param {Date} dateUTC
 * @param {string} tz  IANA timezone
 * @returns {boolean}
 */
function isNightTime(dateUTC, tz) {
  return getHourInTz(dateUTC, tz) < 9;
}

/** @deprecated Use isNightTime(dateUTC, tz) */
function isNightTimeCET(dateUTC) { return isNightTime(dateUTC, TIMEZONE); }

/**
 * Formats a UTC Date as "HH:MM" in the given timezone.
 * @param {Date} dateUTC
 * @param {string} tz  IANA timezone
 * @returns {string}
 */
function formatTime(dateUTC, tz) {
  return dateUTC.toLocaleString("it-IT", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/**
 * Formats a UTC Date as "6 aprile" (day + month) in the given timezone.
 * @param {Date} dateUTC
 * @param {string} tz  IANA timezone
 * @returns {string}
 */
function formatDate(dateUTC, tz) {
  return dateUTC.toLocaleString("it-IT", {
    timeZone: tz,
    day: "numeric",
    month: "long",
  });
}

/**
 * Returns the timezone abbreviation (e.g., "CET", "EST", "JST") at a given moment.
 * Handles DST automatically (e.g., returns "CEST" during summer for Europe/Rome).
 * @param {Date} dateUTC
 * @param {string} tz  IANA timezone
 * @returns {string}
 */
function getTzAbbr(dateUTC, tz) {
  return dateUTC.toLocaleString("en-US", { timeZone: tz, timeZoneName: "short" })
    .split(" ").pop();
}

/**
 * Returns a UTC offset key for grouping timezones (e.g., "UTC+01:00").
 * Timezones with the same offset share the same notification text.
 * @param {Date} dateUTC
 * @param {string} tz  IANA timezone
 * @returns {string}
 */
function getUtcOffsetKey(dateUTC, tz) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    timeZoneName: "longOffset",
  }).formatToParts(dateUTC);
  const offsetPart = parts.find((p) => p.type === "timeZoneName");
  return (offsetPart ? offsetPart.value : "GMT").replace("GMT", "UTC");
}

/**
 * Returns the list of supported timezones where the current local hour equals targetHour.
 * Used to short-circuit the evening function when no timezone has hour 21.
 * @param {number} targetHour
 * @returns {string[]}
 */
function getTimezonesAtHour(targetHour) {
  const now = new Date();
  return SUPPORTED_TIMEZONES.filter((tz) => getHourInTz(now, tz) === targetHour);
}

/**
 * Returns the current season year based on CET date.
 * Used to namespace dedup docIds so they don't collide across seasons.
 * @returns {number}
 */
function getCurrentSeasonYear() {
  const now = new Date();
  return parseInt(
    now.toLocaleString("en-US", { timeZone: TIMEZONE, year: "numeric" }),
    10
  );
}

/**
 * Reads only races whose session deadline falls within the given time window.
 * Much cheaper than reading all races — typically returns 0 documents and
 * costs 0 reads outside of race weekends.
 *
 * @param {"main"|"sprint"} sessionType
 * @param {Date} windowStart
 * @param {Date} windowEnd
 * @returns {Promise<Array>}
 */
async function getRacesInWindow(sessionType, windowStart, windowEnd) {
  const field = sessionType === "sprint" ? "qualiSprintUTC" : "qualiUTC";
  const startTs = Timestamp.fromDate(windowStart);
  const endTs = Timestamp.fromDate(windowEnd);
  const snapshot = await db
    .collection("races")
    .where(field, ">=", startTs)
    .where(field, "<", endTs)
    .get();
  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      name: data.name,
      qualiUTC: data.qualiUTC ? data.qualiUTC.toDate() : null,
      qualiSprintUTC: data.qualiSprintUTC ? data.qualiSprintUTC.toDate() : null,
      cancelledMain: data.cancelledMain || false,
      cancelledSprint: data.cancelledSprint || false,
    };
  });
}

/**
 * Reads races for evening notification: queries both main and sprint deadlines
 * within the window and merges results (deduped by doc id).
 *
 * @param {Date} windowStart
 * @param {Date} windowEnd
 * @returns {Promise<Array>}
 */
async function getRacesInWindowBoth(windowStart, windowEnd) {
  const startTs = Timestamp.fromDate(windowStart);
  const endTs = Timestamp.fromDate(windowEnd);
  const [mainSnap, sprintSnap] = await Promise.all([
    db.collection("races")
      .where("qualiUTC", ">=", startTs)
      .where("qualiUTC", "<", endTs)
      .get(),
    db.collection("races")
      .where("qualiSprintUTC", ">=", startTs)
      .where("qualiSprintUTC", "<", endTs)
      .get(),
  ]);

  const seen = new Set();
  const races = [];
  for (const snap of [mainSnap, sprintSnap]) {
    for (const doc of snap.docs) {
      if (seen.has(doc.id)) continue;
      seen.add(doc.id);
      const data = doc.data();
      races.push({
        id: doc.id,
        name: data.name,
        qualiUTC: data.qualiUTC ? data.qualiUTC.toDate() : null,
        qualiSprintUTC: data.qualiSprintUTC ? data.qualiSprintUTC.toDate() : null,
        cancelledMain: data.cancelledMain || false,
        cancelledSprint: data.cancelledSprint || false,
      });
    }
  }
  return races;
}

/**
 * Gets all FCM tokens from all users.
 * @returns {Promise<string[]>}
 */
async function getAllFcmTokens() {
  const snapshot = await db.collection("users").get();
  const tokens = [];
  snapshot.docs.forEach((doc) => {
    const data = doc.data();
    if (data.fcmTokens && Array.isArray(data.fcmTokens)) {
      tokens.push(...data.fcmTokens);
    }
  });
  return [...new Set(tokens)];
}

/**
 * Gets FCM tokens grouped by user timezone.
 * Same Firestore read as getAllFcmTokens — zero additional cost.
 * @returns {Promise<Map<string, string[]>>}  Map<IANA timezone, unique tokens>
 */
async function getUsersGroupedByTimezone() {
  const snapshot = await db.collection("users").get();
  const groups = new Map();
  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (!data.fcmTokens || !Array.isArray(data.fcmTokens) || data.fcmTokens.length === 0) continue;
    const tz = data.timezone || TIMEZONE;
    if (!groups.has(tz)) groups.set(tz, []);
    groups.get(tz).push(...data.fcmTokens);
  }
  // Dedup tokens within each group
  for (const [tz, tokens] of groups) {
    groups.set(tz, [...new Set(tokens)]);
  }
  return groups;
}

/**
 * Checks if a notification has already been sent (deduplication).
 * Also checks the legacy format (without year prefix) and migrates it
 * automatically so old data is preserved without manual intervention.
 *
 * @param {string} docId  New format: "2026_raceId_quali_1h"
 * @returns {Promise<boolean>}
 */
async function isAlreadySent(docId) {
  const col = db.collection("notificationsSent");

  // Check new year-prefixed format first
  const newDoc = await col.doc(docId).get();
  if (newDoc.exists) return true;

  // Check legacy format (without year prefix, e.g. "raceId_quali_1h")
  const legacyId = docId.replace(/^\d{4}_/, "");
  if (legacyId === docId) return false; // no year prefix to strip

  const legacyDoc = await col.doc(legacyId).get();
  if (!legacyDoc.exists) return false;

  // Migrate: copy to new format and delete old document
  const batch = db.batch();
  batch.set(col.doc(docId), { ...legacyDoc.data(), migratedFrom: legacyId });
  batch.delete(col.doc(legacyId));
  await batch.commit();
  console.log(`Migrato notificationsSent: ${legacyId} → ${docId}`);
  return true;
}

/**
 * Marks a notification as sent.
 * @param {string} docId
 * @param {Object} metadata
 */
async function markAsSent(docId, metadata) {
  await db.collection("notificationsSent").doc(docId).set({
    sentAt: new Date(),
    ...metadata,
  });
}

/**
 * Removes invalid FCM tokens from user documents.
 * @param {string[]} invalidTokens
 */
async function cleanupInvalidTokens(invalidTokens) {
  if (!invalidTokens.length) return;

  const usersSnapshot = await db.collection("users").get();
  const batch = db.batch();
  let batchCount = 0;

  for (const userDoc of usersSnapshot.docs) {
    const data = userDoc.data();
    if (!data.fcmTokens || !Array.isArray(data.fcmTokens)) continue;

    const cleanedTokens = data.fcmTokens.filter(
      (t) => !invalidTokens.includes(t)
    );

    if (cleanedTokens.length !== data.fcmTokens.length) {
      batch.update(userDoc.ref, { fcmTokens: cleanedTokens });
      batchCount++;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
    console.log(`Token non validi rimossi da ${batchCount} utente/i`);
  }
}

/**
 * Internal: sends a push notification to a specific set of tokens.
 * @param {string[]} tokens
 * @param {string} title
 * @param {string} body
 * @param {string} tag
 * @returns {Promise<{successCount: number, failureCount: number}>}
 */
async function _sendPush(tokens, title, body, tag) {
  if (tokens.length === 0) {
    console.log("Nessun token FCM, invio saltato");
    return { successCount: 0, failureCount: 0 };
  }

  console.log(`Invio "${title}" a ${tokens.length} dispositivo/i`);

  const message = {
    notification: { title, body },
    data: { tag, url: "/lineup" },
    webpush: {
      notification: {
        icon: NOTIFICATION_ICON,
        badge: NOTIFICATION_BADGE,
        vibrate: [100, 50, 200],
        tag,
      },
      fcmOptions: { link: "/lineup" },
    },
  };

  const messaging = getMessaging();
  const invalidTokens = [];
  let successCount = 0;
  let failureCount = 0;

  const response = await messaging.sendEachForMulticast({ ...message, tokens });
  successCount = response.successCount;
  failureCount = response.failureCount;

  response.responses.forEach((resp, idx) => {
    if (
      !resp.success &&
      resp.error &&
      (resp.error.code === "messaging/invalid-registration-token" ||
        resp.error.code === "messaging/registration-token-not-registered")
    ) {
      invalidTokens.push(tokens[idx]);
    }
  });

  await cleanupInvalidTokens(invalidTokens);

  console.log(`Invio completato: ${successCount} riusciti, ${failureCount} falliti`);
  return { successCount, failureCount };
}

/**
 * Sends a push notification to ALL registered devices.
 * Used by the 5min function (no timezone logic needed).
 */
async function sendToAll(title, body, tag) {
  const tokens = await getAllFcmTokens();
  return _sendPush(tokens, title, body, tag);
}

/**
 * Sends a push notification to a specific set of tokens.
 * Used by timezone-aware functions (1h, evening).
 */
async function sendToTokens(tokens, title, body, tag) {
  return _sendPush(tokens, title, body, tag);
}

// ─── Notification Body Builders ───────────────────────────────────────────────

/**
 * Builds the Italian notification title and body for a given session/interval.
 *
 * @param {"main"|"sprint"} sessionType
 * @param {"1h"|"5min"|"evening"} interval
 * @param {Date}   deadlineUTC  Qualifying deadline (UTC)
 * @param {string} raceName
 * @param {string} [tz]  IANA timezone for formatting (used by evening notifications)
 * @returns {{ title: string, body: string }}
 */
function buildNotification(sessionType, interval, deadlineUTC, raceName, tz = TIMEZONE) {
  const sessionLabel = sessionType === "sprint" ? "Sprint" : "Gara";

  let body;
  if (interval === "evening") {
    const time = formatTime(deadlineUTC, tz);
    const date = formatDate(deadlineUTC, tz);
    const abbr = getTzAbbr(deadlineUTC, tz);
    body = `Formazione ${sessionLabel} — GP ${raceName}. Schiera entro le ${time} del ${date} ${abbr}.`;
  } else if (interval === "1h") {
    body = `Circa 1 ora alla deadline formazione ${sessionLabel} — GP ${raceName}.`;
  } else {
    body = `5 minuti alla deadline formazione ${sessionLabel} — GP ${raceName}!`;
  }

  return { title: raceName, body };
}

// ─── Core Check Logic ─────────────────────────────────────────────────────────

/**
 * Checks all sessions of a given type for an upcoming deadline within a time window
 * and sends notifications where needed.
 *
 * When skipNight is true (1h reminder), the notification is sent only to users
 * whose timezone makes the session "daytime" (local hour >= 9). Users in
 * nighttime timezones will receive the evening notification instead.
 *
 * When skipNight is false (5min reminder), sends to ALL users regardless of timezone.
 *
 * @param {"main"|"sprint"} sessionType
 * @param {number}  minutesBefore  Minutes before deadline to trigger
 * @param {number}  windowMs       Width of the detection window (matches schedule interval)
 * @param {string}  intervalLabel  Dedup suffix: "1h" | "5min"
 * @param {boolean} skipNight      If true, per-user nighttime skip
 */
async function checkAndNotifySession(
  sessionType,
  minutesBefore,
  windowMs,
  intervalLabel,
  skipNight
) {
  const now = new Date();
  const targetTime = new Date(now.getTime() + minutesBefore * 60 * 1000);
  const targetEnd = new Date(targetTime.getTime() + windowMs);

  // Targeted query: only fetch races whose deadline is within the window.
  // Costs 0 reads when no race is imminent (the common case).
  const races = await getRacesInWindow(sessionType, targetTime, targetEnd);

  console.log(
    `[${sessionType}/${intervalLabel}] window ${targetTime.toISOString()} – ${targetEnd.toISOString()} → ${races.length} gare trovate`
  );

  for (const race of races) {
    const deadlineUTC =
      sessionType === "sprint" ? race.qualiSprintUTC : race.qualiUTC;
    const cancelled =
      sessionType === "sprint" ? race.cancelledSprint : race.cancelledMain;

    if (!deadlineUTC || cancelled) continue;

    const sessionKey = sessionType === "sprint" ? "sprintQuali" : "quali";
    const year = getCurrentSeasonYear();

    if (skipNight) {
      // Per-timezone: send only to users where the session is daytime
      const tzGroups = await getUsersGroupedByTimezone();

      // Group tokens by UTC offset (timezones with same offset share notification)
      const offsetGroups = new Map(); // offsetKey -> tokens[]
      for (const [tz, tokens] of tzGroups) {
        if (isNightTime(deadlineUTC, tz)) continue; // skip nighttime users
        const offsetKey = getUtcOffsetKey(deadlineUTC, tz);
        if (!offsetGroups.has(offsetKey)) offsetGroups.set(offsetKey, []);
        offsetGroups.get(offsetKey).push(...tokens);
      }

      for (const [offsetKey, tokens] of offsetGroups) {
        const docId = `${year}_${race.id}_${sessionKey}_${intervalLabel}_${offsetKey}`;
        if (await isAlreadySent(docId)) continue;
        const { title, body } = buildNotification(
          sessionType, intervalLabel, deadlineUTC, race.name
        );
        await sendToTokens(tokens, title, body, docId);
        await markAsSent(docId, {
          raceId: race.id, raceName: race.name,
          type: sessionType === "sprint" ? "sprintQualifying" : "qualifying",
          interval: intervalLabel,
        });
      }
    } else {
      // 5min: send to everyone, no timezone logic
      const docId = `${year}_${race.id}_${sessionKey}_${intervalLabel}`;
      if (!(await isAlreadySent(docId))) {
        const { title, body } = buildNotification(
          sessionType, intervalLabel, deadlineUTC, race.name
        );
        await sendToAll(title, body, docId);
        await markAsSent(docId, {
          raceId: race.id, raceName: race.name,
          type: sessionType === "sprint" ? "sprintQualifying" : "qualifying",
          interval: intervalLabel,
        });
      }
    }
  }
}

/**
 * Checks for sessions that are "nighttime" in the given target timezones and sends
 * evening notifications to users in those timezones.
 * Runs hourly; the caller provides which timezones currently have local hour 21.
 *
 * @param {string[]} targetTimezones  Timezones where local hour is 21
 * @param {Map<string, string[]>} tzGroups  Users grouped by timezone
 */
async function checkAndNotifyEvening(targetTimezones, tzGroups) {
  const now = new Date();
  // Window: from now up to 12 hours ahead (covers overnight sessions)
  const windowEnd = new Date(now.getTime() + 12 * 60 * 60 * 1000);

  const races = await getRacesInWindowBoth(now, windowEnd);
  const year = getCurrentSeasonYear();

  console.log(
    `[evening] window ${now.toISOString()} – ${windowEnd.toISOString()} → ${races.length} gare trovate`
  );

  // Group target timezones by UTC offset (same offset = same notification text)
  const offsetToTimezones = new Map(); // offsetKey -> tz[]
  for (const tz of targetTimezones) {
    // Use a reference date in the window for offset calculation
    const refDate = now;
    const offsetKey = getUtcOffsetKey(refDate, tz);
    if (!offsetToTimezones.has(offsetKey)) offsetToTimezones.set(offsetKey, []);
    offsetToTimezones.get(offsetKey).push(tz);
  }

  for (const race of races) {
    for (const sessionType of ["main", "sprint"]) {
      const deadlineUTC =
        sessionType === "sprint" ? race.qualiSprintUTC : race.qualiUTC;
      const cancelled =
        sessionType === "sprint" ? race.cancelledSprint : race.cancelledMain;

      if (!deadlineUTC || cancelled) continue;

      const deadlineMs = deadlineUTC.getTime();
      if (deadlineMs <= now.getTime() || deadlineMs > windowEnd.getTime()) continue;

      const sessionKey = sessionType === "sprint" ? "sprintQuali" : "quali";

      for (const [offsetKey, timezones] of offsetToTimezones) {
        // Check if the session is nighttime in this offset group
        // (use first timezone as representative — same offset = same hour)
        if (!isNightTime(deadlineUTC, timezones[0])) continue;

        // Collect tokens for all timezones in this offset group
        const tokens = [];
        for (const tz of timezones) {
          if (tzGroups.has(tz)) tokens.push(...tzGroups.get(tz));
        }
        if (tokens.length === 0) continue;

        const docId = `${year}_${race.id}_${sessionKey}_evening_${offsetKey}`;
        if (await isAlreadySent(docId)) continue;

        // Build notification with timezone-local formatting
        const { title, body } = buildNotification(
          sessionType, "evening", deadlineUTC, race.name, timezones[0]
        );
        await sendToTokens(tokens, title, body, docId);
        await markAsSent(docId, {
          raceId: race.id, raceName: race.name,
          type: sessionType === "sprint" ? "sprintQualifying" : "qualifying",
          interval: "evening",
        });
      }
    }
  }
}

/**
 * Calcola la scadenza del campionato (metà stagione) lato server.
 * Usa una query count + mirata per evitare di leggere tutti i documenti.
 * La scadenza corrisponde all'orario di inizio della gara di metà stagione.
 *
 * @returns {Promise<Date|null>}
 */
async function getChampionshipDeadlineUTC() {
  try {
    // Count total races without reading documents (free operation)
    const countSnap = await db.collection("races").count().get();
    const totalRaces = countSnap.data().count;

    if (totalRaces === 0) return new Date("2025-09-07T23:59:00Z");

    const midRound = Math.ceil(totalRaces / 2);

    // Read only the mid-season race (1 read instead of all)
    const midSnap = await db
      .collection("races")
      .where("round", "==", midRound)
      .limit(1)
      .get();

    if (!midSnap.empty) {
      const midRace = midSnap.docs[0].data();
      if (midRace.raceUTC) return midRace.raceUTC.toDate();
    }

    return new Date("2025-09-07T23:59:00Z");
  } catch (err) {
    console.error("Errore nel calcolo della scadenza campionato:", err);
    return null;
  }
}

/**
 * Controlla se la scadenza per la submission delle classifiche piloti e costruttori
 * di metà stagione cade nelle prossime 24 ore e invia una notifica serale di promemoria.
 * Viene chiamata insieme a checkAndNotifyEvening per non aggiungere nuove Cloud Function.
 * Timezone-aware: sends per-offset-group with localized time.
 *
 * @param {string[]} targetTimezones  Timezones where local hour is 21
 * @param {Map<string, string[]>} tzGroups  Users grouped by timezone
 */
async function checkAndNotifyChampionshipEvening(targetTimezones, tzGroups) {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const deadlineUTC = await getChampionshipDeadlineUTC();
  if (!deadlineUTC) return;

  const deadlineMs = deadlineUTC.getTime();
  if (deadlineMs <= now.getTime() || deadlineMs > windowEnd.getTime()) return;

  const year = getCurrentSeasonYear();

  // Group target timezones by UTC offset
  const offsetToTimezones = new Map();
  for (const tz of targetTimezones) {
    const offsetKey = getUtcOffsetKey(now, tz);
    if (!offsetToTimezones.has(offsetKey)) offsetToTimezones.set(offsetKey, []);
    offsetToTimezones.get(offsetKey).push(tz);
  }

  for (const [offsetKey, timezones] of offsetToTimezones) {
    const docId = `${year}_championship_evening_${offsetKey}`;
    if (await isAlreadySent(docId)) continue;

    // Collect tokens for this offset group
    const tokens = [];
    for (const tz of timezones) {
      if (tzGroups.has(tz)) tokens.push(...tzGroups.get(tz));
    }
    if (tokens.length === 0) continue;

    const representativeTz = timezones[0];
    const time = formatTime(deadlineUTC, representativeTz);
    const date = formatDate(deadlineUTC, representativeTz);
    const abbr = getTzAbbr(deadlineUTC, representativeTz);
    const title = "Classifica Campionato";
    const body = `Formazione Campionato — schiera piloti e costruttori entro le ${time} del ${date} ${abbr}.`;

    await sendToTokens(tokens, title, body, docId);
    await markAsSent(docId, {
      type: "championship",
      interval: "evening",
      deadlineUTC: deadlineUTC,
    });
  }
}

// ─── Scheduled Cloud Functions ───────────────────────────────────────────────

/**
 * Runs every 10 minutes.
 * Sends a "1 ora prima" reminder for sessions that are DAYTIME in the user's timezone.
 * Nighttime users (local hour < 9) are skipped — they get the evening notification.
 */
exports.sendQualiReminder1h = onSchedule(
  {
    schedule: "every 10 minutes",
    timeZone: TIMEZONE,
    region: "europe-west1",
  },
  async () => {
    try {
      console.log("Controllo sessioni in scadenza tra ~1 ora (per-timezone)...");
      await checkAndNotifySession("main",   60, CHECK_INTERVAL_1H_MS, "1h", true);
      await checkAndNotifySession("sprint", 60, CHECK_INTERVAL_1H_MS, "1h", true);
    } catch (err) {
      console.error("Errore sendQualiReminder1h:", err);
    }
  }
);

/**
 * Runs every minute.
 * Sends a "5 minuti prima" reminder for ALL sessions, regardless of time of day.
 */
exports.sendQualiReminder5min = onSchedule(
  {
    schedule: "every 1 minutes",
    timeZone: TIMEZONE,
    region: "europe-west1",
  },
  async () => {
    try {
      console.log("Controllo sessioni in scadenza tra ~5 minuti...");
      await checkAndNotifySession("main",   5, CHECK_INTERVAL_5MIN_MS, "5min", false);
      await checkAndNotifySession("sprint", 5, CHECK_INTERVAL_5MIN_MS, "5min", false);
    } catch (err) {
      console.error("Errore sendQualiReminder5min:", err);
    }
  }
);

/**
 * Runs every hour (was daily at 21:00 CET).
 * Short-circuits immediately if no supported timezone has local hour 21.
 * When a timezone group has hour 21, sends evening notifications to users in that
 * timezone for any nighttime session (local hour < 9) in the next ~12 hours.
 * Also sends championship deadline reminders.
 */
exports.sendQualiReminderEvening = onSchedule(
  {
    schedule: "0 * * * *",
    timeZone: TIMEZONE,
    region: "europe-west1",
  },
  async () => {
    try {
      const targetTimezones = getTimezonesAtHour(21);
      if (targetTimezones.length === 0) {
        console.log("Nessun fuso orario alle 21:00, skip");
        return;
      }
      console.log(`Fusi orari alle 21:00: ${targetTimezones.join(", ")}`);

      // Single Firestore read for user timezone groups (reused by both functions)
      const tzGroups = await getUsersGroupedByTimezone();

      await checkAndNotifyEvening(targetTimezones, tzGroups);
      await checkAndNotifyChampionshipEvening(targetTimezones, tzGroups);
    } catch (err) {
      console.error("Errore sendQualiReminderEvening:", err);
    }
  }
);

