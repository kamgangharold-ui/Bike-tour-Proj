import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { signOut, onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot, collection, query, where, DocumentData } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../../src/firebase/config';
import { useAppStore } from '../../src/store/useAppStore';
import { loadRideHistory, clearRideHistory } from '../../src/utils/rideHistory';

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

export default function ProfileScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<DocumentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [rides, setRides] = useState<{ count: number; km: number }>({ count: 0, km: 0 });
  const setSubscribed = useAppStore((s) => s.setSubscribed);
  const rideHistory = useAppStore((s) => s.rideHistory);
  const setRideHistory = useAppStore((s) => s.setRideHistory);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  // Hydrate the local ride history (Group B) for the list below.
  useEffect(() => {
    void loadRideHistory().then(setRideHistory);
  }, [setRideHistory]);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      const data = snap.data() ?? null;
      setProfile(data);
      setSubscribed((data?.['subscription_status'] as string) === 'active');
    });
    return unsub;
  }, [user, setSubscribed]);

  useEffect(() => {
    if (!user) { setRides({ count: 0, km: 0 }); return; }
    const ridesQuery = query(collection(db, 'rides'), where('user_uid', '==', user.uid));
    const unsub = onSnapshot(
      ridesQuery,
      (snap) => {
        let km = 0;
        snap.docs.forEach((d) => { km += (d.data()['distance_km'] as number) ?? 0; });
        setRides({ count: snap.size, km: Math.round(km * 10) / 10 });
      },
      (e) => console.warn('[Profile] rides listener', e),
    );
    return unsub;
  }, [user]);

  const handleSignOut = async () => {
    const store = useAppStore.getState();
    store.endRide();         // drop any active ride so its banner can't linger on /auth
    store.setLastRide(null); // don't carry this user's recap into the next session
    store.setRideHistory([]); // and don't expose this user's history to the next account
    void clearRideHistory();
    try {
      await signOut(auth);
    } finally {
      router.replace('/auth');
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#00C853" />
      </View>
    );
  }

  const points = (profile?.['total_points'] as number) ?? 0;
  const visited = ((profile?.['visited_location_slugs'] as string[]) ?? []).length;
  const subStatus = (profile?.['subscription_status'] as string) ?? 'free';
  const isPremium = subStatus === 'active';
  const displayName = user?.isAnonymous
    ? 'Guest Cyclist'
    : user?.displayName ?? user?.email ?? 'Cyclist';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.inner}>
      {/* Avatar */}
      <View style={styles.avatarRow}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={40} color="#00C853" />
        </View>
        <Text style={styles.name}>{displayName}</Text>
        <View
          style={[
            styles.chip,
            isPremium
              ? { borderColor: '#00C853', backgroundColor: '#00C85322' }
              : { borderColor: '#666', backgroundColor: '#66666622' },
          ]}
        >
          <Ionicons
            name={isPremium ? 'star' : 'star-outline'}
            size={12}
            color={isPremium ? '#00C853' : '#666'}
          />
          <Text style={[styles.chipText, { color: isPremium ? '#00C853' : '#666' }]}>
            {' '}{isPremium ? 'Premium' : 'Free Plan'}
          </Text>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Ionicons name="trophy" size={28} color="#00C853" />
          <Text style={[styles.statValue, { color: '#00C853' }]}>{points}</Text>
          <Text style={styles.statLabel}>Points</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="location" size={28} color="#1565C0" />
          <Text style={[styles.statValue, { color: '#1565C0' }]}>{visited}</Text>
          <Text style={styles.statLabel}>Visited</Text>
        </View>
      </View>

      {/* Ride history */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Ionicons name="bicycle" size={28} color="#00C853" />
          <Text style={[styles.statValue, { color: '#00C853' }]}>{rides.count}</Text>
          <Text style={styles.statLabel}>Rides</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="speedometer" size={28} color="#1565C0" />
          <Text style={[styles.statValue, { color: '#1565C0' }]}>{rides.km}</Text>
          <Text style={styles.statLabel}>km ridden</Text>
        </View>
      </View>

      {/* Ride history (Group B) */}
      {rideHistory.length > 0 && (
        <View style={styles.historySection}>
          <Text style={styles.historyTitle}>RIDE HISTORY</Text>
          {rideHistory.map((r) => (
            <TouchableOpacity
              key={r.id}
              style={styles.historyRow}
              onPress={() => router.push({ pathname: '/recap', params: { id: r.id } })}
            >
              <Ionicons name={r.mode === 'tour' ? 'flag' : 'bicycle'} size={18} color="#00C853" />
              <View style={styles.historyInfo}>
                <Text style={styles.historyDate}>{fmtDay(r.endedAt)}</Text>
                <Text style={styles.historyStats}>
                  {fmtKm(r.distanceMeters)} · {fmtDur(r.durationSec)} · {r.visitedSlugs.length} seen
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#555" />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Upgrade */}
      {!isPremium && (
        <TouchableOpacity style={styles.upgradeBtn}>
          <Ionicons name="star" size={16} color="#000" />
          <Text style={styles.upgradeBtnText}> Upgrade to Premium</Text>
        </TouchableOpacity>
      )}

      {/* Sign out */}
      <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
        <Ionicons name="log-out-outline" size={16} color="#EF5350" />
        <Text style={styles.signOutText}> Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  inner: { padding: 24, alignItems: 'center' },
  centered: { flex: 1, backgroundColor: '#121212', justifyContent: 'center', alignItems: 'center' },
  avatarRow: { alignItems: 'center', marginBottom: 28 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#00C85322',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  name: { fontSize: 20, fontWeight: '600', color: '#fff', marginBottom: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  chipText: { fontSize: 12, fontWeight: '600' },
  statsRow: { flexDirection: 'row', gap: 16, width: '100%', marginBottom: 28 },
  historySection: { width: '100%', marginBottom: 20 },
  historyTitle: { fontSize: 12, fontWeight: '700', color: '#666', letterSpacing: 0.6, marginBottom: 8, marginLeft: 4 },
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
  statCard: {
    flex: 1,
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    gap: 6,
  },
  statValue: { fontSize: 28, fontWeight: '700' },
  statLabel: { fontSize: 12, color: '#666' },
  upgradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00C853',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 24,
    width: '100%',
    justifyContent: 'center',
    marginBottom: 16,
  },
  upgradeBtnText: { fontSize: 15, fontWeight: '700', color: '#000' },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#EF5350',
    paddingVertical: 14,
    paddingHorizontal: 24,
    width: '100%',
    justifyContent: 'center',
  },
  signOutText: { fontSize: 15, fontWeight: '600', color: '#EF5350' },
});
