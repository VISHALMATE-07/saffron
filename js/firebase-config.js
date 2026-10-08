// =====================================================================
//  FIREBASE CONFIGURATION  -  THIS IS THE ONLY FILE YOU MUST EDIT
// =====================================================================
//  Where to get these values:
//  Firebase Console > Project settings (gear icon) > General >
//  "Your apps" > Web app (</>) > "SDK setup and configuration" > Config
//
//  Replace every "PASTE_..." text below with your own values.
//  (These web config values are NOT secret. Your data is protected by
//   Firestore Security Rules. NEVER put a service-account / Admin SDK
//   private key in this project.)
// =====================================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCcbMMtj0HmLhotSSFPjBSzEY3U_tMCY4A",
  authDomain: "saffron-d926b.firebaseapp.com",
  projectId: "saffron-d926b",
  storageBucket: "saffron-d926b.firebasestorage.app",
  messagingSenderId: "242756185704",
  appId: "1:242756185704:web:eb2f11ed2d522126bbd5dd",
  measurementId: "G-TT9ZFE8KMG"
};

// Initialize Firebase


// true once you have pasted a real key (used to show a helpful warning banner)
export const isConfigured = !firebaseConfig.apiKey.startsWith("PASTE");

// Start Firebase, then export the two services every other file uses:
//   auth = Firebase Authentication (login / register / logout)
//   db   = Firestore database (users, menu, orders)
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
