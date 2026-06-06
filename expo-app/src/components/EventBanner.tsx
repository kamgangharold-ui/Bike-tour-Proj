// ─── In-app event banner (Drop 2) ────────────────────────────────────────────
// Renders the current foreground real-time event (ride start, landmark approach,
// safety warning, off-route, quiz, offline…) as a top banner that auto-dismisses.
// Mounted once at the app root, below the RideBanner.

import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useEventBanner, type BannerKind } from '../store/useEventBanner';
import { useAppStore } from '../store/useAppStore';
import { OFFLINE_BANNER_HEIGHT } from './OfflineBanner';

const RIDE_BANNER_HEIGHT = 58; // keep in sync with RideBanner's row height

const STYLE: Record<BannerKind, { bg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  navigation: { bg: '#0D47A1', icon: 'navigate' },
  alert: { bg: '#B71C1C', icon: 'warning' },
  info: { bg: '#37474F', icon: 'information-circle' },
};

export default function EventBanner() {
  const insets = useSafeAreaInsets();
  const banner = useEventBanner((s) => s.banner);
  const clear = useEventBanner((s) => s.clear);
  const rideActive = useAppStore((s) => s.rideActive);
  const isOnline = useAppStore((s) => s.isOnline);
  const pathname = usePathname();
  const slide = useRef(new Animated.Value(-120)).current;

  // Stack below the offline banner and the live RideBanner (both pinned to the
  // top) so banners never overlap. RideBanner is hidden on the Ride tab.
  const rideVisible = rideActive && !(pathname?.includes('/ride') ?? false);
  const top =
    insets.top + 8 + (isOnline ? 0 : OFFLINE_BANNER_HEIGHT) + (rideVisible ? RIDE_BANNER_HEIGHT : 0);

  useEffect(() => {
    if (!banner) return;
    const id = banner.id;
    Animated.timing(slide, { toValue: 0, duration: 220, useNativeDriver: true }).start();
    const t = setTimeout(() => {
      Animated.timing(slide, { toValue: -120, duration: 220, useNativeDriver: true }).start(() => clear(id));
    }, banner.kind === 'alert' ? 6000 : 4000);
    return () => clearTimeout(t);
  }, [banner, slide, clear]);

  if (!banner) return null;
  const s = STYLE[banner.kind];

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.wrap, { top, transform: [{ translateY: slide }] }]}
    >
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => clear(banner.id)}
        style={[styles.banner, { backgroundColor: s.bg }]}
      >
        <Ionicons name={s.icon} size={20} color="#fff" />
        <View style={styles.textWrap}>
          <Text style={styles.title} numberOfLines={1}>{banner.title}</Text>
          {!!banner.body && <Text style={styles.body} numberOfLines={2}>{banner.body}</Text>}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 12, right: 12, zIndex: 1200 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  textWrap: { flex: 1 },
  title: { color: '#fff', fontSize: 14, fontWeight: '800' },
  body: { color: '#E8E8E8', fontSize: 12, marginTop: 1 },
});
