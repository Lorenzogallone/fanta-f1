// Firebase Cloud Messaging Service Worker
// This file MUST be at the root of the public directory for FCM to work correctly.
// It handles background push notifications when the app is not in the foreground.
/* eslint-env serviceworker */
/* global importScripts, firebase, clients */

importScripts("https://www.gstatic.com/firebasejs/11.10.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging-compat.js");

// Otteniamo la configurazione firebase in modo sicuro dal server
// invece di hardcodare o esporre le variabili nel bundle del SW.
// Per ora inizializziamo senza config esplicita in attesa di implementare l'endpoint
// o usare una configurazione minimale.
const firebaseConfig = {
  // Le API key nei service worker andrebbero iniettate lato server o
  // limitate nel Google Cloud Console alle sole API FCM.
  // FCM non necessita di apiKey completa ma solo del VAPID per funzionare lato client.
  // La config sarà passata via url, postMessage o endpoint in fase avanzata.
};

// Inizializzeremo tramite il main thread che passa la configurazione al SW via postMessage
// o parametri nell'URL del SW. Per ora lasciamo l'oggetto vuoto per evitare l'errore.
firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

/**
 * Background message handler.
 * Called when the app is not in the foreground (closed or minimized).
 * Constructs and shows a native OS notification.
 */
messaging.onBackgroundMessage((payload) => {
  const { title, body, icon } = payload.notification || {};

  const notificationTitle = title || "FantaF1";
  const notificationOptions = {
    body: body || "",
    icon: icon || "/FantaF1_Logo_big.png",
    badge: "/FantaF1_Logo_big.png",
    data: payload.data || {},
    // Vibrate pattern: short-pause-long
    vibrate: [100, 50, 200],
    tag: payload.data?.tag || "fantaf1-notification",
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

/**
 * Notification click handler.
 * Opens the app when the user taps on a notification.
 */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  // Open or focus the app
  const urlToOpen = event.notification.data?.url || "/";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // If a tab is already open, focus it
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            return client.focus();
          }
        }
        // Otherwise open a new tab
        return clients.openWindow(urlToOpen);
      })
  );
});
