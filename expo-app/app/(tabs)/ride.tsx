import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../src/firebase/config';
import { useAppStore } from '../../src/store/useAppStore';
import { endRideAndSave } from '../../src/utils/rides';

interface Tour {
  id: string;
  name: string;
  description: string;
  location_slugs: string[];
  distance_km: number;
  est_minutes: number;
}

function fmtElapsed(s: number): string {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
function fmtKm(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}

export default function RideScreen() {
  const router = useRouter();
  const rideActive = useAppStore((s) => s.rideActive);
  const rideMode = useAppStore((s) => s.rideMode);
  const rideTourId = useAppStore((s) => s.rideTourId);
  const rideTargetSlug = useAppStore((s) => s.rideTargetSlug);
  const rideTourStops = useAppStore((s) => s.rideTourStops);
  const rideVisited = useAppStore((s) => s.rideVisited);
  const rideDistanceMeters = useAppStore((s) => s.rideDistanceMeters);
  const rideStartedAt = useAppStore((s) => s.rideStartedAt);
  const startRide = useAppStore((s) => s.startRide);
  const setTourPreview = useAppStore((s) => s.setTourPreview);
  const insets = useSafeAreaInsets();

  const [tours, setTours] = useState<Tour[]>([]);
  const [locNames, setLocNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [elapsed, setElapsed] = useState(0);

  // Load curated tours + landmark names from Firestore.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [tourSnap, locSnap] = await Promise.all([
          getDocs(query(collection(db, 'tours'), where('is_active', '==', true))),
          getDocs(query(collection(db, 'locations'), where('is_active', '==', true))),
        ]);
        if (cancelled) return;
        setTours(
          tourSnap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              name: (data['name'] as string) ?? 'Tour',
              description: (data['description'] as string) ?? '',
              location_slugs: (data['location_slugs'] as string[]) ?? [],
              distance_km: (data['distance_km'] as number) ?? 0,
              est_minutes: (data['est_minutes'] as number) ?? 0,
            };
          }),
        );
        const names = new Map<string, string>();
        locSnap.docs.forEach((d) => {
          const data = d.data();
          names.set((data['slug'] as string) ?? d.id, (data['name'] as string) ?? '');
        });
        setLocNames(names);
      } catch (e) {
        console.warn('[Ride] load failed', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Elapsed ticker while active.
  useEffect(() => {
    if (!rideActive) { setElapsed(0); return; }
    const id = setInterval(
      () => setElapsed(Math.max(0, Math.floor((Date.now() - rideStartedAt) / 1000))),
      1000,
    );
    return () => clearInterval(id);
  }, [rideActive, rideStartedAt]);

  const activeTour = useMemo(
    () => tours.find((t) => t.id === rideTourId) ?? null,
    [tours, rideTourId],
  );

  const handleEnd = () => {
    void endRideAndSave().then((summary) => {
      // Cast: typed-routes manifest regenerates on Metro start to include /recap.
      if (summary) router.push('/recap' as Href);
    });
  };

  // ── Active ride dashboard ─────────────────────────────────────────────────────
  if (rideActive) {
    const targetName =
      rideMode === 'tour' && rideTargetSlug
        ? locNames.get(rideTargetSlug) ?? rideTargetSlug
        : null;
    return (
      <ScrollView style={styles.container} contentContainerStyle={[styles.inner, styles.innerCentered, { paddingTop: insets.top + 20 }]}>
        <View style={styles.activeCard}>
          <View style={styles.activeHeader}>
            <Ionicons name="bicycle" size={22} color="#00C853" />
            <Text style={styles.activeTitle}>
              {rideMode === 'tour' ? activeTour?.name ?? 'Guided Tour' : 'Free ride'}
            </Text>
          </View>

          {rideMode === 'tour' ? (
            <Text style={styles.nextStop}>
              {targetName ? `Next stop: ${targetName}` : 'Tour complete 🎉'}
            </Text>
          ) : (
            <Text style={styles.nextStop}>Heading to the nearest landmark</Text>
          )}

          <View style={styles.metricsRow}>
            <Metric icon="time-outline" label="Elapsed" value={fmtElapsed(elapsed)} />
            <Metric icon="navigate-outline" label="Ridden" value={fmtKm(rideDistanceMeters)} />
            <Metric
              icon="flag-outline"
              label="Seen"
              value={
                rideMode === 'tour'
                  ? `${rideVisited.length}/${rideTourStops.length}`
                  : String(rideVisited.length)
              }
            />
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.mapBtn} onPress={() => router.push('/(tabs)/map')}>
              <Ionicons name="map-outline" size={18} color="#000" />
              <Text style={styles.mapBtnText}> View on Map</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.endBtn} onPress={handleEnd}>
              <Ionicons name="stop-circle" size={18} color="#fff" />
              <Text style={styles.endText}> End Ride</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    );
  }

  // ── Start screen ──────────────────────────────────────────────────────────────
  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.inner, styles.innerCentered, { paddingTop: insets.top + 20 }]}>
      <Text style={styles.heading}>Guided Ride</Text>
      <Text style={styles.subheading}>Hands-free landmark audio + turn-toward directions.</Text>

      <TouchableOpacity style={styles.freeBtn} onPress={() => startRide({ mode: 'free' })}>
        <Ionicons name="bicycle" size={20} color="#000" />
        <Text style={styles.freeBtnText}> Start free ride</Text>
      </TouchableOpacity>

      <Text style={styles.sectionLabel}>Curated tours</Text>

      {loading ? (
        <ActivityIndicator color="#00C853" style={{ marginTop: 24 }} />
      ) : tours.length === 0 ? (
        <Text style={styles.empty}>No tours yet. Start a free ride to explore nearby landmarks.</Text>
      ) : (
        tours.map((tour) => (
          <TouchableOpacity
            key={tour.id}
            style={styles.tourCard}
            onPress={() => {
              setTourPreview({
                tourId: tour.id,
                tourName: tour.name,
                slugs: tour.location_slugs,
                distanceKm: tour.distance_km,
                estMinutes: tour.est_minutes,
              });
              router.push('/(tabs)/map');
            }}
          >
            <View style={styles.tourHeader}>
              <Text style={styles.tourName}>{tour.name}</Text>
              <Ionicons name="chevron-forward" size={18} color="#00C853" />
            </View>
            {tour.description ? <Text style={styles.tourDesc} numberOfLines={2}>{tour.description}</Text> : null}
            <Text style={styles.tourMeta}>
              {tour.distance_km > 0 ? `${tour.distance_km} km · ` : ''}
              {tour.est_minutes > 0 ? `${tour.est_minutes} min · ` : ''}
              {tour.location_slugs.length} stops
            </Text>
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
}

function Metric({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Ionicons name={icon} size={18} color="#1565C0" />
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  inner: { padding: 20 },
  innerCentered: { flexGrow: 1, justifyContent: 'center' },
  heading: { fontSize: 26, fontWeight: '800', color: '#fff', marginBottom: 6 },
  subheading: { fontSize: 14, color: '#9E9E9E', marginBottom: 24, lineHeight: 20 },
  freeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00C853',
    borderRadius: 12,
    paddingVertical: 16,
    marginBottom: 28,
  },
  freeBtnText: { fontSize: 16, fontWeight: '800', color: '#000' },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: '#666', letterSpacing: 0.5, marginBottom: 12, textTransform: 'uppercase' },
  empty: { color: '#777', fontSize: 14, lineHeight: 20 },
  tourCard: { backgroundColor: '#1E1E1E', borderRadius: 12, padding: 16, marginBottom: 12 },
  tourHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  tourName: { fontSize: 16, fontWeight: '700', color: '#fff', flex: 1 },
  tourDesc: { fontSize: 13, color: '#B0B0B0', lineHeight: 18, marginBottom: 8 },
  tourMeta: { fontSize: 12, color: '#00C853', fontWeight: '600' },

  activeCard: { backgroundColor: '#1E1E1E', borderRadius: 16, padding: 20 },
  activeHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  activeTitle: { fontSize: 20, fontWeight: '800', color: '#fff', flex: 1 },
  nextStop: { fontSize: 15, color: '#00C853', fontWeight: '600', marginBottom: 20 },
  metricsRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  metric: { flex: 1, backgroundColor: '#121212', borderRadius: 12, paddingVertical: 14, alignItems: 'center', gap: 4 },
  metricValue: { fontSize: 18, fontWeight: '800', color: '#fff' },
  metricLabel: { fontSize: 11, color: '#666' },
  hint: { fontSize: 12, color: '#777', marginBottom: 20 },
  actionRow: { flexDirection: 'row', gap: 12 },
  mapBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00C853',
    borderRadius: 12,
    paddingVertical: 14,
  },
  mapBtnText: { fontSize: 14, fontWeight: '800', color: '#000' },
  endBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#C62828',
    borderRadius: 12,
    paddingVertical: 14,
  },
  endText: { fontSize: 14, fontWeight: '800', color: '#fff' },
});
