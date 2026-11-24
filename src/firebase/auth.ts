import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApp, getApps, initializeApp } from "firebase/app";
import * as FirebaseAuth from "firebase/auth";
import {
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  inMemoryPersistence,
  initializeAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  sendEmailVerification,
  reload,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { doc, getDoc, getFirestore, serverTimestamp, setDoc } from "firebase/firestore";

const getReactNativePersistence = (FirebaseAuth as any).getReactNativePersistence as (storage: typeof AsyncStorage) => any;

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: "fitness-pro-by-danat.firebaseapp.com",
  projectId: "fitness-pro-by-danat",
  storageBucket: "fitness-pro-by-danat.firebasestorage.app",
  messagingSenderId: "1008395325573",
  appId: "1:1008395325573:web:c82f734a94a35a8cee59ec",
  measurementId: "G-HK214WF79C",
};

export const firebaseAuthConfigured = Boolean(firebaseConfig.apiKey);
export const CURRENT_POLICY_VERSION = "1.0";
const CURRENT_POLICY_EFFECTIVE_DATE = "2026-11-22";
let authInstance: ReturnType<typeof initializeAuth> | null = null;

function getFirebaseAuth() {
  if (!firebaseAuthConfigured) {
    throw new Error("Firebase configuration is incomplete. Add EXPO_PUBLIC_FIREBASE_API_KEY to the build environment and rebuild the app.");
  }
  if (authInstance) return authInstance;
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  try {
    authInstance = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch (error) {
    // Fast refresh can initialize Firebase more than once in development.
    if ((error as { code?: string }).code !== "auth/already-initialized") throw error;
    authInstance = getAuth(app);
  }
  return authInstance;
}

export function observeAuthState(callback: (user: User | null) => void) {
  return onAuthStateChanged(getFirebaseAuth(), callback);
}

export async function registerWithEmail(email: string, password: string, remember: boolean, policyAccepted: boolean) {
  if (!policyAccepted) {
    throw new Error("You must accept the current Terms of Use and Health Disclaimer before creating an account.");
  }
  const auth = getFirebaseAuth();
  await setPersistence(auth, remember ? getReactNativePersistence(AsyncStorage) : inMemoryPersistence);
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
  try {
    await sendEmailVerification(credential.user);
    return true;
  } catch (error) {
    // The Firebase account and policy acceptance already exist. Keep the user
    // signed in so the verification screen can offer a resend action.
    console.warn("Initial verification email could not be sent", error);
    return false;
  }
}

export async function signInWithEmail(email: string, password: string, remember: boolean) {
  const auth = getFirebaseAuth();
  await setPersistence(auth, remember ? getReactNativePersistence(AsyncStorage) : inMemoryPersistence);
  const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
  try {
    const pending = await getDoc(doc(getFirestore(getApp()), "accountDeletionRequests", credential.user.uid));
    if (pending.exists()) {
      await signOut(auth);
      throw new Error("This account has a pending deletion request. Contact IT@danat-gulf.com for confirmation.");
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("pending deletion request")) throw error;
    await signOut(auth).catch(() => undefined);
    throw new Error("We could not verify your account status. Please try signing in again.");
  }
  return credential;
}

export async function requestAccountDeletion() {
  const auth = getFirebaseAuth();
  const user = auth.currentUser;
  if (!user) throw new Error("auth/no-current-user");
  const db = getFirestore(getApp());
  const requestRef = doc(db, "accountDeletionRequests", user.uid);
  const existing = await getDoc(requestRef);
  if (existing.exists()) return { alreadyPending: true };
  await setDoc(requestRef, {
    uid: user.uid,
    email: user.email ?? "",
    requestedAt: serverTimestamp(),
    status: "pending",
  });
  return { alreadyPending: false };
}

export async function resendVerificationEmail() {
  const user = getFirebaseAuth().currentUser;
  if (!user) throw new Error("auth/no-current-user");
  if (user.emailVerified) return;
  await sendEmailVerification(user);
}

export async function refreshEmailVerification() {
  const user = getFirebaseAuth().currentUser;
  if (!user) return false;
  await reload(user);
  return getFirebaseAuth().currentUser?.emailVerified ?? false;
}

export async function sendPasswordReset(email: string) {
  return sendPasswordResetEmail(getFirebaseAuth(), email.trim());
}

export async function signOutUser() {
  return signOut(getFirebaseAuth());
}
