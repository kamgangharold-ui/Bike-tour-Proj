// ─── First-launch "How to use" guide ──────────────────────────────────────────
// 4 swipeable, skippable screens shown once on first launch (gated by the persisted
// onboardingSeen flag) and re-openable from Settings (?reopen=1). Localized via
// i18n. Uses a horizontal paging ScrollView — no extra dependency.

import { useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions,
  type NativeSyntheticEvent, type NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../src/store/useSettingsStore';

const { width } = Dimensions.get('window');
const HIT = { top: 12, bottom: 12, left: 12, right: 12 };

const SLIDES: { icon: keyof typeof Ionicons.glyphMap; key: string }[] = [
  { icon: 'map', key: 's1' },        // map + automatic landmark alerts
  { icon: 'bicycle', key: 's2' },    // start a Guided Ride
  { icon: 'mic', key: 's3' },        // tap-to-talk voice
  { icon: 'language', key: 's4' },   // change language
];

export default function Onboarding() {
  const { t } = useTranslation();
  const { reopen } = useLocalSearchParams<{ reopen?: string }>();
  const setOnboardingSeen = useSettingsStore((s) => s.setOnboardingSeen);
  const scrollRef = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);
  const last = page === SLIDES.length - 1;

  const finish = () => {
    setOnboardingSeen(true);
    if (reopen) router.back();
    else router.replace('/(tabs)/map');
  };
  const next = () => {
    if (last) { finish(); return; }
    const p = page + 1;
    scrollRef.current?.scrollTo({ x: width * p, animated: true });
    setPage(p);
  };
  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const p = Math.round(e.nativeEvent.contentOffset.x / width);
    if (p !== page) setPage(p);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topRow}>
        <TouchableOpacity onPress={finish} hitSlop={HIT}>
          <Text style={styles.skip}>{t('onboarding.skip')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        scrollEventThrottle={16}
      >
        {SLIDES.map((s) => (
          <View key={s.key} style={[styles.slide, { width }]}>
            <View style={styles.iconWrap}>
              <Ionicons name={s.icon} size={64} color="#00C853" />
            </View>
            <Text style={styles.title}>{t(`onboarding.${s.key}Title`)}</Text>
            <Text style={styles.body}>{t(`onboarding.${s.key}Body`)}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.dots}>
        {SLIDES.map((_, i) => (
          <View key={i} style={[styles.dot, i === page && styles.dotActive]} />
        ))}
      </View>
      <TouchableOpacity style={styles.cta} onPress={next} activeOpacity={0.85}>
        <Text style={styles.ctaText}>{last ? t('onboarding.done') : t('onboarding.next')}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#121212' },
  topRow: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 20, paddingTop: 8, height: 36 },
  skip: { color: '#9E9E9E', fontSize: 15, fontWeight: '600' },
  slide: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36, gap: 20 },
  iconWrap: {
    width: 128, height: 128, borderRadius: 64, backgroundColor: '#00C85318',
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  title: { color: '#fff', fontSize: 24, fontWeight: '800', textAlign: 'center' },
  body: { color: '#B0B0B0', fontSize: 16, lineHeight: 24, textAlign: 'center' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 16 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#3A3A3A' },
  dotActive: { backgroundColor: '#00C853', width: 22 },
  cta: {
    backgroundColor: '#00C853', borderRadius: 14, paddingVertical: 16,
    marginHorizontal: 24, marginBottom: 16, alignItems: 'center',
  },
  ctaText: { color: '#0A0A0A', fontSize: 16, fontWeight: '800' },
});
