/**
 * @file Firebase Cloud Messaging Service Worker
 * @description Handles background push notifications for FantaF1
 * @version 2.0.0 - Supports qualifying, sprint, and race notifications
 */

// Import Firebase scripts for service worker
importScripts('https://www.gstatic.com/firebasejs/11.10.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging-compat.js');

// Initialize Firebase in service worker
// Note: Use same config as main app
firebase.initializeApp({
  apiKey: "AIzaSyD4BZQbEEpfc1YFmZbsKAx_yCTbYsmOSZ0",
  authDomain: "fantaf1-b5410.firebaseapp.com",
  projectId: "fantaf1-b5410",
  storageBucket: "fantaf1-b5410.firebasestorage.app",
  messagingSenderId: "876542464166",
  appId: "1:876542464166:web:49a8c7fbd3b10e4fc86ab8",
  measurementId: "G-04JN5VY4HP"
});

// Initialize Firebase Messaging
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message:', payload);

  const eventType = payload.data?.eventType || 'event';
  const raceName = payload.data?.raceName || 'Race';

  // Customize notification based on event type
  let icon = '/FantaF1_Logo_big.png';
  let badge = '/FantaF1_Logo_big.png';
  let actions = [];

  if (eventType === 'race') {
    actions = [
      {
        action: 'view-lineup',
        title: '🏁 Vai alla formazione',
      },
      {
        action: 'dismiss',
        title: 'Chiudi',
      }
    ];
  } else if (eventType === 'quali' || eventType === 'qualiSprint') {
    actions = [
      {
        action: 'view-lineup',
        title: '⏱️ Prepara la formazione',
      },
      {
        action: 'dismiss',
        title: 'Chiudi',
      }
    ];
  }

  const notificationTitle = payload.notification?.title || `🏎️ ${raceName}`;
  const notificationOptions = {
    body: payload.notification?.body || 'Nuovo evento FantaF1',
    icon: icon,
    badge: badge,
    tag: `${eventType}-reminder`,
    requireInteraction: true,
    data: payload.data,
    actions: actions,
    vibrate: [200, 100, 200], // Vibration pattern
    timestamp: Date.now(),
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification click received:', event.action);

  event.notification.close();

  if (event.action === 'view-lineup') {
    // Open lineup page
    event.waitUntil(
      clients.openWindow('/lineup')
    );
  } else if (event.action === 'dismiss') {
    // Just close the notification
    return;
  } else {
    // Default action - try to focus existing tab or open new one
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then((clientList) => {
          // Check if there's already a window open
          for (let i = 0; i < clientList.length; i++) {
            const client = clientList[i];
            if (client.url.includes('/lineup') && 'focus' in client) {
              return client.focus();
            }
          }
          // If no window is open, open a new one
          if (clients.openWindow) {
            return clients.openWindow('/lineup');
          }
        })
    );
  }
});

// Install event - cache resources if needed
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(clients.claim());
});
