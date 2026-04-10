// ══════════════════════════════════════
// firebase-config.js (admin) — إعداد Firebase
// ══════════════════════════════════════

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore }  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey:            "AIzaSyCov8KnTUdzywlejDGk74WODUEbZfx1nIc",
  authDomain:        "hawwil.firebaseapp.com",
  projectId:         "hawwil",
  storageBucket:     "hawwil.firebasestorage.app",
  messagingSenderId: "797332872661",
  appId:             "1:797332872661:web:5c1da802f0bad15332715c"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, 'nam5'); // ✅ تم إضافة 'nam5'