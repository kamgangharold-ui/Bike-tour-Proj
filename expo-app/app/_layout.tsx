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
import { Audio } from 'expo-av';
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
    const unsub = onAuthStateChanged(auth, () => {
      setAuthReady(true);
      SplashScreen.hideAsync();
    });
    return unsub;
  }, []);

  // Let voice guidance play through the iOS silent switch and (in a dev build)
  // keep going with the screen off. The full background mode isn't available in
  // Expo Go, so fall back to a foreground-only audio mode there.
  useEffect(() => {
    void (async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          shouldDuckAndroid: true,
        });
      } catch {
        try {
          await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, shouldDuckAndroid: true });
        } catch {
          // non-fatal
        }
      }
    })();
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
