import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { signOut } from 'firebase/auth';
import { collection, query, where, getDocs, deleteDoc, doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../src/firebase/config';
import { useSettingsStore } from '../src/store/useSettingsStore';
import { useAppStore } from '../src/store/useAppStore';
import { clearCache, getCacheInfo } from '../src/utils/offlineCache';

// Placeholder until a real hosted Terms page exists.
const TERMS_URL = 'https://example.com/cycleguide/terms';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtWhen(ms: number): string {
  const d = new Date(ms);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${hh}:${mm}`;
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();

  // ── Settings (persisted) ──
  const avoidNoCyclingZones = useSettingsStore((s) => s.avoidNoCyclingZones);
  const setAvoidNoCyclingZones = useSettingsStore((s) => s.setAvoidNoCyclingZones);
  const voiceGuidanceEnabled = useSettingsStore((s) => s.voiceGuidanceEnabled);
  const setVoiceGuidanceEnabled = useSettingsStore((s) => s.setVoiceGuidanceEnabled);
  const landmarkAlertsEnabled = useSettingsStore((s) => s.landmarkAlertsEnabled);
  const setLandmarkAlertsEnabled = useSettingsStore((s) => s.setLandmarkAlertsEnabled);
  const safetyAlertsEnabled = useSettingsStore((s) => s.safetyAlertsEnabled);
  const setSafetyAlertsEnabled = useSettingsStore((s) => s.setSafetyAlertsEnabled);
  const offlineCacheEnabled = useSettingsStore((s) => s.offlineCacheEnabled);
  const setOfflineCacheEnabled = useSettingsStore((s) => s.setOfflineCacheEnabled);
  const showBicing = useSettingsStore((s) => s.showBicing);
  const setShowBicing = useSettingsStore((s) => s.setShowBicing);

  const isSubscribed = useAppStore((s) => s.isSubscribed);
  const setLastRide = useAppStore((s) => s.setLastRide);

  const [cacheUpdated, setCacheUpdated] = useState<number | null>(null);
  const [clearingHistory, setClearingHistory] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);
  // Read subscription straight from the user doc so this screen doesn't depend on
  // the Profile tab having mounted; seed from the store while it loads.
  const [premium, setPremium] = useState(isSubscribed);

  useEffect(() => {
    void getCacheInfo().then((i) => setCacheUpdated(i.lastUpdated));
    const uid = auth.currentUser?.uid;
    if (uid) {
      void getDoc(doc(db, 'users', uid))
        .then((snap) => {
          if (snap.exists()) setPremium((snap.data()?.['subscription_status'] as string) === 'active');
        })
        .catch(() => {});
    }
  }, []);

  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  // ── Actions ──
  const handleClearHistory = () => {
    Alert.alert(
      'Clear ride history?',
      'This permanently deletes all your saved rides. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => void clearHistory() },
      ],
    );
  };

  const clearHistory = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    setClearingHistory(true);
    try {
      const snap = await getDocs(query(collection(db, 'rides'), where('user_uid', '==', uid)));
      if (snap.empty) {
        Alert.alert('No rides to clear', 'You have no saved rides yet.');
        return;
      }
      await Promise.all(snap.docs.map((d) => deleteDoc(doc(db, 'rides', d.id))));
      setLastRide(null);
      Alert.alert('Ride history cleared', `Removed ${snap.size} ride${snap.size === 1 ? '' : 's'}.`);
    } catch (e) {
      console.warn('[settings] clear history failed', e);
      Alert.alert(
        'Could not clear history',
        'The delete was rejected (check your connection / Firestore rules) and nothing was changed.',
      );
    } finally {
      setClearingHistory(false);
    }
  };

  const handleClearCache = () => {
    Alert.alert('Clear saved offline data?', 'Cached landmarks and tours will be removed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => {
          setClearingCache(true);
          void clearCache()
            .then(() => setCacheUpdated(null))
            .finally(() => setClearingCache(false));
        },
      },
    ]);
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } finally {
      router.replace('/auth');
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
    >
      <Section title="Cycling & routing">
        <ToggleRow
          icon="warning-outline"
          label="Avoid no-cycling & fine zones"
          sublabel="Warn and reroute around dismount / prohibited areas"
          value={avoidNoCyclingZones}
          onValueChange={setAvoidNoCyclingZones}
        />
      </Section>

      <Section title="Voice & guidance">
        <ToggleRow
          icon="volume-high-outline"
          label="Voice guidance"
          sublabel="Read BikAI replies aloud"
          value={voiceGuidanceEnabled}
          onValueChange={setVoiceGuidanceEnabled}
        />
      </Section>

      <Section title="Notifications">
        <ToggleRow
          icon="notifications-outline"
          label="Landmark alerts"
          sublabel="Notify when you reach a landmark"
          value={landmarkAlertsEnabled}
          onValueChange={setLandmarkAlertsEnabled}
        />
        <ToggleRow
          icon="alert-circle-outline"
          label="Safety & regulatory alerts"
          sublabel="Dismount zones, fines and warnings"
          value={safetyAlertsEnabled}
          onValueChange={setSafetyAlertsEnabled}
        />
      </Section>

      <Section title="Offline">
        <ToggleRow
          icon="cloud-offline-outline"
          label="Save Barcelona data for offline"
          sublabel={
            cacheUpdated
              ? `Last updated ${fmtWhen(cacheUpdated)}`
              : 'No data cached yet'
          }
          value={offlineCacheEnabled}
          onValueChange={setOfflineCacheEnabled}
        />
        <ActionRow
          icon="trash-outline"
          label="Clear cached data"
          onPress={handleClearCache}
          busy={clearingCache}
        />
      </Section>

      <Section title="Map layers">
        <ToggleRow
          icon="bicycle-outline"
          label="Bicing stations"
          sublabel="Show the city bike-share overlay"
          value={showBicing}
          onValueChange={setShowBicing}
        />
      </Section>

      <Section title="Data & account">
        <ActionRow
          icon="bookmark-outline"
          label="Subscription"
          value={premium ? 'Premium' : 'Free plan'}
        />
        <ActionRow
          icon="trash-bin-outline"
          label="Clear ride history"
          onPress={handleClearHistory}
          busy={clearingHistory}
          danger
        />
        <ActionRow
          icon="log-out-outline"
          label="Sign out"
          onPress={() => void handleSignOut()}
          danger
        />
      </Section>

      <Section title="About">
        <ActionRow icon="information-circle-outline" label="App version" value={appVersion} />
        <ActionRow
          icon="document-text-outline"
          label="Terms of Service"
          onPress={() => void Linking.openURL(TERMS_URL)}
          chevron
        />
      </Section>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title.toUpperCase()}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function ToggleRow({
  icon,
  label,
  sublabel,
  value,
  onValueChange,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sublabel?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={20} color="#9E9E9E" style={styles.rowIcon} />
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        {sublabel ? <Text style={styles.rowSub}>{sublabel}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#3A3A3A', true: '#00C853' }}
        thumbColor="#fff"
        ios_backgroundColor="#3A3A3A"
      />
    </View>
  );
}

function ActionRow({
  icon,
  label,
  value,
  sublabel,
  onPress,
  danger,
  chevron,
  busy,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  sublabel?: string;
  onPress?: () => void;
  danger?: boolean;
  chevron?: boolean;
  busy?: boolean;
}) {
  const color = danger ? '#EF5350' : '#9E9E9E';
  const labelColor = danger ? '#EF5350' : '#fff';
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      disabled={!onPress || busy}
      activeOpacity={onPress ? 0.6 : 1}
    >
      <Ionicons name={icon} size={20} color={color} style={styles.rowIcon} />
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, { color: labelColor }]}>{label}</Text>
        {sublabel ? <Text style={styles.rowSub}>{sublabel}</Text> : null}
      </View>
      {busy ? (
        <ActivityIndicator color="#9E9E9E" />
      ) : value !== undefined ? (
        <Text style={styles.rowValue}>{value}</Text>
      ) : chevron || onPress ? (
        <Ionicons name="chevron-forward" size={18} color="#555" />
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  section: { marginTop: 22, paddingHorizontal: 16 },
  sectionTitle: {
    color: '#666',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: { backgroundColor: '#1E1E1E', borderRadius: 12, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#2A2A2A',
    gap: 12,
  },
  rowIcon: { width: 22, textAlign: 'center' },
  rowText: { flex: 1 },
  rowLabel: { color: '#fff', fontSize: 15, fontWeight: '500' },
  rowSub: { color: '#777', fontSize: 12, marginTop: 2 },
  rowValue: { color: '#9E9E9E', fontSize: 14, fontWeight: '600' },
});
