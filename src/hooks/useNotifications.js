/**
 * @file useNotifications hook
 * @description Hook to manage push notifications with Firebase Cloud Messaging
 */

import { useState, useEffect } from 'react';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { log, error as logError } from '../utils/logger';
import { useToast } from './useToast';

// VAPID key - Get this from Firebase Console > Project Settings > Cloud Messaging > Web Push certificates
const VAPID_KEY = 'YOUR_VAPID_KEY_HERE'; // TODO: Replace with actual VAPID key

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
  const toast = useToast();

  /**
   * Check if notifications are supported
   */
  useEffect(() => {
    if ('Notification' in window && 'serviceWorker' in navigator) {
      setIsSupported(true);
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
      toast.error('Notifications not supported in this browser');
      return 'denied';
    }

    setLoading(true);

    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm === 'granted') {
        await registerToken();
        toast.success('Notifications enabled!');
      } else if (perm === 'denied') {
        toast.warning('Notifications blocked. Enable them in browser settings.');
      }

      return perm;
    } catch (err) {
      logError(err, 'requestPermission');
      toast.error('Failed to enable notifications');
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
        log('FCM Token:', currentToken);
        setToken(currentToken);

        // Save token to Firestore
        await setDoc(doc(db, 'notificationTokens', userId), {
          token: currentToken,
          userId,
          createdAt: new Date(),
          platform: 'web',
          userAgent: navigator.userAgent,
        });

        log('Token saved to Firestore');

        // Listen for foreground messages
        onMessage(messaging, (payload) => {
          log('Foreground message received:', payload);

          // Show toast notification
          toast.info(payload.notification?.body || 'New notification', {
            duration: 5000,
          });

          // Optionally show browser notification
          if (Notification.permission === 'granted') {
            new Notification(
              payload.notification?.title || 'FantaF1',
              {
                body: payload.notification?.body,
                icon: '/FantaF1_Logo_big.png',
                tag: 'race-reminder',
              }
            );
          }
        });
      } else {
        logError(new Error('No registration token available'), 'registerToken');
        toast.error('Failed to get notification token');
      }
    } catch (err) {
      logError(err, 'registerToken');
      toast.error('Failed to register for notifications');
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
      toast.success('Notifications disabled');
    } catch (err) {
      logError(err, 'unregisterToken');
      toast.error('Failed to disable notifications');
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
    requestPermission,
    unregisterToken,
    toggleNotifications,
    isEnabled: !!token && permission === 'granted',
  };
};
