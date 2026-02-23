/**
 * @file notificationService.js
 * @description Push notification service for qualifying reminders.
 * Handles FCM token management, permission requests, and PWA detection.
 */

import { doc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { db, getMessagingInstance } from "./firebase";
import { warn, error as logError } from "../utils/logger";

/** VAPID public key for Web Push (set in .env) */
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

/**
 * Checks if the app is running as an installed PWA (standalone mode).
 * @returns {boolean} True if running in standalone/PWA mode
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
 * @returns {boolean} True if Push API and Service Workers are supported
 */
export function isNotificationSupported() {
  return "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
}

/**
 * Returns the current notification permission state.
 * @returns {"granted"|"denied"|"default"|"unsupported"} Permission state
 */
export function getNotificationPermission() {
  if (!isNotificationSupported()) return "unsupported";
  return Notification.permission;
}

/**
 * Requests notification permission from the browser and retrieves an FCM token.
 * Saves the token to the user's Firestore document.
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

    // Request browser permission
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return { success: false, error: "permission_denied" };
    }

    // Get FCM token
    const messaging = await getMessagingInstance();
    const { getToken } = await import("firebase/messaging");

    // Wait for the FCM service worker to be ready
    const registration = await navigator.serviceWorker.getRegistration("/firebase-messaging-sw.js");

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration || undefined,
    });

    if (!token) {
      return { success: false, error: "no_token" };
    }

    // Save token to Firestore user document
    await saveFcmToken(userId, token);

    // Store in localStorage for quick checks
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
 * Uses arrayUnion to avoid duplicates.
 * @param {string} userId - Firebase Auth UID
 * @param {string} token - FCM device token
 */
async function saveFcmToken(userId, token) {
  const userRef = doc(db, "users", userId);
  await updateDoc(userRef, {
    fcmTokens: arrayUnion(token),
  });
}

/**
 * Disables notifications: removes the FCM token from Firestore and clears local state.
 * @param {string} userId - Firebase Auth UID
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
 * Should be called once when the app loads (only if notifications are enabled).
 */
export async function setupForegroundListener() {
  try {
    if (!isNotificationsEnabled()) return;

    const messaging = await getMessagingInstance();
    const { onMessage } = await import("firebase/messaging");

    onMessage(messaging, (payload) => {
      // Show a browser notification even when the app is in the foreground
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
