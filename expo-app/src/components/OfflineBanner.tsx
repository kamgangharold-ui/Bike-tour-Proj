// Thin top banner shown while the device is offline (à la Apple's "Using
// Offline Maps"). Drives the store's isOnline flag so other UI (e.g. the ride
// banner) can lay out around it. Uses expo-network (works in Expo Go).

import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNetworkState } from 'expo-network';
import { useAppStore } from '../store/useAppStore';

export const OFFLINE_BANNER_HEIGHT = 28;

export default function OfflineBanner() {
  const net = useNetworkState();
  const insets = useSafeAreaInsets();
  const setOnline = useAppStore((s) => s.setOnline);

  // Only treat as offline when we're confident (explicit false) — isConnected /
  // isInternetReachable are undefined on cold start, which must NOT flash offline.
  const offline = net.isConnected === false || net.isInternetReachable === false;

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
