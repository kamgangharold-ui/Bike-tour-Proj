import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
// Import from @firebase/auth so Metro resolves the react-native export condition —
// firebase/auth has no react-native condition and loads the browser bundle, which
// fails to register the auth component at runtime.
import { initializeAuth, type Persistence } from '@firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

// getReactNativePersistence exists in the RN bundle resolved at runtime but is absent
// from @firebase/auth's main type declarations — require() lets Metro pick the RN bundle.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getReactNativePersistence } = require('@firebase/auth') as {
  getReactNativePersistence: (storage: unknown) => Persistence;
};

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
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});
