/**
 * @file Cloud Functions for Firebase
 * @description Scheduled functions to send race reminder notifications
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

/**
 * Scheduled function to check for upcoming races and send notifications
 * Runs every 15 minutes to check for races starting in 30 minutes
 *
 * Cloud Scheduler cron: "*/15 * * * *" (every 15 minutes)
 */
exports.checkUpcomingRaces = functions
  .region('europe-west1') // Use region closest to your users
  .pubsub.schedule('every 15 minutes')
  .timeZone('Europe/Rome') // Set your timezone
  .onRun(async (context) => {
    console.log('Running checkUpcomingRaces function...');

    try {
      const now = admin.firestore.Timestamp.now();
      const in30Minutes = new Date(now.toDate().getTime() + 30 * 60 * 1000);
      const in45Minutes = new Date(now.toDate().getTime() + 45 * 60 * 1000);

      // Get races starting between 30-45 minutes from now
      // (window of 15 minutes to account for function execution time)
      const racesSnapshot = await admin
        .firestore()
        .collection('races')
        .where('raceUTC', '>=', admin.firestore.Timestamp.fromDate(in30Minutes))
        .where('raceUTC', '<=', admin.firestore.Timestamp.fromDate(in45Minutes))
        .get();

      if (racesSnapshot.empty) {
        console.log('No races starting in the next 30-45 minutes');
        return null;
      }

      console.log(`Found ${racesSnapshot.size} race(s) starting soon`);

      // Get all notification tokens
      const tokensSnapshot = await admin
        .firestore()
        .collection('notificationTokens')
        .get();

      if (tokensSnapshot.empty) {
        console.log('No users registered for notifications');
        return null;
      }

      console.log(`Found ${tokensSnapshot.size} notification token(s)`);

      // For each race, send notifications
      const promises = [];

      racesSnapshot.forEach((raceDoc) => {
        const race = raceDoc.data();
        const raceTime = race.raceUTC.toDate();

        console.log(`Processing race: ${race.name} at ${raceTime.toISOString()}`);

        // Check if notification was already sent for this race
        const notificationId = `${raceDoc.id}_30min`;

        const sendNotification = admin
          .firestore()
          .collection('sentNotifications')
          .doc(notificationId)
          .get()
          .then(async (notifDoc) => {
            if (notifDoc.exists) {
              console.log(`Notification already sent for race ${race.name}`);
              return null;
            }

            // Prepare notification payload
            const payload = {
              notification: {
                title: '🏁 Race Starting Soon!',
                body: `${race.name} starts in 30 minutes! Submit your lineup now!`,
                icon: '/FantaF1_Logo_big.png',
              },
              data: {
                raceId: raceDoc.id,
                raceName: race.name,
                raceTime: raceTime.toISOString(),
                type: 'race-reminder',
                url: '/lineup',
              },
            };

            // Get all tokens
            const tokens = tokensSnapshot.docs.map(doc => doc.data().token);

            if (tokens.length === 0) {
              console.log('No valid tokens to send to');
              return null;
            }

            console.log(`Sending notification to ${tokens.length} device(s)`);

            // Send multicast message
            const response = await admin.messaging().sendEachForMulticast({
              tokens,
              ...payload,
              webpush: {
                fcmOptions: {
                  link: 'https://your-app-url.com/lineup', // TODO: Replace with your URL
                },
              },
            });

            console.log(`Successfully sent ${response.successCount} messages`);
            console.log(`Failed to send ${response.failureCount} messages`);

            // Clean up invalid tokens
            const tokensToDelete = [];
            response.responses.forEach((resp, idx) => {
              if (!resp.success) {
                console.error(`Error sending to token ${idx}:`, resp.error);

                // Remove invalid tokens
                if (
                  resp.error.code === 'messaging/invalid-registration-token' ||
                  resp.error.code === 'messaging/registration-token-not-registered'
                ) {
                  tokensToDelete.push(tokensSnapshot.docs[idx].ref);
                }
              }
            });

            // Delete invalid tokens
            if (tokensToDelete.length > 0) {
              console.log(`Deleting ${tokensToDelete.length} invalid token(s)`);
              await Promise.all(tokensToDelete.map(ref => ref.delete()));
            }

            // Mark notification as sent
            await admin
              .firestore()
              .collection('sentNotifications')
              .doc(notificationId)
              .set({
                raceId: raceDoc.id,
                raceName: race.name,
                raceTime: admin.firestore.Timestamp.fromDate(raceTime),
                sentAt: admin.firestore.Timestamp.now(),
                recipientCount: tokens.length,
                successCount: response.successCount,
                failureCount: response.failureCount,
              });

            return response;
          });

        promises.push(sendNotification);
      });

      await Promise.all(promises);
      console.log('checkUpcomingRaces completed successfully');
      return null;

    } catch (error) {
      console.error('Error in checkUpcomingRaces:', error);
      throw error;
    }
  });

/**
 * Cleanup old sent notifications (run daily)
 * Keeps only last 30 days of notification history
 */
exports.cleanupOldNotifications = functions
  .region('europe-west1')
  .pubsub.schedule('every 24 hours')
  .timeZone('Europe/Rome')
  .onRun(async (context) => {
    console.log('Running cleanupOldNotifications...');

    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const oldNotifications = await admin
        .firestore()
        .collection('sentNotifications')
        .where('sentAt', '<', admin.firestore.Timestamp.fromDate(thirtyDaysAgo))
        .get();

      if (oldNotifications.empty) {
        console.log('No old notifications to delete');
        return null;
      }

      console.log(`Deleting ${oldNotifications.size} old notification(s)`);

      const batch = admin.firestore().batch();
      oldNotifications.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      console.log('Cleanup completed successfully');
      return null;

    } catch (error) {
      console.error('Error in cleanupOldNotifications:', error);
      throw error;
    }
  });

/**
 * HTTP function to test notifications (for development)
 * Call: POST https://your-region-your-project.cloudfunctions.net/testNotification
 */
exports.testNotification = functions
  .region('europe-west1')
  .https.onRequest(async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    try {
      // Get all tokens
      const tokensSnapshot = await admin
        .firestore()
        .collection('notificationTokens')
        .get();

      if (tokensSnapshot.empty) {
        res.status(404).json({ error: 'No tokens registered' });
        return;
      }

      const tokens = tokensSnapshot.docs.map(doc => doc.data().token);

      const payload = {
        notification: {
          title: '🧪 Test Notification',
          body: 'This is a test notification from FantaF1!',
          icon: '/FantaF1_Logo_big.png',
        },
        data: {
          type: 'test',
        },
      };

      const response = await admin.messaging().sendEachForMulticast({
        tokens,
        ...payload,
      });

      res.json({
        success: true,
        totalTokens: tokens.length,
        successCount: response.successCount,
        failureCount: response.failureCount,
      });

    } catch (error) {
      console.error('Error sending test notification:', error);
      res.status(500).json({ error: error.message });
    }
  });
