// Import the functions you need from the SDKs you need
// Fix: Refactored to use the modular v9 SDK for consistency and to fix initialization errors.
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyA-o1CxOZLXTC6BZaqMv8i6Rc478Qds5Dg",
  authDomain: "bd-de-hematologia.firebaseapp.com",
  projectId: "bd-de-hematologia",
  storageBucket: "bd-de-hematologia.firebasestorage.app",
  messagingSenderId: "667777766105",
  appId: "1:667777766105:web:7e5ad3eb6cc9ce4024e4c8"
};

// Initialize Firebase
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);
