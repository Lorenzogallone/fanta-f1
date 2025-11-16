/**
 * @file Firebase Cloud Messaging Service Worker
 * @description Handles background push notifications
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

  const notificationTitle = payload.notification?.title || 'FantaF1 Notification';
  const notificationOptions = {
    body: payload.notification?.body || 'You have a new notification',
    icon: '/FantaF1_Logo_big.png',
    badge: '/FantaF1_Logo_big.png',
    tag: 'race-reminder',
    requireInteraction: true,
    data: payload.data,
    actions: [
      {
        action: 'view-lineup',
        title: 'View Lineup',
      },
      {
        action: 'dismiss',
        title: 'Dismiss',
      }
    ]
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification click received.');

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
    // Default action - open app
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});
