/**
 * @file sw.js
 * @description Custom service worker combining Workbox (PWA caching) and
 * Firebase Cloud Messaging (push notifications) in a single worker.
 *
 * VitePWA injectManifest will replace the __WB_MANIFEST placeholder with the
 * precache manifest at build time.
 */

import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import { clientsClaim } from "workbox-core";
import { registerRoute, NavigationRoute } from "workbox-routing";
import { createHandlerBoundToURL } from "workbox-precaching";

// ── Workbox PWA caching ──────────────────────────────────────────────
self.skipWaiting();
clientsClaim();

// Inject the Vite-generated precache manifest (replaced at build time)
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// SPA: route all navigation requests to index.html
registerRoute(new NavigationRoute(createHandlerBoundToURL("index.html")));

// ── Firebase Cloud Messaging ─────────────────────────────────────────
// We use the compat SDK because the modular SDK doesn't work in SW context
// with importScripts. These are loaded from the CDN.
importScripts(
  "https://www.gstatic.com/firebasejs/11.10.0/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging-compat.js"
);

// Firebase config is passed from the main thread via the query string of the
// SW registration URL or via a postMessage. We use a simple self.__FIREBASE_CONFIG
// variable that is set by either mechanism.
//
// Fallback: listen for a "FIREBASE_CONFIG" message from the main thread.
let firebaseConfigReady = null;
let resolveFirebaseConfig = null;

// Try to read config from the SW URL query string (?config=<base64>)
const swUrl = new URL(self.location.href);
const configParam = swUrl.searchParams.get("config");

if (configParam) {
  try {
    self.__FIREBASE_CONFIG = JSON.parse(atob(configParam));
  } catch (_) {
    // Will wait for postMessage fallback
  }
}

if (!self.__FIREBASE_CONFIG) {
  firebaseConfigReady = new Promise((resolve) => {
    resolveFirebaseConfig = resolve;
  });

  self.addEventListener("message", (event) => {
    if (event.data?.type === "FIREBASE_CONFIG" && event.data.config) {
      self.__FIREBASE_CONFIG = event.data.config;
      if (resolveFirebaseConfig) resolveFirebaseConfig();
    }
  });
}

/**
 * Lazily initialise Firebase Messaging inside the SW.
 * Returns null if config is not available yet.
 */
let messagingInstance = null;

function getOrInitMessaging() {
  if (messagingInstance) return messagingInstance;
  if (!self.__FIREBASE_CONFIG) return null;

  firebase.initializeApp(self.__FIREBASE_CONFIG);
  messagingInstance = firebase.messaging();
  return messagingInstance;
}

// ── Push event (works even before Firebase initialises) ──────────────
// This is the low-level push listener that fires for every incoming push.
// Firebase compat SDK hooks into this too, but having our own ensures
// notifications are shown even if Firebase init is delayed.
self.addEventListener("push", (event) => {
  // Let Firebase handle it if messaging is initialised
  if (messagingInstance) return;

  const data = event.data?.json?.() ?? {};
  const notification = data.notification || {};
  const title = notification.title || "FantaF1";
  const options = {
    body: notification.body || "",
    icon: notification.icon || "/FantaF1_Logo_192.png",
    badge: "/FantaF1_Logo_192.png",
    data: data.data || {},
    vibrate: [100, 50, 200],
    tag: data.data?.tag || "fantaf1-notification",
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ── Firebase onBackgroundMessage (richer notifications) ──────────────
// Initialise as soon as config is available.
async function initBackgroundMessaging() {
  if (firebaseConfigReady) await firebaseConfigReady;

  const messaging = getOrInitMessaging();
  if (!messaging) return;

  messaging.onBackgroundMessage((payload) => {
    const { title, body, icon } = payload.notification || {};
    const notificationTitle = title || "FantaF1";
    const notificationOptions = {
      body: body || "",
      icon: icon || "/FantaF1_Logo_192.png",
      badge: "/FantaF1_Logo_192.png",
      data: payload.data || {},
      vibrate: [100, 50, 200],
      tag: payload.data?.tag || "fantaf1-notification",
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
  });
}

initBackgroundMessaging();

// ── Notification click handler ───────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || "/";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            return client.focus();
          }
        }
        return clients.openWindow(urlToOpen);
      })
  );
});
