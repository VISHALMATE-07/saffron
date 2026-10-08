// AUTHENTICATION (Firebase Authentication + role from Firestore).
//
// How login works:
//   1. Firebase Authentication checks email + password.
//   2. We then read the document users/{uid} from Firestore to get the ROLE.
//   3. role "admin" -> admin.html, role "customer" -> menu.html.
//
// This file is loaded on every page: it fills the navbar (Login/Logout,
// Admin link, cart count) and also runs the login & register forms.
import { auth, db, isConfigured } from "./firebase-config.js";
import {
  onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, sendPasswordResetEmail, updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc, setDoc, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { updateCartCount } from "./cart.js";
import { showToast, isValidEmail, isValidPhone } from "./utils.js";

// ---------- Firestore profile helpers ----------

// Reads users/{uid}. Returns the profile object, or null if it does not exist.
export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}

// Calls callback(user, profile) now and whenever login state changes.
// user = null when logged out. profile = Firestore users/{uid} data.
export function watchAuth(callback) {
  onAuthStateChanged(auth, async user => {
    let profile = null;
    if (user) {
      try {
        profile = await getUserProfile(user.uid);
      } catch (error) {
        console.error("Could not read user profile:", error);
      }
    }
    callback(user, profile);
  });
}

// ---------- register / login / logout ----------

export async function registerUser(name, email, phone, password) {
  // 1. Create the login account in Firebase Authentication
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: name });

  // 2. Create the profile in Firestore. The role is ALWAYS "customer" here.
  //    Admins are created manually in the Firebase console (see README).
  await setDoc(doc(db, "users", cred.user.uid), {
    uid: cred.user.uid,
    name: name,
    email: email,
    phone: phone,
    role: "customer",
    createdAt: serverTimestamp()
  });
}

// Returns the user's profile (contains role).
export async function loginUser(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const profile = await getUserProfile(cred.user.uid);
  return profile || { role: "customer" };
}

export function logoutUser() {
  return signOut(auth);
}

// Turns Firebase error codes into messages a customer understands.
export function friendlyAuthError(error) {
  const messages = {
    "auth/invalid-credential": "Invalid email or password.",
    "auth/wrong-password": "Invalid email or password.",
    "auth/user-not-found": "Invalid email or password.",
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/email-already-in-use": "This email is already registered. Please login.",
    "auth/weak-password": "Password must be at least 6 characters.",
    "auth/too-many-requests": "Too many attempts. Please try again later.",
    "auth/network-request-failed": "Network error. Check your internet connection.",
    "auth/invalid-api-key": "Firebase is not configured. Edit js/firebase-config.js.",
    "permission-denied": "Permission denied by Firestore rules."
  };
  return messages[error.code] || "Something went wrong. Please try again.";
}

// ---------- navbar (runs on every page) ----------

export function setupNavbar() {
  updateCartCount();

  const toggle = document.getElementById("navToggle");
  const links = document.getElementById("navLinks");
  if (toggle && links) toggle.addEventListener("click", () => links.classList.toggle("open"));

  if (!isConfigured) {
    const banner = document.createElement("div");
    banner.className = "banner-warning";
    banner.textContent = "Firebase is not configured yet. Open js/firebase-config.js and paste your Firebase config.";
    document.body.prepend(banner);
  }

  const authLink = document.getElementById("authLink");
  const adminLink = document.getElementById("adminLink");
  if (!authLink) return;   // pages without a navbar (admin.html)

  watchAuth((user, profile) => {
    if (user) {
      authLink.textContent = "Logout";
      authLink.href = "#";
      authLink.onclick = async event => {
        event.preventDefault();
        await logoutUser();
        window.location.href = "index.html";
      };
      // Only a convenience: the REAL protection is the role check in admin.js + Firestore rules.
      adminLink.classList.toggle("hidden", !(profile && profile.role === "admin"));
    } else {
      authLink.textContent = "Login";
      authLink.href = "login.html";
      authLink.onclick = null;
      adminLink.classList.add("hidden");
    }
  });
}

// ---------- login.html ----------

function initLoginPage() {
  const form = document.getElementById("loginForm");
  if (!form) return;
  const message = document.getElementById("formMessage");
  const button = document.getElementById("loginBtn");

  form.addEventListener("submit", async event => {
    event.preventDefault();
    message.textContent = "";
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    if (!email || !password) {
      message.textContent = "Please enter your email and password.";
      return;
    }
    button.disabled = true;
    try {
      const profile = await loginUser(email, password);
      showToast("Login successful", "success");
      // Role decides the destination page.
      window.location.href = profile.role === "admin" ? "admin.html" : "menu.html";
    } catch (error) {
      console.error(error);
      message.textContent = friendlyAuthError(error);
    } finally {
      button.disabled = false;
    }
  });

  document.getElementById("forgotBtn").addEventListener("click", async () => {
    const email = document.getElementById("email").value.trim();
    if (!isValidEmail(email)) {
      message.textContent = "Type your email in the box above, then click Forgot Password.";
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      showToast("Password reset email sent. Check your inbox.", "success");
    } catch (error) {
      console.error(error);
      message.textContent = friendlyAuthError(error);
    }
  });
}

// ---------- register.html ----------

function initRegisterPage() {
  const form = document.getElementById("registerForm");
  if (!form) return;
  const message = document.getElementById("formMessage");
  const button = document.getElementById("registerBtn");

  form.addEventListener("submit", async event => {
    event.preventDefault();
    message.textContent = "";
    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const password = document.getElementById("password").value;
    const confirm = document.getElementById("confirmPassword").value;

    if (name.length < 2) { message.textContent = "Please enter your full name."; return; }
    if (!isValidEmail(email)) { message.textContent = "Please enter a valid email."; return; }
    if (!isValidPhone(phone)) { message.textContent = "Phone number must be exactly 10 digits."; return; }
    if (password.length < 6) { message.textContent = "Password must be at least 6 characters."; return; }
    if (password !== confirm) { message.textContent = "Passwords do not match."; return; }

    button.disabled = true;
    try {
      await registerUser(name, email, phone, password);
      showToast("Account created! Welcome to SAFFRON.", "success");
      setTimeout(() => { window.location.href = "menu.html"; }, 1000);
    } catch (error) {
      console.error(error);
      message.textContent = friendlyAuthError(error);
      button.disabled = false;
    }
  });
}

setupNavbar();
initLoginPage();
initRegisterPage();
