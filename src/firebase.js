// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyD4BZQbEEpfc1YFmZbsKAx_yCTbYsmOSZ0",
  authDomain: "fantaf1-b5410.firebaseapp.com",
  projectId: "fantaf1-b5410",
  storageBucket: "fantaf1-b5410.firebasestorage.app",
  messagingSenderId: "933486998039",
  appId: "1:933486998039:web:cd31c0ce29f92e2feca252",
  measurementId: "G-6YG7VS4EFQ"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
