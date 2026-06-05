// Thin top banner shown while the device is offline (à la Apple's "Using
// Offline Maps"). Drives the store's isOnline flag so other UI (e.g. the ride
// banner) can lay out around it.
//
// DEFENSIVE: this component is mounted at the app root, so it runs on launch.
// expo-network's native module is ABSENT in any build made before it was added.
// If an OTA ever reaches such a build, a hard import + hook would crash the whole
// app on launch. So we load expo-network with a guarded require and use its
// listener API (not the hook) — a missing module simply disables the banner
// (treated as online) instead of white-screening the app. The fingerprint
// runtimeVersion policy is the primary guard; this is defense-in-depth.

import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppStore } from '../store/useAppStore';

let Network: typeof import('expo-network') | null = null;
try {
  Network = require('expo-network');
} catch {
  Network = null;
}

export const OFFLINE_BANNER_HEIGHT = 28;

export default function OfflineBanner() {
  const insets = useSafeAreaInsets();
  const setOnline = useAppStore((s) => s.setOnline);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (!Network?.addNetworkStateListener) return; // module unavailable → stay "online"
    let sub: { remove: () => void } | undefined;
    // Only treat as offline when we're confident (explicit false) — the fields
    // are undefined on cold start, which must NOT flash offline.
    const apply = (state: { isConnected?: boolean; isInternetReachable?: boolean }) =>
      setOffline(state.isConnected === false || state.isInternetReachable === false);
    try {
      void Network.getNetworkStateAsync().then(apply).catch(() => {});
      sub = Network.addNetworkStateListener(apply);
    } catch (e) {
      console.warn('[OfflineBanner] expo-network unavailable', e);
    }
    return () => {
      try { sub?.remove?.(); } catch { /* noop */ }
    };
  }, []);

  useEffect(() => {
    setOnline(!offline);
  }, [offline, setOnline]);

  if (!offline) return null;

  return (
    <View
      style={[styles.wrap, { top: insets.top, height: OFFLINE_BANNER_HEIGHT }]}
      pointerEvents="none"
    >
      <Text style={styles.text}>⚠️ Offline — showing saved data</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: '#B26A00',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000,
  },
  text: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
