import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../src/firebase/config';
import { useSettingsStore } from '../src/store/useSettingsStore';

export default function Index() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const onboardingSeen = useSettingsStore((s) => s.onboardingSeen);
  // Wait for the persisted settings to hydrate before the one-time onboarding
  // redirect — otherwise a returning user (onboardingSeen=true on disk) could be
  // redirected to onboarding before the stored value loads.
  const [hydrated, setHydrated] = useState(() => useSettingsStore.persist.hasHydrated());

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    if (!hydrated) {
      const unsubHydrate = useSettingsStore.persist.onFinishHydration(() => setHydrated(true));
      if (useSettingsStore.persist.hasHydrated()) setHydrated(true);
      return () => { unsub(); unsubHydrate(); };
    }
    return unsub;
  }, [hydrated]);

  if (user === undefined || !hydrated) {
    return (
      <View style={{ flex: 1, backgroundColor: '#121212', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color="#00C853" size="large" />
      </View>
    );
  }

  if (!user) return <Redirect href="/auth" />;
  // First-launch "How to use" guide, once, before the map.
  if (!onboardingSeen) return <Redirect href="/onboarding" />;
  return <Redirect href="/(tabs)/map" />;
}
