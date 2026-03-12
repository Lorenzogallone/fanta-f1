/**
 * Firebase Configuration and Initialization
 * Configures and exports Firebase app instance, Firestore database, and FCM messaging
 */

import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, browserLocalPersistence, setPersistence } from "firebase/auth";
import { getStorage } from "firebase/storage";

/**
 * Firebase configuration object with API credentials
 * @type {Object}
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

/** Initialized Firebase application instance */
export const app = initializeApp(firebaseConfig);

/** Firestore database instance */
export const db = getFirestore(app);

/** Firebase Auth instance with local persistence (stay logged in across sessions) */
export const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence);

/** Firebase Storage instance for file uploads (avatars) */
export const storage = getStorage(app);

