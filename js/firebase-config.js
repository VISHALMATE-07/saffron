import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCcbMMtj0HmLhotSSFPjBSzEY3U_tMCY4A",
  authDomain: "saffron-d926b.firebaseapp.com",
  projectId: "saffron-d926b",
  storageBucket: "saffron-d926b.firebasestorage.app",
  messagingSenderId: "242756185704",
  appId: "1:242756185704:web:eb2f11ed2d522126bbd5dd",
  measurementId: "G-TT9ZFE8KMG"
};

export const isConfigured = !firebaseConfig.apiKey.startsWith("PASTE");

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);