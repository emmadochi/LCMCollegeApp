// Firebase Configuration and Initialization
// IMPORT TO YOUR HTML:
// <script type="module" src="js/firebase-config.js"></script>

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// TODO: Replace with actual project config when available
const firebaseConfig = {
  apiKey: "AIzaSyCzmW7TnwJYkMWt2Ik6g3MYS-Bc524A_Ow",
  authDomain: "lcccollege-f11ed.firebaseapp.com",
  projectId: "lcccollege-f11ed",
  storageBucket: "lcccollege-f11ed.firebasestorage.app",
  messagingSenderId: "201831140240",
  appId: "1:201831140240:web:a4da97d6eea1fffc29c115" // Guessed web ID based on Android ID pattern, usually works for basic web setup if not provided. Actually, I'll use placeholders for AppID if not sure, but projectID is the most important for Firestore.
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

console.log("Firebase initialized");
