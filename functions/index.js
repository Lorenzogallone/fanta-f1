/**
 * @file Cloud Functions for FantaF1 Push Notifications
 * @description Scheduled functions that send qualifying reminders
 * (1 hour before and 5 minutes before) for both normal and sprint qualifying sessions.
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
const CHECK_INTERVAL_1H_MS = 10 * 60 * 1000; // 10 min

/** How often the 5min check runs (every 1 minute) */
const CHECK_INTERVAL_5MIN_MS = 1 * 60 * 1000; // 1 min

/** Timezone for logging (notifications work in UTC regardless) */
const TIMEZONE = "Europe/Rome";

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * Reads all races from Firestore.
 * @returns {Promise<Array<{id: string, name: string, qualiUTC: Date|null, qualiSprintUTC: Date|null}>>}
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
 * @returns {Promise<string[]>} Array of FCM tokens
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
  return [...new Set(tokens)]; // Deduplicate
}

/**
 * Checks if a notification has already been sent (deduplication).
 * @param {string} docId - Unique ID for this notification (e.g., "race1_quali_1h")
 * @returns {Promise<boolean>} True if already sent
 */
async function isAlreadySent(docId) {
  const docRef = db.collection("notificationsSent").doc(docId);
  const doc = await docRef.get();
  return doc.exists;
}

/**
 * Marks a notification as sent.
 * @param {string} docId - Unique ID for this notification
 * @param {Object} metadata - Additional metadata to store
 */
async function markAsSent(docId, metadata) {
  await db.collection("notificationsSent").doc(docId).set({
    sentAt: new Date(),
    ...metadata,
  });
}

/**
 * Removes invalid FCM tokens from user documents.
 * Called after a send attempt when some tokens are invalid/expired.
 * @param {string[]} invalidTokens - Tokens that failed
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
    console.log(`Cleaned up invalid tokens from ${batchCount} user(s)`);
  }
}

/**
 * Sends a push notification to all registered devices.
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {string} tag - Unique tag for notification grouping
 * @returns {Promise<{successCount: number, failureCount: number}>}
 */
async function sendToAll(title, body, tag) {
  const tokens = await getAllFcmTokens();

  if (tokens.length === 0) {
    console.log("No FCM tokens found, skipping notification");
    return { successCount: 0, failureCount: 0 };
  }

  console.log(`Sending "${title}" to ${tokens.length} device(s)`);

  const message = {
    notification: {
      title,
      body,
    },
    data: {
      tag,
      url: "/lineup",
    },
    webpush: {
      notification: {
        icon: "/FantaF1_Logo_big.png",
        badge: "/FantaF1_Logo_big.png",
        vibrate: [100, 50, 200],
        tag,
      },
      fcmOptions: {
        link: "/lineup",
      },
    },
  };

  const messaging = getMessaging();
  const invalidTokens = [];
  let successCount = 0;
  let failureCount = 0;

  // Send to each token individually (sendEachForMulticast requires tokens array)
  const response = await messaging.sendEachForMulticast({
    ...message,
    tokens,
  });

  successCount = response.successCount;
  failureCount = response.failureCount;

  // Collect invalid tokens for cleanup
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

  // Cleanup invalid tokens
  await cleanupInvalidTokens(invalidTokens);

  console.log(`Sent: ${successCount} success, ${failureCount} failures`);
  return { successCount, failureCount };
}

/**
 * Checks for upcoming qualifying sessions and sends notifications.
 * @param {number} minutesBefore - Minutes before qualifying to check (60 or 5)
 * @param {number} windowMs - Time window to check (matches schedule interval)
 * @param {string} intervalLabel - Label for dedup ("1h" or "5min")
 * @param {string} reminderText - Text suffix for the notification body
 */
async function checkAndNotify(minutesBefore, windowMs, intervalLabel, reminderText) {
  const now = new Date();
  const targetTime = new Date(now.getTime() + minutesBefore * 60 * 1000);
  const targetEnd = new Date(targetTime.getTime() + windowMs);

  const races = await getAllRaces();

  for (const race of races) {
    // Check normal qualifying
    if (race.qualiUTC && !race.cancelledMain) {
      const qualiTime = race.qualiUTC.getTime();
      if (qualiTime >= targetTime.getTime() && qualiTime < targetEnd.getTime()) {
        const docId = `${race.id}_quali_${intervalLabel}`;
        if (!(await isAlreadySent(docId))) {
          await sendToAll(
            `🏁 ${race.name}`,
            `Qualifying ${reminderText}`,
            docId
          );
          await markAsSent(docId, {
            raceId: race.id,
            raceName: race.name,
            type: "qualifying",
            interval: intervalLabel,
          });
        }
      }
    }

    // Check sprint qualifying
    if (race.qualiSprintUTC && !race.cancelledSprint) {
      const sqTime = race.qualiSprintUTC.getTime();
      if (sqTime >= targetTime.getTime() && sqTime < targetEnd.getTime()) {
        const docId = `${race.id}_sprintQuali_${intervalLabel}`;
        if (!(await isAlreadySent(docId))) {
          await sendToAll(
            `🏁 ${race.name}`,
            `Sprint Qualifying ${reminderText}`,
            docId
          );
          await markAsSent(docId, {
            raceId: race.id,
            raceName: race.name,
            type: "sprintQualifying",
            interval: intervalLabel,
          });
        }
      }
    }
  }
}

// ─── Scheduled Cloud Functions ───────────────────────────────────────────────

/**
 * Runs every 10 minutes. Checks if any qualifying session starts
 * within the next 60-70 minutes and sends a "1 hour before" reminder.
 */
exports.sendQualiReminder1h = onSchedule(
  {
    schedule: "every 10 minutes",
    timeZone: TIMEZONE,
    region: "europe-west1",
  },
  async () => {
    console.log("⏰ Checking for qualifying sessions starting in ~1 hour...");
    await checkAndNotify(60, CHECK_INTERVAL_1H_MS, "1h", "starts in 1 hour! 🏎️");
  }
);

/**
 * Runs every minute. Checks if any qualifying session starts
 * within the next 5-6 minutes and sends a "5 minutes before" reminder.
 */
exports.sendQualiReminder5min = onSchedule(
  {
    schedule: "every 1 minutes",
    timeZone: TIMEZONE,
    region: "europe-west1",
  },
  async () => {
    console.log("⏰ Checking for qualifying sessions starting in ~5 minutes...");
    await checkAndNotify(5, CHECK_INTERVAL_5MIN_MS, "5min", "starts in 5 minutes! 🚦");
  }
);
