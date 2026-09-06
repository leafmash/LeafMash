import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  initializeFirestore, persistentLocalCache, persistentSingleTabManager, clearIndexedDbPersistence
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyD-rHKO1f8FSjaUVEilN27BXckeIAuMpBk",
  authDomain: "leafmash-app.firebaseapp.com",
  projectId: "leafmash-app",
  storageBucket: "leafmash-app.firebasestorage.app",
  messagingSenderId: "397042984769",
  appId: "1:397042984769:web:80d7e17cf7f0ad2d77e3c0",
  measurementId: "G-0R3KYM7LWZ"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentSingleTabManager() })
});

const SESSION_MARKER_KEY = "leafmash_session_established";

export async function resetCacheOnColdStart() {
  if (localStorage.getItem(SESSION_MARKER_KEY)) return false;
  try {
    await clearIndexedDbPersistence(db);
  } catch {
  }
  return true;
}

export function markSessionEstablished() {
  try { localStorage.setItem(SESSION_MARKER_KEY, "1"); } catch {  }
}

export const VAPID_KEY = "BD9lAKJwaHRwTaSMqD6sYWs40rfsEhUW0rxuyZtOgBsWm4jhdAgMCS4aLCIpcvFmtpIvnn_klw9IdwWrP2tp7rc";

export const DEPARTMENT_NAME = "Geography & Environment";
export const COLLEGE_NAME = "Govt. Michael Madhusudan College, Jessore";

// Re-exported from the single shared source of truth — see
// /shared/resource-categories.js (also used by the serverless API routes).
export { RESOURCE_CATEGORIES } from "../shared/resource-categories.js";

// Re-exported from the single shared source of truth — see
// /shared/admin-config.js (also used by the serverless API routes).
export { ADMIN_EMAILS, ADMIN_NAME } from "../shared/admin-config.js";
export { VERIFIED_EMAILS, VERIFIED_NAME } from "../shared/admin-config.js";
