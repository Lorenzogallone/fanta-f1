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

import { doc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { db, app } from "./firebase";
import { warn, error as logError } from "../utils/logger";

/** VAPID public key for Web Push (set in .env) */
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

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
 * Sends the Firebase config to the active service worker so it can
 * initialise Firebase Messaging for background push handling.
 * @param {ServiceWorkerRegistration} [reg]
 */
async function sendConfigToServiceWorker(reg) {
  if (!reg) reg = await waitForServiceWorker(5000);
  if (!reg?.active) return;

  const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
  };

  reg.active.postMessage({
    type: "FIREBASE_CONFIG",
    config: firebaseConfig,
  });
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

    await sendConfigToServiceWorker(registration);

    const { getMessaging, getToken } = await import("firebase/messaging");
    const messaging = getMessaging(app);

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    if (!token) {
      return { success: false, error: "no_token" };
    }

    // Save token to Firestore
    await saveFcmToken(userId, token);

    // Store locally for quick state checks
    localStorage.setItem("fanta-f1-fcm-token", token);
    localStorage.setItem("fanta-f1-notifications-enabled", "true");

    return { success: true, token };
  } catch (err) {
    logError("Failed to request notification permission:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Saves an FCM token to the user's Firestore document.
 * @param {string} userId
 * @param {string} token
 */
async function saveFcmToken(userId, token) {
  const userRef = doc(db, "users", userId);
  await updateDoc(userRef, {
    fcmTokens: arrayUnion(token),
  });
}

/**
 * Disables notifications: removes the FCM token from Firestore and clears local state.
 * @param {string} userId
 * @returns {Promise<{success: boolean}>}
 */
export async function disableNotifications(userId) {
  try {
    const token = localStorage.getItem("fanta-f1-fcm-token");

    if (token && userId) {
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, {
        fcmTokens: arrayRemove(token),
      });
    }

    localStorage.removeItem("fanta-f1-fcm-token");
    localStorage.removeItem("fanta-f1-notifications-enabled");

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
    localStorage.getItem("fanta-f1-notifications-enabled") === "true" &&
    getNotificationPermission() === "granted"
  );
}

/**
 * Sets up foreground message listener to show in-app notifications.
 * Also sends Firebase config to the SW for background push handling.
 */
export async function setupForegroundListener() {
  try {
    // Always send config to SW so background push works
    await sendConfigToServiceWorker();

    if (!isNotificationsEnabled()) return;

    const { getMessaging, onMessage } = await import("firebase/messaging");
    const messaging = getMessaging(app);

    onMessage(messaging, (payload) => {
      if (payload.notification) {
        const { title, body } = payload.notification;
        new Notification(title, {
          body,
          icon: "/FantaF1_Logo_big.png",
          badge: "/FantaF1_Logo_big.png",
        });
      }
    });
  } catch (err) {
    warn("Failed to set up foreground listener:", err);
  }
}
