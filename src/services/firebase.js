/**
 * Firebase Configuration and Initialization
 * Configures and exports Firebase app instance and Firestore database
 */

import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

/**
 * Firebase configuration object with API credentials
 * @type {Object}
 */
const firebaseConfig = {
  apiKey: "AIzaSyD4BZQbEEpfc1YFmZbsKAx_yCTbYsmOSZ0",
  authDomain: "fantaf1-b5410.firebaseapp.com",
  projectId: "fantaf1-b5410",
  storageBucket: "fantaf1-b5410.firebasestorage.app",
  messagingSenderId: "933486998039",
  appId: "1:933486998039:web:cd31c0ce29f92e2feca252",
  measurementId: "G-6YG7VS4EFQ"
};

/** Initialized Firebase application instance */
export const app = initializeApp(firebaseConfig);

/** Firestore database instance */
export const db = getFirestore(app);
