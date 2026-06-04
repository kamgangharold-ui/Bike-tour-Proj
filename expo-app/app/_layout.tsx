import '../src/tasks/geofenceTask'; // registers TaskManager task at module load time
import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../src/firebase/config';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
// Remote push notifications require EAS development build (not Expo Go)
// Local geofence notifications work in Expo Go foreground only
import * as Notifications from 'expo-notifications';
import RideBanner from '../src/components/RideBanner';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    // Fallback: if Firebase auth hangs (e.g. Android cold start), unblock after 5 s
    const timeout = setTimeout(() => {
      setAuthReady(true);
      SplashScreen.hideAsync();
    }, 5000);

    const unsub = onAuthStateChanged(auth, () => {
      clearTimeout(timeout);
      setAuthReady(true);
      SplashScreen.hideAsync();
    });

    return () => {
      clearTimeout(timeout);
      unsub();
    };
  }, []);

  if (!authReady) return null;

  return (
    <SafeAreaProvider>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#1E1E1E' },
          headerTintColor: '#fff',
          contentStyle: { backgroundColor: '#121212' },
          headerShown: false,
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="(tabs)" />
      </Stack>
      <RideBanner />
    </SafeAreaProvider>
  );
}
