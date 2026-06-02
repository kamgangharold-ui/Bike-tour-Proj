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
import { doc, onSnapshot, DocumentData } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../../src/firebase/config';
import { useAppStore } from '../../src/store/useAppStore';

export default function ProfileScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<DocumentData | null>(null);
  const [loading, setLoading] = useState(true);
  const setSubscribed = useAppStore((s) => s.setSubscribed);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      const data = snap.data() ?? null;
      setProfile(data);
      setSubscribed((data?.['subscription_status'] as string) === 'active');
    });
    return unsub;
  }, [user, setSubscribed]);

  const handleSignOut = async () => {
    await signOut(auth);
    router.replace('/auth');
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
