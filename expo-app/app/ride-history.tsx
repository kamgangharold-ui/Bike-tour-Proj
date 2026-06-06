// ─── Ride History screen ──────────────────────────────────────────────────────
// Dedicated screen reached by tapping the "Rides" stat card on Profile. Reuses the
// same AsyncStorage-backed ride history (Group B) and the same row → /recap?id
// navigation as the inline Profile list, just full-screen with an empty state.

import { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../src/store/useAppStore';
import { loadRideHistory } from '../src/utils/rideHistory';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtDay(ms: number): string {
  const d = new Date(ms);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
function fmtKm(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}
function fmtDur(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function RideHistoryScreen() {
  // Read live from the store (cleared on sign-out) so we never show a previous
  // account's rides, and re-hydrate from disk on mount.
  const rideHistory = useAppStore((s) => s.rideHistory);
  const setRideHistory = useAppStore((s) => s.setRideHistory);
  const { t } = useTranslation();

  useEffect(() => {
    void loadRideHistory().then(setRideHistory);
  }, [setRideHistory]);

  if (rideHistory.length === 0) {
    return (
      <View style={styles.empty}>
        <Ionicons name="bicycle-outline" size={56} color="#444" />
        <Text style={styles.emptyText}>{t('rideHistory.emptyTitle')}</Text>
        <Text style={styles.emptySub}>{t('rideHistory.emptySub')}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.inner}>
      {rideHistory.map((r) => (
        <TouchableOpacity
          key={r.id}
          style={styles.historyRow}
          activeOpacity={0.8}
          onPress={() => router.push({ pathname: '/recap', params: { id: r.id } })}
        >
          <Ionicons name={r.mode === 'tour' ? 'flag' : 'bicycle'} size={18} color="#00C853" />
          <View style={styles.historyInfo}>
            <Text style={styles.historyDate}>{fmtDay(r.endedAt)}</Text>
            <Text style={styles.historyStats}>
              {fmtKm(r.distanceMeters)} · {fmtDur(r.durationSec)} · {t('rideHistory.seenCount', { count: r.visitedSlugs.length })}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#555" />
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  inner: { padding: 16 },
  empty: { flex: 1, backgroundColor: '#121212', alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  emptyText: { color: '#9E9E9E', fontSize: 17, fontWeight: '600' },
  emptySub: { color: '#666', fontSize: 13, textAlign: 'center' },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  historyInfo: { flex: 1 },
  historyDate: { color: '#fff', fontSize: 14, fontWeight: '600' },
  historyStats: { color: '#9E9E9E', fontSize: 12, marginTop: 2 },
});
