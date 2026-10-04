/**
 * @file notificationService.js
 * @description Push notification service for qualifying reminders.
 * Handles FCM token management, permission requests, and PWA detection.
 *
 * iOS requirements:
 * - iOS 16.4+ required for Web Push
 * - Must be installed as PWA (standalone mode)
 * - Notification.requestPermission() must be called directly from a user gesture
 */

import { doc, updateDoc, arrayRemove, runTransaction } from "firebase/firestore";
import { db, app } from "./firebase";
import { warn, error as logError } from "../utils/logger";

/** VAPID public key for Web Push (set in .env) */
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

const TOKEN_KEY = "fanta-f1-fcm-token";
const ENABLED_KEY = "fanta-f1-notifications-enabled";
const LAST_SYNC_KEY = "fanta-f1-fcm-last-sync";
/** Account the stored token was saved for (several accounts can share a device) */
const TOKEN_USER_KEY = "fanta-f1-fcm-user";
/** Re-confirm the token in Firestore at most once per week (self-healing). */
const RESYNC_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Checks if the app is running as an installed PWA (standalone mode).
 * @returns {boolean}
 */
export function isPwaInstalled() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true ||
    document.referrer.includes("android-app://")
  );
}

/**
 * Checks if the browser supports push notifications.
 * @returns {boolean}
 */
export function isNotificationSupported() {
  return (
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

/**
 * Returns the current notification permission state.
 * @returns {"granted"|"denied"|"default"|"unsupported"}
 */
export function getNotificationPermission() {
  if (!isNotificationSupported()) return "unsupported";
  return Notification.permission;
}

/**
 * Waits for a service worker registration with a timeout.
 * Returns the registration or null if it times out.
 * @param {number} timeoutMs
 * @returns {Promise<ServiceWorkerRegistration|null>}
 */
function waitForServiceWorker(timeoutMs = 10000) {
  if (!("serviceWorker" in navigator)) return Promise.resolve(null);

  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ]);
}

/**
 * Retrieves the FCM token bound to the app's service worker registration.
 * Requires notification permission to be already granted.
 * @param {ServiceWorkerRegistration} registration
 * @returns {Promise<string|null>}
 */
async function fetchFcmToken(registration) {
  const { getMessaging, getToken } = await import("firebase/messaging");
  const messaging = getMessaging(app);
  const token = await getToken(messaging, {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: registration,
  });
  return token || null;
}

/**
 * Requests notification permission and retrieves an FCM token.
 *
 * IMPORTANT for iOS: This function splits the work into two phases:
 * 1. Synchronous permission request (must happen in user-gesture context)
 * 2. Async token retrieval (can happen after the gesture)
 *
 * @param {string} userId - Firebase Auth UID
 * @returns {Promise<{success: boolean, token?: string, error?: string}>}
 */
export async function requestNotificationPermission(userId) {
  try {
    if (!isNotificationSupported()) {
      return { success: false, error: "not_supported" };
    }

    if (!VAPID_KEY) {
      warn("VAPID key not configured. Set VITE_FIREBASE_VAPID_KEY in .env");
      return { success: false, error: "no_vapid_key" };
    }

    // PHASE 1: Request permission immediately (user-gesture context).
    // This MUST be the first async operation to preserve the user activation
    // on iOS Safari / WebKit.
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return { success: false, error: "permission_denied" };
    }

    // PHASE 2: Get FCM token (no longer needs user gesture).
    // Wait for SW with timeout — avoids hanging forever in dev mode or on first load.
    const registration = await waitForServiceWorker(10000);
    if (!registration) {
      return { success: false, error: "no_service_worker" };
    }

    const token = await fetchFcmToken(registration);
    if (!token) {
      return { success: false, error: "no_token" };
    }

    // Save token to Firestore, replacing this device's previous token (if any)
    // so the same device never ends up registered twice.
    await saveFcmToken(userId, token, localStorage.getItem(TOKEN_KEY));

    // Store locally for quick state checks
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(TOKEN_USER_KEY, userId);
    localStorage.setItem(ENABLED_KEY, "true");
    localStorage.setItem(LAST_SYNC_KEY, String(Date.now()));

    return { success: true, token };
  } catch (err) {
    logError("Failed to request notification permission:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Saves an FCM token to the user's Firestore document. If this device had a
 * different token before (token rotation, re-enable), the old one is removed
 * in the same transaction so the device receives each notification once.
 * @param {string} userId
 * @param {string} token
 * @param {string|null} [previousToken]
 */
async function saveFcmToken(userId, token, previousToken = null) {
  const userRef = doc(db, "users", userId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(userRef);
    const current = Array.isArray(snap.data()?.fcmTokens) ? snap.data().fcmTokens : [];
    const next = current.filter((t) => t !== previousToken && t !== token);
    next.push(token);
    const unchanged = next.length === current.length && next.every((t) => current.includes(t));
    if (!unchanged) tx.update(userRef, { fcmTokens: next });
  });
}

/**
 * Disables notifications: invalidates this device's FCM token, removes it from
 * Firestore and clears local state.
 * @param {string} userId
 * @returns {Promise<{success: boolean}>}
 */
export async function disableNotifications(userId) {
  try {
    const tokens = new Set([localStorage.getItem(TOKEN_KEY)]);

    // Invalidate this device's token on FCM too, so a stale copy (e.g. still
    // stored under another account) can no longer deliver to this device.
    // getToken first binds messaging to the app's SW registration (otherwise
    // deleteToken would try to register a default SW that doesn't exist).
    try {
      const registration = await waitForServiceWorker(5000);
      if (registration && getNotificationPermission() === "granted" && VAPID_KEY) {
        const current = await fetchFcmToken(registration);
        tokens.add(current);
        const { getMessaging, deleteToken } = await import("firebase/messaging");
        await deleteToken(getMessaging(app));
      }
    } catch (err) {
      warn("Failed to delete FCM token:", err);
    }

    tokens.delete(null);
    if (tokens.size > 0 && userId) {
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, {
        fcmTokens: arrayRemove(...tokens),
      });
    }

    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_USER_KEY);
    localStorage.removeItem(ENABLED_KEY);
    localStorage.removeItem(LAST_SYNC_KEY);

    return { success: true };
  } catch (err) {
    logError("Failed to disable notifications:", err);
    return { success: false };
  }
}

/**
 * Checks if notifications are currently enabled for this device.
 * @returns {boolean}
 */
export function isNotificationsEnabled() {
  return (
    localStorage.getItem(ENABLED_KEY) === "true" &&
    getNotificationPermission() === "granted"
  );
}

/**
 * Keeps this device's FCM token up to date for users who already enabled
 * notifications. FCM tokens can rotate: when that happens the new token
 * replaces the old one in Firestore, so the user keeps receiving notifications
 * without duplicates. Runs silently (no permission prompt).
 * @param {string} userId
 */
export async function syncFcmToken(userId) {
  try {
    if (!userId || !VAPID_KEY || !isNotificationsEnabled()) return;

    const registration = await waitForServiceWorker(10000);
    if (!registration) return;

    const token = await fetchFcmToken(registration);
    if (!token) return;

    const storedToken = localStorage.getItem(TOKEN_KEY);
    const sameUser = localStorage.getItem(TOKEN_USER_KEY) === userId;
    const lastSync = Number(localStorage.getItem(LAST_SYNC_KEY)) || 0;
    if (sameUser && token === storedToken && Date.now() - lastSync < RESYNC_INTERVAL_MS) return;

    // Another account on this device: register the token for it as well (the
    // previous token is only replaced within the same account)
    await saveFcmToken(userId, token, sameUser ? storedToken : null);
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(TOKEN_USER_KEY, userId);
    localStorage.setItem(LAST_SYNC_KEY, String(Date.now()));
  } catch (err) {
    warn("Failed to sync FCM token:", err);
  }
}
