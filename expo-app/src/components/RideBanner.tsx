// Global, always-mounted live ride banner. It hosts the single useRideGuidance
// instance (so GPS/heading subscriptions run for the whole ride) and floats over
// every screen while a ride is active — except the Ride tab, which shows its own
// dashboard. Returning null still keeps the hook alive (it runs before the return).

import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppStore } from '../store/useAppStore';
import { useRideGuidance } from '../hooks/useRideGuidance';
import * as voice from '../utils/voice';

const HIT = { top: 10, bottom: 10, left: 10, right: 10 };

function fmtDist(m: number | null): string {
  if (m == null) return '—';
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}
function fmtElapsed(s: number): string {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export default function RideBanner() {
  const rideActive = useAppStore((s) => s.rideActive);
  const endRide = useAppStore((s) => s.endRide);
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const guidance = useRideGuidance(); // must run unconditionally while mounted
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    void voice.getMuted().then(setMuted);
  }, [rideActive]);

  // Hide the UI on the Ride tab (own dashboard) and when no ride is active —
  // the hook above keeps running regardless.
  if (!rideActive || (pathname?.includes('/ride') ?? false)) return null;

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    void voice.setMuted(next);
  };
  const handleEnd = () => {
    voice.stop();
    endRide();
  };

  const hasTarget = guidance.targetName != null;

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
      <View style={styles.row} pointerEvents="auto">
        <View style={styles.badge}>
          <Ionicons
            name={hasTarget ? 'navigate' : 'bicycle'}
            size={20}
            color="#fff"
            style={hasTarget ? { transform: [{ rotate: `${guidance.arrowRotation}deg` }] } : undefined}
          />
        </View>
        <View style={styles.info}>
          <Text style={styles.target} numberOfLines={1}>
            {guidance.targetName ?? 'Free ride'}
          </Text>
          <Text style={styles.sub} numberOfLines={1}>
            {hasTarget
              ? `${fmtDist(guidance.distanceToTargetM)}${guidance.headingLabel ? ` · head ${guidance.headingLabel}` : ''} · ${fmtElapsed(guidance.elapsedSec)} · ${guidance.visitedCount} seen`
              : `${fmtElapsed(guidance.elapsedSec)} · ${fmtDist(guidance.distanceTraveledM)} ridden · ${guidance.visitedCount} seen`}
          </Text>
        </View>
        <TouchableOpacity onPress={toggleMute} style={styles.iconBtn} hitSlop={HIT}>
          <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={20} color={muted ? '#cfd8dc' : '#fff'} />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleEnd} style={styles.endBtn} hitSlop={HIT}>
          <Text style={styles.endText}>End</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 12, zIndex: 1000 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1B5E20',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  badge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#ffffff22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1 },
  target: { color: '#fff', fontSize: 15, fontWeight: '700' },
  sub: { color: '#E8F5E9', fontSize: 12, marginTop: 1 },
  iconBtn: { padding: 4 },
  endBtn: { backgroundColor: '#ffffff22', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  endText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
