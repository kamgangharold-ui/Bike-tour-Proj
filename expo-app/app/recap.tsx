import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Share,
  ActivityIndicator,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { collection, getDocs, query, where } from 'firebase/firestore';
import * as Sharing from 'expo-sharing';
import { db } from '../src/firebase/config';
import { useAppStore } from '../src/store/useAppStore';
import { readCache, CACHE_KEYS } from '../src/utils/offlineCache';
import { BARCELONA_CENTER } from '../constants/rules';

type Coords = { latitude: number; longitude: number };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function fmtDate(ms: number): string {
  const d = new Date(ms);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${hh}:${mm}`;
}
function fmtKm(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}
function fmtDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
}

interface Pin {
  slug: string;
  coords: Coords;
  visited: boolean;
}

export default function RecapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const lastRide = useAppStore((s) => s.lastRide);

  const mapRef = useRef<MapView>(null);
  const [coordsBySlug, setCoordsBySlug] = useState<Map<string, Coords>>(new Map());
  const [mapReady, setMapReady] = useState(false);
  const [fitted, setFitted] = useState(false);
  const [sharing, setSharing] = useState(false);

  // Safety net: onMapReady occasionally never fires on iOS Apple Maps. Ensure the
  // fit + snapshot path still becomes available after a moment.
  useEffect(() => {
    const t = setTimeout(() => setMapReady(true), 1500);
    return () => clearTimeout(t);
  }, []);

  // Resolve landmark coordinates for pins (best-effort; the recap still shows
  // stats if this fails, e.g. offline before Group C's cache lands).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const snap = await getDocs(
          query(collection(db, 'locations'), where('is_active', '==', true)),
        );
        if (cancelled) return;
        const m = new Map<string, Coords>();
        snap.docs.forEach((d) => {
          const data = d.data();
          const slug = (data['slug'] as string) ?? d.id;
          const c = data['coordinates'] as Coords | null;
          if (c && (c.latitude || c.longitude)) {
            m.set(slug, { latitude: c.latitude, longitude: c.longitude });
          }
        });
        setCoordsBySlug(m);
      } catch (e) {
        console.warn('[recap] locations fetch failed; trying cache', e);
        const cached = await readCache<{ slug: string; coordinates: Coords }[]>(
          CACHE_KEYS.locations,
        );
        if (!cancelled && cached?.data?.length) {
          const m = new Map<string, Coords>();
          cached.data.forEach((l) => {
            if (l.coordinates) m.set(l.slug, l.coordinates);
          });
          setCoordsBySlug(m);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Pins: tour stops for a tour (else visited landmarks), in order.
  const pins = useMemo<Pin[]>(() => {
    if (!lastRide) return [];
    const slugs =
      lastRide.mode === 'tour' && lastRide.tourStops.length > 0
        ? lastRide.tourStops
        : lastRide.visitedSlugs;
    const visitedSet = new Set(lastRide.visitedSlugs);
    return slugs
      .map((slug) => {
        const coords = coordsBySlug.get(slug);
        return coords ? { slug, coords, visited: visitedSet.has(slug) } : null;
      })
      .filter((p): p is Pin => p !== null);
  }, [lastRide, coordsBySlug]);

  // Route line: recorded GPS track (Group C) if present, else connect the pins.
  const routeLine = useMemo<Coords[]>(() => {
    if (lastRide?.track && lastRide.track.length >= 2) return lastRide.track;
    return pins.map((p) => p.coords);
  }, [lastRide, pins]);

  const allCoords = useMemo<Coords[]>(
    () => [...routeLine, ...pins.map((p) => p.coords)],
    [routeLine, pins],
  );

  // Fit the map once content + map are ready. `fitted` then gates the Share
  // snapshot so we never capture the initial wide region.
  useEffect(() => {
    if (!mapReady || allCoords.length === 0) return;
    if (allCoords.length === 1) {
      mapRef.current?.animateToRegion({
        ...allCoords[0],
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    } else {
      mapRef.current?.fitToCoordinates(allCoords, {
        edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
        animated: false,
      });
    }
    setFitted(true);
  }, [mapReady, allCoords]);

  if (!lastRide) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Ionicons name="bicycle" size={40} color="#555" />
        <Text style={styles.emptyText}>No recent ride to recap.</Text>
        <TouchableOpacity style={styles.doneBtn} onPress={() => router.replace('/(tabs)/map')}>
          <Text style={styles.doneBtnText}>Back to map</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const distanceStr = fmtKm(lastRide.distanceMeters);
  const durationStr = fmtDuration(lastRide.durationSec);
  const landmarkCount = lastRide.visitedSlugs.length;
  const avgSpeedStr = `${lastRide.avgSpeedKmh.toFixed(1)} km/h`;
  const dateStr = fmtDate(lastRide.endedAt);
  const caption =
    `🚴 Barcelona CycleGuide — ${distanceStr} ridden, ${durationStr}, ` +
    `${landmarkCount} landmark${landmarkCount === 1 ? '' : 's'} seen (${dateStr}).`;

  const hasMapContent = pins.length > 0 || routeLine.length >= 2;

  const handleShare = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      let snapped = false;
      // Primary: a map-image share via the built-in MapView snapshot + expo-sharing.
      // Only when there's actual map content AND the map has fitted to it — else a
      // snapshot would capture a blank/wrong-region image instead of falling back.
      // NOTE: expo-sharing shares only the image file; the stats caption can't ride
      // along with it (it reaches recipients via the text fallback below).
      try {
        if (hasMapContent && mapRef.current && mapReady && fitted && (await Sharing.isAvailableAsync())) {
          const uri = await mapRef.current.takeSnapshot({
            width: 1080,
            height: 1080,
            format: 'png',
            result: 'file',
          });
          const fileUri =
            uri.startsWith('file') || uri.startsWith('content') ? uri : `file://${uri}`;
          await Sharing.shareAsync(fileUri, {
            mimeType: 'image/png',
            dialogTitle: caption,
            UTI: 'public.png',
          });
          snapped = true;
        }
      } catch (e) {
        console.warn('[recap] snapshot share failed, falling back to text', e);
      }
      // Fallback: text summary + deep link (no image) when the snapshot is flaky.
      if (!snapped) {
        await Share.share({
          message: `${caption}\nExplore Barcelona by bike with CycleGuide.`,
        });
      }
    } catch (e) {
      console.warn('[recap] share failed', e);
    } finally {
      setSharing(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
    >
      <View style={styles.mapWrap}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          provider={PROVIDER_DEFAULT}
          mapType="standard"
          onMapReady={() => setMapReady(true)}
          initialRegion={{ ...BARCELONA_CENTER, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
          pointerEvents="none"
        >
          {routeLine.length >= 2 && (
            <Polyline coordinates={routeLine} strokeColor="#00C853" strokeWidth={5} />
          )}
          {pins.map((p, i) => (
            <Marker
              key={`${p.slug}-${i}`}
              coordinate={p.coords}
              pinColor={p.visited ? '#00C853' : '#C62828'}
            />
          ))}
        </MapView>
        {pins.length === 0 && routeLine.length < 2 && (
          <View style={styles.mapEmpty} pointerEvents="none">
            <Text style={styles.mapEmptyText}>Map preview unavailable</Text>
          </View>
        )}
      </View>

      <View style={styles.body}>
        <Text style={styles.title}>
          {lastRide.mode === 'tour' ? 'Tour complete' : 'Ride complete'} 🎉
        </Text>
        <Text style={styles.date}>{dateStr}</Text>

        <View style={styles.statsRow}>
          <Stat icon="navigate-outline" label="Distance" value={distanceStr} />
          <Stat icon="time-outline" label="Duration" value={durationStr} />
        </View>
        <View style={styles.statsRowLast}>
          <Stat icon="speedometer-outline" label="Avg speed" value={avgSpeedStr} />
          <Stat icon="flag-outline" label="Landmarks" value={String(landmarkCount)} />
        </View>

        <TouchableOpacity
          style={[styles.shareBtn, (sharing || (hasMapContent && !fitted)) && styles.shareBtnDisabled]}
          onPress={() => void handleShare()}
          disabled={sharing || (hasMapContent && !fitted)}
        >
          {sharing ? (
            <ActivityIndicator color="#000" />
          ) : (
            <>
              <Ionicons name="share-social" size={18} color="#000" />
              <Text style={styles.shareBtnText}> Share recap</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.doneBtn} onPress={() => router.replace('/(tabs)/map')}>
          <Text style={styles.doneBtnText}>Done</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={18} color="#1565C0" />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  centered: { justifyContent: 'center', alignItems: 'center', gap: 12, padding: 24 },
  emptyText: { color: '#9E9E9E', fontSize: 15 },

  mapWrap: { height: 320, backgroundColor: '#1E1E1E' },
  mapEmpty: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  mapEmptyText: { color: '#777', fontSize: 13 },

  body: { padding: 20 },
  title: { fontSize: 24, fontWeight: '800', color: '#fff', marginBottom: 4 },
  date: { fontSize: 13, color: '#9E9E9E', marginBottom: 20 },

  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  statsRowLast: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  stat: {
    flex: 1,
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 4,
  },
  statValue: { fontSize: 18, fontWeight: '800', color: '#fff' },
  statLabel: { fontSize: 11, color: '#666' },

  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00C853',
    borderRadius: 12,
    paddingVertical: 16,
    marginBottom: 12,
    minHeight: 52,
  },
  shareBtnDisabled: { opacity: 0.5 },
  shareBtnText: { fontSize: 16, fontWeight: '800', color: '#000' },
  doneBtn: { alignItems: 'center', paddingVertical: 14 },
  doneBtnText: { color: '#00C853', fontSize: 15, fontWeight: '700' },
});
