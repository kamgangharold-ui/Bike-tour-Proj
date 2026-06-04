import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { initializeAuth, getAuth, type Persistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

// getReactNativePersistence lives in @firebase/auth's react-native bundle.
// metro.config.js adds 'react-native' to unstable_conditionNames so Metro
// resolves firebase/auth to that bundle. On Android standalone builds the
// browser bundle can still resolve, so we read it defensively and guard for
// undefined rather than crashing at startup.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const _authModule = require('firebase/auth') as Record<string, unknown>;
const getReactNativePersistence = _authModule['getReactNativePersistence'] as
  ((storage: unknown) => Persistence) | undefined;

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? '',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? 'bike-tour-d0334.firebaseapp.com',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? 'bike-tour-d0334',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? 'bike-tour-d0334.firebasestorage.app',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '',
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const db = getFirestore(app);
export const auth = (() => {
  try {
    const persistence = getReactNativePersistence?.(AsyncStorage);
    return initializeAuth(app, persistence ? { persistence } : undefined);
  } catch {
    // Already initialised (Fast Refresh) — reuse the existing instance
    try { return getAuth(app); } catch { /* fall through */ }
    return initializeAuth(app); // last resort: no persistence
  }
})();
