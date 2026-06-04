import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { initializeAuth, getAuth, type Persistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

// getReactNativePersistence is in the RN bundle but absent from TS types.
// We access it via require() and guard against undefined so Android doesn't
// crash when the wrong bundle is resolved at runtime.
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
    // Already initialized (Fast Refresh) — return existing instance
    try { return getAuth(app); } catch { /* fall through */ }
    // Last resort: no persistence
    return initializeAuth(app);
  }
})();
