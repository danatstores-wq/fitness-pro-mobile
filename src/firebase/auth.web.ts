import { getApp, getApps, initializeApp } from "firebase/app";
import {
  browserLocalPersistence,
  browserSessionPersistence,
  getAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  sendEmailVerification,
  reload,
  setPersistence,
  createUserWithEmailAndPassword,
  deleteUser,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { doc, getFirestore, serverTimestamp, setDoc } from "firebase/firestore";

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
export const CURRENT_POLICY_VERSION = "1.0";
const CURRENT_POLICY_EFFECTIVE_DATE = "2026-11-22";

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

export async function registerWithEmail(email: string, password: string, remember: boolean, policyAccepted: boolean) {
  if (!policyAccepted) {
    throw new Error("You must accept the current Terms of Use and Health Disclaimer before creating an account.");
  }
  const auth = getFirebaseAuth();
  await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
  const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
  try {
    const db = getFirestore(getApp());
    await setDoc(doc(db, "policyAcceptances", credential.user.uid, "versions", CURRENT_POLICY_VERSION), {
      uid: credential.user.uid,
      policyVersion: CURRENT_POLICY_VERSION,
      policyEffectiveDate: CURRENT_POLICY_EFFECTIVE_DATE,
      accepted: true,
      acceptanceMethod: "registration_checkbox",
      acceptedAt: serverTimestamp(),
    });
    
  } catch (error) {
    try {
      await deleteUser(credential.user);
    } catch {
      await signOut(auth).catch(() => undefined);
    }
    throw new Error("We could not securely save your policy acceptance. Your registration was not completed. Please try again.");
  }
  await sendEmailVerification(credential.user);
  return credential;
}

export async function signInWithEmail(email: string, password: string, remember: boolean) {
  const auth = getFirebaseAuth();
  await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
  const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
  if (!credential.user.emailVerified) {
    const error = new Error("Please verify your email before signing in.") as Error & { code: string };
    error.code = "auth/email-not-verified";
    throw error;
  }
  return credential;
}

export async function resendVerificationEmail(email: string) {
  const auth = getFirebaseAuth();
  const user = auth.currentUser;
  if (!user || user.email?.toLowerCase() !== email.trim().toLowerCase()) {
    throw new Error("Please log in with the account awaiting verification, then resend the email.");
  }
  await sendEmailVerification(user);
}

export async function checkEmailVerification() {
  const auth = getFirebaseAuth();
  const user = auth.currentUser;
  if (!user) return null;
  await reload(user);
  return user.emailVerified ? { uid: user.uid, email: user.email } : null;
}

export async function sendPasswordReset(email: string) {
  return sendPasswordResetEmail(getFirebaseAuth(), email.trim());
}

export async function signOutUser() {
  return signOut(getFirebaseAuth());
}
