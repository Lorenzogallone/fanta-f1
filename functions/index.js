/**
 * @file Cloud Functions for Firebase - Enhanced with Cost Protection
 * @description Scheduled functions to send race reminder notifications
 * @version 2.0.0 - Added quali/sprint support + cost protection
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

// ========================================
// SAFETY LIMITS - PREVENT UNEXPECTED COSTS
// ========================================
const SAFETY_LIMITS = {
  MAX_TOKENS_PER_NOTIFICATION: 1000,    // Hard limit on recipients
  MAX_NOTIFICATIONS_PER_RUN: 10,         // Max events to process per execution
  MAX_FIRESTORE_READS_PER_RUN: 100,      // Prevent query explosion
  RATE_LIMIT_WINDOW_MS: 60000,           // 1 minute for rate limiting
  MAX_TEST_CALLS_PER_MINUTE: 3,          // Limit test endpoint calls
};

// In-memory rate limiting (resets on cold start)
const rateLimitCache = new Map();

/**
 * Check if request is rate limited
 */
function isRateLimited(key, maxCalls, windowMs) {
  const now = Date.now();
  const record = rateLimitCache.get(key) || { count: 0, resetTime: now + windowMs };

  if (now > record.resetTime) {
    // Reset window
    rateLimitCache.set(key, { count: 1, resetTime: now + windowMs });
    return false;
  }

  if (record.count >= maxCalls) {
    return true;
  }

  record.count++;
  rateLimitCache.set(key, record);
  return false;
}

/**
 * Helper: Send notifications for a specific event type
 */
async function sendEventNotification(
  raceDoc,
  race,
  eventType,
  eventTime,
  tokensSnapshot
) {
  const eventTimeDate = eventTime.toDate();
  const notificationId = `${raceDoc.id}_${eventType}_30min`;

  console.log(`Processing ${eventType}: ${race.name} at ${eventTimeDate.toISOString()}`);

  // Check if notification already sent
  const notifDoc = await admin
    .firestore()
    .collection('sentNotifications')
    .doc(notificationId)
    .get();

  if (notifDoc.exists) {
    console.log(`✓ Notification already sent for ${eventType} ${race.name}`);
    return null;
  }

  // Get tokens with SAFETY LIMIT
  const tokens = tokensSnapshot.docs
    .slice(0, SAFETY_LIMITS.MAX_TOKENS_PER_NOTIFICATION)
    .map(doc => doc.data().token);

  if (tokens.length === 0) {
    console.log('⚠️ No valid tokens to send to');
    return null;
  }

  if (tokensSnapshot.size > SAFETY_LIMITS.MAX_TOKENS_PER_NOTIFICATION) {
    console.warn(
      `⚠️ Token limit exceeded! Found ${tokensSnapshot.size} tokens, ` +
      `sending to first ${SAFETY_LIMITS.MAX_TOKENS_PER_NOTIFICATION} only`
    );
  }

  // Prepare event-specific message
  let eventEmoji, eventName, eventBody;
  switch (eventType) {
    case 'quali':
      eventEmoji = '⏱️';
      eventName = 'Qualifying';
      eventBody = `${race.name} Qualifying starts in 30 minutes! Get ready!`;
      break;
    case 'qualiSprint':
      eventEmoji = '🏃';
      eventName = 'Sprint Qualifying';
      eventBody = `${race.name} Sprint Qualifying starts in 30 minutes! Get ready!`;
      break;
    case 'race':
      eventEmoji = '🏁';
      eventName = 'Race';
      eventBody = `${race.name} starts in 30 minutes! Submit your lineup now!`;
      break;
    default:
      eventEmoji = '🏎️';
      eventName = 'Event';
      eventBody = `${race.name} ${eventType} starts in 30 minutes!`;
  }

  const payload = {
    notification: {
      title: `${eventEmoji} ${eventName} Starting Soon!`,
      body: eventBody,
      icon: '/FantaF1_Logo_big.png',
    },
    data: {
      raceId: raceDoc.id,
      raceName: race.name,
      eventType: eventType,
      eventTime: eventTimeDate.toISOString(),
      type: 'event-reminder',
      url: '/lineup',
    },
  };

  console.log(`📤 Sending notification to ${tokens.length} device(s)`);

  try {
    // Send multicast message
    const response = await admin.messaging().sendEachForMulticast({
      tokens,
      ...payload,
      webpush: {
        fcmOptions: {
          link: process.env.APP_URL || 'https://fanta-f1-rho.vercel.app/lineup',
        },
      },
    });

    console.log(`✓ Successfully sent ${response.successCount} messages`);
    if (response.failureCount > 0) {
      console.log(`✗ Failed to send ${response.failureCount} messages`);
    }

    // Clean up invalid tokens
    const tokensToDelete = [];
    response.responses.forEach((resp, idx) => {
      if (!resp.success) {
        console.error(`Error sending to token ${idx}:`, resp.error?.code || resp.error);

        // Remove invalid tokens
        if (
          resp.error?.code === 'messaging/invalid-registration-token' ||
          resp.error?.code === 'messaging/registration-token-not-registered'
        ) {
          tokensToDelete.push(tokensSnapshot.docs[idx].ref);
        }
      }
    });

    // Delete invalid tokens (with limit)
    if (tokensToDelete.length > 0) {
      const toDelete = tokensToDelete.slice(0, 50); // Max 50 deletes per run
      console.log(`🗑️ Deleting ${toDelete.length} invalid token(s)`);
      await Promise.all(toDelete.map(ref => ref.delete()));
    }

    // Mark notification as sent
    await admin
      .firestore()
      .collection('sentNotifications')
      .doc(notificationId)
      .set({
        raceId: raceDoc.id,
        raceName: race.name,
        eventType: eventType,
        eventTime: admin.firestore.Timestamp.fromDate(eventTimeDate),
        sentAt: admin.firestore.Timestamp.now(),
        recipientCount: tokens.length,
        successCount: response.successCount,
        failureCount: response.failureCount,
      });

    return response;

  } catch (error) {
    console.error(`❌ Error sending ${eventType} notification:`, error);
    throw error;
  }
}

/**
 * Main scheduled function to check for upcoming events
 * Runs every 15 minutes to check for qualifying/sprint/races starting in 30 minutes
 *
 * Cloud Scheduler cron: "*/15 * * * *" (every 15 minutes)
 */
exports.checkUpcomingEvents = functions
  .runWith({
    timeoutSeconds: 120,
    memory: '256MB',
  })
  .region('europe-west1')
  .pubsub.schedule('every 15 minutes')
  .timeZone('Europe/Rome')
  .onRun(async (context) => {
    console.log('🚀 Running checkUpcomingEvents function...');

    const startTime = Date.now();

    try {
      const now = admin.firestore.Timestamp.now();
      const in30Minutes = new Date(now.toDate().getTime() + 30 * 60 * 1000);
      const in45Minutes = new Date(now.toDate().getTime() + 45 * 60 * 1000);

      console.log(`⏰ Checking for events between ${in30Minutes.toISOString()} and ${in45Minutes.toISOString()}`);

      // Get races in the time window (with SAFETY LIMIT)
      const racesSnapshot = await admin
        .firestore()
        .collection('races')
        .limit(SAFETY_LIMITS.MAX_NOTIFICATIONS_PER_RUN)
        .get();

      if (racesSnapshot.empty) {
        console.log('ℹ️ No races found in database');
        return null;
      }

      console.log(`📋 Found ${racesSnapshot.size} total race(s) in database`);

      // Filter races with events in our time window
      const eventsToNotify = [];

      racesSnapshot.forEach((raceDoc) => {
        const race = raceDoc.data();

        // Check each event type
        const events = [
          { type: 'quali', time: race.qualiUTC },
          { type: 'qualiSprint', time: race.qualiSprintUTC },
          { type: 'race', time: race.raceUTC },
        ];

        events.forEach(event => {
          if (event.time) {
            const eventDate = event.time.toDate();
            if (eventDate >= in30Minutes && eventDate <= in45Minutes) {
              eventsToNotify.push({
                raceDoc,
                race,
                eventType: event.type,
                eventTime: event.time,
              });
            }
          }
        });
      });

      if (eventsToNotify.length === 0) {
        console.log('✓ No events starting in the next 30-45 minutes');
        return null;
      }

      console.log(`🔔 Found ${eventsToNotify.length} event(s) requiring notification`);
      eventsToNotify.forEach(evt => {
        console.log(`  - ${evt.eventType}: ${evt.race.name} at ${evt.eventTime.toDate().toISOString()}`);
      });

      // Get all notification tokens (with SAFETY LIMIT)
      const tokensSnapshot = await admin
        .firestore()
        .collection('notificationTokens')
        .limit(SAFETY_LIMITS.MAX_TOKENS_PER_NOTIFICATION)
        .get();

      if (tokensSnapshot.empty) {
        console.log('ℹ️ No users registered for notifications');
        return null;
      }

      console.log(`👥 Found ${tokensSnapshot.size} notification token(s)`);

      // Send notifications for each event
      const promises = eventsToNotify.map(evt =>
        sendEventNotification(
          evt.raceDoc,
          evt.race,
          evt.eventType,
          evt.eventTime,
          tokensSnapshot
        )
      );

      await Promise.all(promises);

      const duration = Date.now() - startTime;
      console.log(`✅ checkUpcomingEvents completed in ${duration}ms`);

      return null;

    } catch (error) {
      console.error('❌ Error in checkUpcomingEvents:', error);
      // Don't throw - prevents retries that could cause costs
      return null;
    }
  });

/**
 * Cleanup old sent notifications (run daily)
 * Keeps only last 30 days of notification history
 */
exports.cleanupOldNotifications = functions
  .runWith({
    timeoutSeconds: 300,
    memory: '256MB',
  })
  .region('europe-west1')
  .pubsub.schedule('every 24 hours')
  .timeZone('Europe/Rome')
  .onRun(async (context) => {
    console.log('🧹 Running cleanupOldNotifications...');

    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const oldNotifications = await admin
        .firestore()
        .collection('sentNotifications')
        .where('sentAt', '<', admin.firestore.Timestamp.fromDate(thirtyDaysAgo))
        .limit(SAFETY_LIMITS.MAX_FIRESTORE_READS_PER_RUN)
        .get();

      if (oldNotifications.empty) {
        console.log('✓ No old notifications to delete');
        return null;
      }

      console.log(`🗑️ Deleting ${oldNotifications.size} old notification(s)`);

      // Batch delete (max 500 operations per batch)
      const batch = admin.firestore().batch();
      oldNotifications.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      console.log('✅ Cleanup completed successfully');
      return null;

    } catch (error) {
      console.error('❌ Error in cleanupOldNotifications:', error);
      return null;
    }
  });

/**
 * HTTP function to test notifications (RATE LIMITED)
 * Call: POST https://europe-west1-{project-id}.cloudfunctions.net/testNotification
 *
 * SECURITY: Rate limited to 3 calls per minute to prevent abuse
 */
exports.testNotification = functions
  .runWith({
    timeoutSeconds: 60,
    memory: '256MB',
  })
  .region('europe-west1')
  .https.onRequest(async (req, res) => {
    // CORS headers
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST');

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method Not Allowed - Use POST' });
      return;
    }

    // Rate limiting
    const clientIp = req.ip || 'unknown';
    if (isRateLimited(
      `test_${clientIp}`,
      SAFETY_LIMITS.MAX_TEST_CALLS_PER_MINUTE,
      SAFETY_LIMITS.RATE_LIMIT_WINDOW_MS
    )) {
      console.warn(`⚠️ Rate limit exceeded for IP: ${clientIp}`);
      res.status(429).json({
        error: 'Rate limit exceeded. Max 3 calls per minute.',
        retryAfter: 60
      });
      return;
    }

    console.log(`🧪 Test notification requested from IP: ${clientIp}`);

    try {
      // Get tokens (with SAFETY LIMIT)
      const tokensSnapshot = await admin
        .firestore()
        .collection('notificationTokens')
        .limit(SAFETY_LIMITS.MAX_TOKENS_PER_NOTIFICATION)
        .get();

      if (tokensSnapshot.empty) {
        res.status(404).json({ error: 'No tokens registered' });
        return;
      }

      const tokens = tokensSnapshot.docs.map(doc => doc.data().token);

      const payload = {
        notification: {
          title: '🧪 Test Notification',
          body: 'This is a test notification from FantaF1! Your notifications are working correctly.',
          icon: '/FantaF1_Logo_big.png',
        },
        data: {
          type: 'test',
          timestamp: new Date().toISOString(),
        },
      };

      const response = await admin.messaging().sendEachForMulticast({
        tokens,
        ...payload,
      });

      console.log(`✓ Test sent: ${response.successCount} success, ${response.failureCount} failed`);

      res.json({
        success: true,
        message: 'Test notification sent',
        totalTokens: tokens.length,
        successCount: response.successCount,
        failureCount: response.failureCount,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      console.error('❌ Error sending test notification:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  });

/**
 * HTTP function to get notification statistics (for monitoring)
 */
exports.getNotificationStats = functions
  .runWith({
    timeoutSeconds: 30,
    memory: '256MB',
  })
  .region('europe-west1')
  .https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    try {
      const [tokensSnapshot, notificationsSnapshot] = await Promise.all([
        admin.firestore().collection('notificationTokens').count().get(),
        admin.firestore().collection('sentNotifications').count().get(),
      ]);

      // Get last 10 notifications
      const recentNotifications = await admin
        .firestore()
        .collection('sentNotifications')
        .orderBy('sentAt', 'desc')
        .limit(10)
        .get();

      const recent = recentNotifications.docs.map(doc => {
        const data = doc.data();
        return {
          eventType: data.eventType,
          raceName: data.raceName,
          sentAt: data.sentAt.toDate().toISOString(),
          recipients: data.recipientCount,
          success: data.successCount,
        };
      });

      res.json({
        totalTokens: tokensSnapshot.data().count,
        totalNotificationsSent: notificationsSnapshot.data().count,
        recentNotifications: recent,
        safetyLimits: SAFETY_LIMITS,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      console.error('Error getting stats:', error);
      res.status(500).json({ error: error.message });
    }
  });
