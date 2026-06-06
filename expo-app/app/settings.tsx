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
import { clearRideHistory } from '../src/utils/rideHistory';
import { clearRouteCache } from '../src/utils/routeCache';
import { SUPPORTED_LOCALES, LOCALE_LABELS, type AppLocale } from '../src/utils/locale';

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
  const appLocale = useSettingsStore((s) => s.appLocale);
  const setAppLocale = useSettingsStore((s) => s.setAppLocale);
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
  const setRideHistory = useAppStore((s) => s.setRideHistory);
  const historyCount = useAppStore((s) => s.rideHistory.length);

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
    setClearingHistory(true);
    try {
      // Local history is the source of truth for the Profile list — clear it
      // first (works offline, no rules dependency).
      let firestoreCount = 0;
      await clearRideHistory();
      setRideHistory([]);
      setLastRide(null);
      // Best-effort: also remove the server-side ride docs (needs the rules
      // deploy). A failure here never blocks the local clear.
      const uid = auth.currentUser?.uid;
      if (uid) {
        try {
          const snap = await getDocs(query(collection(db, 'rides'), where('user_uid', '==', uid)));
          firestoreCount = snap.size;
          await Promise.all(snap.docs.map((d) => deleteDoc(doc(db, 'rides', d.id))));
        } catch (e) {
          console.warn('[settings] firestore clear failed (local history already cleared)', e);
        }
      }
      const total = Math.max(historyCount, firestoreCount);
      Alert.alert(
        'Ride history cleared',
        total > 0 ? `Removed ${total} ride${total === 1 ? '' : 's'}.` : 'Your ride history is now empty.',
      );
    } finally {
      setClearingHistory(false);
    }
  };

  const handleClearCache = () => {
    Alert.alert('Clear saved offline data?', 'Cached landmarks, tours and routes will be removed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => {
          setClearingCache(true);
          void Promise.all([clearCache(), clearRouteCache()])
            .then(() => setCacheUpdated(null))
            .finally(() => setClearingCache(false));
        },
      },
    ]);
  };

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
        <LanguageRow value={appLocale} onChange={setAppLocale} />
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

function LanguageRow({ value, onChange }: { value: AppLocale; onChange: (l: AppLocale) => void }) {
  return (
    <View style={[styles.row, { flexDirection: 'column', alignItems: 'stretch', gap: 10 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Ionicons name="language-outline" size={20} color="#9E9E9E" style={styles.rowIcon} />
        <View style={styles.rowText}>
          <Text style={styles.rowLabel}>Voice language</Text>
          <Text style={styles.rowSub}>Speech recognition & spoken replies</Text>
        </View>
      </View>
      <View style={styles.langChips}>
        {SUPPORTED_LOCALES.map((l) => {
          const active = l === value;
          return (
            <TouchableOpacity
              key={l}
              style={[styles.langChip, active && styles.langChipActive]}
              onPress={() => onChange(l)}
              activeOpacity={0.7}
            >
              <Text style={[styles.langChipText, active && styles.langChipTextActive]}>
                {LOCALE_LABELS[l]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
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

  langChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingLeft: 34 },
  langChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: '#2A2A2A',
    borderWidth: 1,
    borderColor: '#3A3A3A',
  },
  langChipActive: { backgroundColor: '#10301C', borderColor: '#00C853' },
  langChipText: { color: '#bbb', fontSize: 13, fontWeight: '600' },
  langChipTextActive: { color: '#00C853' },
});
