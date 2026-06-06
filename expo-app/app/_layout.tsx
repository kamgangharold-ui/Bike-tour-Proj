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
import * as Updates from 'expo-updates';
import { router } from 'expo-router';
import RideBanner from '../src/components/RideBanner';
import OfflineBanner from '../src/components/OfflineBanner';
import EventBanner from '../src/components/EventBanner';
import { setupNotifications } from '../src/utils/notify';

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

  // Silently apply OTA JS updates on launch so the installed APK picks up
  // JS-only fixes without a reinstall. No-op in Expo Go / dev (Updates.isEnabled
  // is false there) and offline (caught) — never blocks or crashes startup.
  useEffect(() => {
    if (__DEV__ || !Updates.isEnabled) return;
    (async () => {
      try {
        const result = await Updates.checkForUpdateAsync();
        if (result.isAvailable) {
          await Updates.fetchUpdateAsync();
          await Updates.reloadAsync();
        }
      } catch {
        // Network unavailable or updates not configured — keep the cached bundle.
      }
    })();
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, () => {
      setAuthReady(true);
      SplashScreen.hideAsync();
    });
    return unsub;
  }, []);

  // Drop 2: notification permission + Android channels, and route a notification
  // tap to the map.
  useEffect(() => {
    void setupNotifications();
    const sub = Notifications.addNotificationResponseReceivedListener(() => {
      try { router.push('/(tabs)/map'); } catch { /* ignore */ }
    });
    return () => sub.remove();
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
        <Stack.Screen name="recap" options={{ headerShown: true, title: 'Ride recap' }} />
        <Stack.Screen name="settings" options={{ headerShown: true, title: 'Settings' }} />
      </Stack>
      <RideBanner />
      <OfflineBanner />
      <EventBanner />
    </SafeAreaProvider>
  );
}
