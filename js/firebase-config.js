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

const firebaseConfig = {
  apiKey: "PASTE_YOUR_API_KEY",
  authDomain: "PASTE_YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "PASTE_YOUR_PROJECT_ID",
  storageBucket: "PASTE_YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "PASTE_YOUR_SENDER_ID",
  appId: "PASTE_YOUR_APP_ID"
};

// true once you have pasted a real key (used to show a helpful warning banner)
export const isConfigured = !firebaseConfig.apiKey.startsWith("PASTE");

// Start Firebase, then export the two services every other file uses:
//   auth = Firebase Authentication (login / register / logout)
//   db   = Firestore database (users, menu, orders)
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
