/**
 * @file Cloud Functions for FantaF1 Push Notifications
 * @description Scheduled functions that send qualifying reminders.
 *
 * Notification schedule per session type (Main Race and Sprint treated separately):
 *   - Daytime session  (CET >= 07:00): 1 ora prima + 5 minuti prima
 *   - Nighttime session (CET < 07:00): sera precedente alle 21:00 + 5 minuti prima
 *
 * All notification text is in Italian, professional tone, no emoji.
 */
/* eslint-env node */

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();
const db = getFirestore();

// ─── Configuration ───────────────────────────────────────────────────────────

/** How often the 1h check runs (every 10 minutes) */
const CHECK_INTERVAL_1H_MS = 10 * 60 * 1000;

/** How often the 5min check runs (every 1 minute) */
const CHECK_INTERVAL_5MIN_MS = 1 * 60 * 1000;

/** Timezone used for CET night-time detection */
const TIMEZONE = "Europe/Rome";

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * Returns the CET hour (0–23) for a given UTC Date object.
 * @param {Date} dateUTC
 * @returns {number}
 */
function getCETHour(dateUTC) {
  const cetStr = dateUTC.toLocaleString("en-US", {
    timeZone: TIMEZONE,
    hour: "numeric",
    hour12: false,
  });
  return parseInt(cetStr, 10);
}

/**
 * Returns true when the session falls in the "nighttime" band (CET hour < 7).
 * @param {Date} dateUTC
 * @returns {boolean}
 */
function isNightTimeCET(dateUTC) {
  return getCETHour(dateUTC) < 7;
}

/**
 * Formats a UTC Date as a CET time string (HH:MM) for use in notification bodies.
 * @param {Date} dateUTC
 * @returns {string}  e.g. "02:00"
 */
function formatTimeCET(dateUTC) {
  return dateUTC.toLocaleString("it-IT", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/**
 * Formats a UTC Date as a CET date+time string for use in notification bodies.
 * @param {Date} dateUTC
 * @returns {string}  e.g. "domenica 6 aprile alle 02:00"
 */
function formatDateTimeCET(dateUTC) {
  const datePart = dateUTC.toLocaleString("it-IT", {
    timeZone: TIMEZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const timePart = formatTimeCET(dateUTC);
  return `${datePart} alle ${timePart}`;
}

/**
 * Reads all races from Firestore.
 * @returns {Promise<Array>}
 */
async function getAllRaces() {
  const snapshot = await db.collection("races").get();
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
 * Checks if a notification has already been sent (deduplication).
 * @param {string} docId
 * @returns {Promise<boolean>}
 */
async function isAlreadySent(docId) {
  const docRef = db.collection("notificationsSent").doc(docId);
  const doc = await docRef.get();
  return doc.exists;
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
 * Sends a push notification to all registered devices.
 * @param {string} title
 * @param {string} body
 * @param {string} tag
 * @returns {Promise<{successCount: number, failureCount: number}>}
 */
async function sendToAll(title, body, tag) {
  const tokens = await getAllFcmTokens();

  if (tokens.length === 0) {
    console.log("Nessun token FCM trovato, invio saltato");
    return { successCount: 0, failureCount: 0 };
  }

  console.log(`Invio "${title}" a ${tokens.length} dispositivo/i`);

  const message = {
    notification: { title, body },
    data: { tag, url: "/lineup" },
    webpush: {
      notification: {
        icon: "/FantaF1_Logo_big.png",
        badge: "/FantaF1_Logo_big.png",
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

// ─── Notification Body Builders ───────────────────────────────────────────────

/**
 * Builds the Italian notification title and body for a given session/interval.
 *
 * @param {"main"|"sprint"} sessionType
 * @param {"1h"|"5min"|"evening"} interval
 * @param {Date}   deadlineUTC  Qualifying deadline (UTC)
 * @param {string} raceName
 * @returns {{ title: string, body: string }}
 */
function buildNotification(sessionType, interval, deadlineUTC, raceName) {
  const sessionLabel =
    sessionType === "sprint" ? "Sprint" : "Gara Principale";
  const deadlineTime = formatTimeCET(deadlineUTC);
  const deadlineDateTime = formatDateTimeCET(deadlineUTC);

  let body;
  if (interval === "evening") {
    body =
      `La scadenza per schierare la formazione per la ${sessionLabel} del Gran Premio ` +
      `${raceName} e' fissata per ${deadlineDateTime} CET. ` +
      `Si ricorda di inviare la propria formazione prima di tale orario.`;
  } else if (interval === "1h") {
    body =
      `La scadenza per schierare la formazione per la ${sessionLabel} del Gran Premio ` +
      `${raceName} e' alle ore ${deadlineTime} CET. Tempo residuo: circa 1 ora.`;
  } else {
    body =
      `La scadenza per schierare la formazione per la ${sessionLabel} del Gran Premio ` +
      `${raceName} e' alle ore ${deadlineTime} CET. Tempo residuo: circa 5 minuti.`;
  }

  return {
    title: `FantaF1 - ${raceName}`,
    body,
  };
}

// ─── Core Check Logic ─────────────────────────────────────────────────────────

/**
 * Checks all sessions of a given type for an upcoming deadline within a time window
 * and sends notifications where needed.
 *
 * @param {"main"|"sprint"} sessionType
 * @param {number}  minutesBefore  Minutes before deadline to trigger
 * @param {number}  windowMs       Width of the detection window (matches schedule interval)
 * @param {string}  intervalLabel  Dedup suffix: "1h" | "5min"
 * @param {boolean} skipNight      If true, skip nighttime sessions (CET hour < 7)
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

  const races = await getAllRaces();

  for (const race of races) {
    const deadlineUTC =
      sessionType === "sprint" ? race.qualiSprintUTC : race.qualiUTC;
    const cancelled =
      sessionType === "sprint" ? race.cancelledSprint : race.cancelledMain;

    if (!deadlineUTC || cancelled) continue;

    if (skipNight && isNightTimeCET(deadlineUTC)) continue;

    const deadlineMs = deadlineUTC.getTime();
    if (deadlineMs >= targetTime.getTime() && deadlineMs < targetEnd.getTime()) {
      const sessionKey = sessionType === "sprint" ? "sprintQuali" : "quali";
      const docId = `${race.id}_${sessionKey}_${intervalLabel}`;
      if (!(await isAlreadySent(docId))) {
        const { title, body } = buildNotification(
          sessionType,
          intervalLabel,
          deadlineUTC,
          race.name
        );
        await sendToAll(title, body, docId);
        await markAsSent(docId, {
          raceId: race.id,
          raceName: race.name,
          type: sessionType === "sprint" ? "sprintQualifying" : "qualifying",
          interval: intervalLabel,
        });
      }
    }
  }
}

/**
 * Checks for nighttime sessions (CET < 07:00) whose deadline falls within
 * the next ~10 hours and sends the advance evening notification.
 * Intended to run once daily at 21:00 CET.
 */
async function checkAndNotifyEvening() {
  const now = new Date();
  // Window: from now up to 10 hours ahead (21:00 CET -> 07:00 CET next day)
  const windowEnd = new Date(now.getTime() + 10 * 60 * 60 * 1000);

  const races = await getAllRaces();

  for (const race of races) {
    for (const sessionType of ["main", "sprint"]) {
      const deadlineUTC =
        sessionType === "sprint" ? race.qualiSprintUTC : race.qualiUTC;
      const cancelled =
        sessionType === "sprint" ? race.cancelledSprint : race.cancelledMain;

      if (!deadlineUTC || cancelled) continue;

      // Only nighttime sessions
      if (!isNightTimeCET(deadlineUTC)) continue;

      const deadlineMs = deadlineUTC.getTime();
      if (deadlineMs > now.getTime() && deadlineMs <= windowEnd.getTime()) {
        const sessionKey = sessionType === "sprint" ? "sprintQuali" : "quali";
        const docId = `${race.id}_${sessionKey}_evening`;
        if (!(await isAlreadySent(docId))) {
          const { title, body } = buildNotification(
            sessionType,
            "evening",
            deadlineUTC,
            race.name
          );
          await sendToAll(title, body, docId);
          await markAsSent(docId, {
            raceId: race.id,
            raceName: race.name,
            type: sessionType === "sprint" ? "sprintQualifying" : "qualifying",
            interval: "evening",
          });
        }
      }
    }
  }
}

// ─── Scheduled Cloud Functions ───────────────────────────────────────────────

/**
 * Runs every 10 minutes.
 * Sends a "1 ora prima" reminder for DAYTIME sessions only (CET >= 07:00).
 * Nighttime sessions receive an advance notification at 21:00 CET the evening before.
 */
exports.sendQualiReminder1h = onSchedule(
  {
    schedule: "every 10 minutes",
    timeZone: TIMEZONE,
    region: "europe-west1",
  },
  async () => {
    console.log("Controllo sessioni diurne in scadenza tra ~1 ora...");
    await checkAndNotifySession("main",   60, CHECK_INTERVAL_1H_MS, "1h", true);
    await checkAndNotifySession("sprint", 60, CHECK_INTERVAL_1H_MS, "1h", true);
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
    console.log("Controllo sessioni in scadenza tra ~5 minuti...");
    await checkAndNotifySession("main",   5, CHECK_INTERVAL_5MIN_MS, "5min", false);
    await checkAndNotifySession("sprint", 5, CHECK_INTERVAL_5MIN_MS, "5min", false);
  }
);

/**
 * Runs every day at 21:00 CET.
 * Sends advance notifications for any nighttime qualifying session (CET < 07:00)
 * scheduled within the following ~10 hours.
 */
exports.sendQualiReminderEvening = onSchedule(
  {
    schedule: "0 21 * * *",
    timeZone: TIMEZONE,
    region: "europe-west1",
  },
  async () => {
    console.log("Controllo sessioni notturne per la notifica serale delle 21:00...");
    await checkAndNotifyEvening();
  }
);
