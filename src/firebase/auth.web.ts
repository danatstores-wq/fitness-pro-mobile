import { getApp, getApps, initializeApp } from "firebase/app";
import {
  browserLocalPersistence,
  browserSessionPersistence,
  getAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  setPersistence,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: "fitness-pro-by-danat.firebaseapp.com",
  projectId: "fitness-pro-by-danat",
  storageBucket: "fitness-pro-by-danat.firebasestorage.app",
  messagingSenderId: "1008395325573",
  appId: "1:100839532557:web:c82f734a94a35a8cee59ec",
  measurementId: "G-HK214WF79C",
};

export const firebaseAuthConfigured = Boolean(firebaseConfig.apiKey);
function getFirebaseAuth() {
  if (!firebaseAuthConfigured) {
    throw new Error("Firebase configuration is incomplete. Add EXPO_PUBLIC_FIREBASE_API_KEY to the build environment and rebuild the app.");
  }
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return getAuth(app);
}

export function observeAuthState(callback: (user: User | null) => void) {
  return onAuthStateChanged(getFirebaseAuth(), callback);
}

export async function registerWithEmail(email: string, password: string, remember: boolean) {
  const auth = getFirebaseAuth();
  await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
  return createUserWithEmailAndPassword(auth, email.trim(), password);
}

export async function signInWithEmail(email: string, password: string, remember: boolean) {
  const auth = getFirebaseAuth();
  await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
  return signInWithEmailAndPassword(auth, email.trim(), password);
}

export async function sendPasswordReset(email: string) {
  return sendPasswordResetEmail(getFirebaseAuth(), email.trim());
}

export async function signOutUser() {
  return signOut(getFirebaseAuth());
}
