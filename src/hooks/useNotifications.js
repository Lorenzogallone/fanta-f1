/**
 * @file useNotifications hook
 * @description Hook to manage push notifications with Firebase Cloud Messaging
 * @version 2.0.0 - Uses environment variable for VAPID key
 */

import { useState, useEffect } from 'react';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { log, error as logError } from '../utils/logger';
import { useToast } from './useToast';

// VAPID key from environment variable
// Get this from Firebase Console > Project Settings > Cloud Messaging > Web Push certificates
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

/**
 * Hook to handle push notifications
 * @param {string} userId - User ID to associate with notification token
 * @returns {Object} Notification state and functions
 */
export const useNotifications = (userId) => {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState(Notification.permission);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const toast = useToast();

  /**
   * Check if notifications are supported and VAPID key is configured
   */
  useEffect(() => {
    if ('Notification' in window && 'serviceWorker' in navigator) {
      if (!VAPID_KEY) {
        setIsSupported(false);
        setError('Notifications not configured. VAPID key missing.');
        log('⚠️ VAPID key not configured in environment variables');
      } else {
        setIsSupported(true);
      }
    } else {
      setIsSupported(false);
      log('Push notifications not supported in this browser');
    }
  }, []);

  /**
   * Request notification permission
   * @returns {Promise<string>} Permission status
   */
  const requestPermission = async () => {
    if (!isSupported) {
      const message = error || 'Notifications not supported in this browser';
      toast.error(message);
      return 'denied';
    }

    setLoading(true);

    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm === 'granted') {
        await registerToken();
        toast.success('🔔 Notifiche attivate! Riceverai un promemoria 30 minuti prima di ogni evento.');
      } else if (perm === 'denied') {
        toast.warning('Notifiche bloccate. Abilitale nelle impostazioni del browser.');
      }

      return perm;
    } catch (err) {
      logError(err, 'requestPermission');
      toast.error('Errore nell\'attivazione delle notifiche');
      return 'denied';
    } finally {
      setLoading(false);
    }
  };

  /**
   * Register FCM token to Firestore
   */
  const registerToken = async () => {
    if (!userId) {
      log('No user ID provided, skipping token registration');
      return;
    }

    if (!VAPID_KEY) {
      logError(new Error('VAPID key not configured'), 'registerToken');
      return;
    }

    try {
      // Register service worker
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      log('Service Worker registered:', registration);

      // Get FCM instance
      const messaging = getMessaging();

      // Get FCM token
      const currentToken = await getToken(messaging, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: registration,
      });

      if (currentToken) {
        log('✓ FCM Token obtained');
        setToken(currentToken);

        // Save token to Firestore
        await setDoc(doc(db, 'notificationTokens', userId), {
          token: currentToken,
          userId,
          createdAt: new Date(),
          updatedAt: new Date(),
          platform: 'web',
          userAgent: navigator.userAgent.substring(0, 200), // Limit length
        });

        log('✓ Token saved to Firestore');

        // Listen for foreground messages
        onMessage(messaging, (payload) => {
          log('📩 Foreground message received:', payload);

          // Show toast notification
          const title = payload.notification?.title || 'FantaF1';
          const body = payload.notification?.body || 'Nuova notifica';

          toast.info(`${title}: ${body}`, {
            duration: 7000,
          });

          // Show browser notification if permission granted
          if (Notification.permission === 'granted') {
            const notification = new Notification(title, {
              body: body,
              icon: '/FantaF1_Logo_big.png',
              badge: '/FantaF1_Logo_big.png',
              tag: payload.data?.type || 'race-reminder',
              data: payload.data,
              requireInteraction: false,
            });

            // Handle notification click
            notification.onclick = () => {
              window.focus();
              if (payload.data?.url) {
                window.location.href = payload.data.url;
              }
              notification.close();
            };
          }
        });
      } else {
        logError(new Error('No registration token available'), 'registerToken');
        toast.error('Impossibile ottenere il token di notifica');
      }
    } catch (err) {
      logError(err, 'registerToken');
      toast.error('Errore nella registrazione delle notifiche');
    }
  };

  /**
   * Unregister from notifications
   */
  const unregisterToken = async () => {
    if (!userId) return;

    setLoading(true);

    try {
      await deleteDoc(doc(db, 'notificationTokens', userId));
      setToken(null);
      toast.success('🔕 Notifiche disattivate');
      log('✓ Token removed from Firestore');
    } catch (err) {
      logError(err, 'unregisterToken');
      toast.error('Errore nella disattivazione delle notifiche');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Toggle notifications on/off
   */
  const toggleNotifications = async () => {
    if (token) {
      await unregisterToken();
    } else {
      await requestPermission();
    }
  };

  return {
    isSupported,
    permission,
    token,
    loading,
    error,
    requestPermission,
    unregisterToken,
    toggleNotifications,
    isEnabled: !!token && permission === 'granted',
    isConfigured: !!VAPID_KEY,
  };
};
