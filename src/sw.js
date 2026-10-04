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

// ── Push notifications ───────────────────────────────────────────────
// FCM delivers standard Web Push messages, so we handle the "push" event
// ourselves and show exactly ONE notification per message.
//
// We intentionally do NOT load the Firebase Messaging SDK here: with a
// `notification` payload the SDK already displays the notification on its
// own, so also showing it from onBackgroundMessage produced duplicates
// (especially on iOS, where `tag` does not replace an existing notification).
// Getting the FCM token in the page only needs this SW registration.
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data?.json() ?? {};
  } catch {
    payload = { notification: { body: event.data?.text() ?? "" } };
  }

  const notification = payload.notification || {};
  const data = payload.data || {};
  const title = notification.title || "FantaF1";
  const options = {
    body: notification.body || "",
    icon: notification.icon || "/FantaF1_Logo_192.png",
    badge: notification.badge || "/FantaF1_Logo_192.png",
    data: { ...data, url: data.url || payload.fcmOptions?.link || "/" },
    vibrate: [100, 50, 200],
    tag: notification.tag || data.tag || "fantaf1-notification",
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

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
            return client.focus().then((focused) =>
              focused && "navigate" in focused ? focused.navigate(urlToOpen) : focused
            );
          }
        }
        return clients.openWindow(urlToOpen);
      })
  );
});
