import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  ScrollView,
  TouchableOpacity,
  TextInput,
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
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  // ── Settings (persisted) ──
  const avoidNoCyclingZones = useSettingsStore((s) => s.avoidNoCyclingZones);
  const setAvoidNoCyclingZones = useSettingsStore((s) => s.setAvoidNoCyclingZones);
  const voiceGuidanceEnabled = useSettingsStore((s) => s.voiceGuidanceEnabled);
  const setVoiceGuidanceEnabled = useSettingsStore((s) => s.setVoiceGuidanceEnabled);
  const appLocale = useSettingsStore((s) => s.appLocale);
  const setAppLocale = useSettingsStore((s) => s.setAppLocale);
  const devLocation = useSettingsStore((s) => s.devLocation);
  const setDevLocation = useSettingsStore((s) => s.setDevLocation);
  const notificationsEnabled = useSettingsStore((s) => s.notificationsEnabled);
  const setNotificationsEnabled = useSettingsStore((s) => s.setNotificationsEnabled);
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

  const [devLat, setDevLat] = useState(devLocation ? String(devLocation.lat) : '');
  const [devLng, setDevLng] = useState(devLocation ? String(devLocation.lng) : '');
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
      t('settings.clearHistoryTitle'),
      t('settings.clearHistoryMessage'),
      [
        { text: t('settings.cancel'), style: 'cancel' },
        { text: t('settings.delete'), style: 'destructive', onPress: () => void clearHistory() },
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
        t('settings.historyClearedTitle'),
        total > 0 ? t('settings.historyClearedCount', { count: total }) : t('settings.historyClearedEmpty'),
      );
    } finally {
      setClearingHistory(false);
    }
  };

  const handleClearCache = () => {
    Alert.alert(t('settings.clearCacheTitle'), t('settings.clearCacheMessage'), [
      { text: t('settings.cancel'), style: 'cancel' },
      {
        text: t('settings.clear'),
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
      {/* ONE language control — drives UI + STT + TTS + AI reply together. */}
      <Section title={t('settings.sectionLanguage')}>
        <LanguageRow value={appLocale} onChange={setAppLocale} />
      </Section>

      <Section title={t('settings.sectionCyclingRouting')}>
        <ToggleRow
          icon="warning-outline"
          label={t('settings.avoidNoCyclingLabel')}
          sublabel={t('settings.avoidNoCyclingSub')}
          value={avoidNoCyclingZones}
          onValueChange={setAvoidNoCyclingZones}
        />
      </Section>

      <Section title={t('settings.sectionVoiceGuidance')}>
        <ToggleRow
          icon="volume-high-outline"
          label={t('settings.voiceGuidanceLabel')}
          sublabel={t('settings.voiceGuidanceSub')}
          value={voiceGuidanceEnabled}
          onValueChange={setVoiceGuidanceEnabled}
        />
      </Section>

      <Section title={t('settings.sectionNotifications')}>
        <ToggleRow
          icon="notifications-circle-outline"
          label={t('settings.allNotificationsLabel')}
          sublabel={t('settings.allNotificationsSub')}
          value={notificationsEnabled}
          onValueChange={setNotificationsEnabled}
        />
        <ToggleRow
          icon="notifications-outline"
          label={t('settings.landmarkAlertsLabel')}
          sublabel={t('settings.landmarkAlertsSub')}
          value={landmarkAlertsEnabled}
          onValueChange={setLandmarkAlertsEnabled}
        />
        <ToggleRow
          icon="alert-circle-outline"
          label={t('settings.safetyAlertsLabel')}
          sublabel={t('settings.safetyAlertsSub')}
          value={safetyAlertsEnabled}
          onValueChange={setSafetyAlertsEnabled}
        />
      </Section>

      <Section title={t('settings.sectionOffline')}>
        <ToggleRow
          icon="cloud-offline-outline"
          label={t('settings.offlineCacheLabel')}
          sublabel={
            cacheUpdated
              ? t('settings.offlineLastUpdated', { when: fmtWhen(cacheUpdated) })
              : t('settings.offlineNoData')
          }
          value={offlineCacheEnabled}
          onValueChange={setOfflineCacheEnabled}
        />
        <ActionRow
          icon="trash-outline"
          label={t('settings.clearCachedData')}
          onPress={handleClearCache}
          busy={clearingCache}
        />
      </Section>

      <Section title={t('settings.sectionMapLayers')}>
        <ToggleRow
          icon="bicycle-outline"
          label={t('settings.bicingStationsLabel')}
          sublabel={t('settings.bicingStationsSub')}
          value={showBicing}
          onValueChange={setShowBicing}
        />
      </Section>

      <Section title={t('settings.sectionDataAccount')}>
        <ActionRow
          icon="bookmark-outline"
          label={t('settings.subscription')}
          value={premium ? t('settings.premium') : t('settings.freePlan')}
        />
        <ActionRow
          icon="trash-bin-outline"
          label={t('settings.clearRideHistory')}
          onPress={handleClearHistory}
          busy={clearingHistory}
          danger
        />
        <ActionRow
          icon="log-out-outline"
          label={t('settings.signOut')}
          onPress={() => void handleSignOut()}
          danger
        />
      </Section>

      {__DEV__ && (
      <Section title="Developer (temporary)">
        <View style={styles.devRow}>
          <Ionicons name="bug-outline" size={20} color="#9E9E9E" style={styles.rowIcon} />
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>Location override</Text>
            <Text style={styles.rowSub}>
              {devLocation ? `Active: ${devLocation.lat.toFixed(4)}, ${devLocation.lng.toFixed(4)}` : 'Off — using real GPS'}
            </Text>
          </View>
        </View>
        <View style={styles.devInputs}>
          <TextInput
            style={styles.devInput}
            placeholder="lat (e.g. 48.8566)"
            placeholderTextColor="#666"
            value={devLat}
            onChangeText={setDevLat}
            keyboardType="numbers-and-punctuation"
            autoCorrect={false}
          />
          <TextInput
            style={styles.devInput}
            placeholder="lng (e.g. 2.3522)"
            placeholderTextColor="#666"
            value={devLng}
            onChangeText={setDevLng}
            keyboardType="numbers-and-punctuation"
            autoCorrect={false}
          />
        </View>
        <View style={styles.devBtns}>
          <TouchableOpacity
            style={[styles.devBtn, styles.devBtnApply]}
            onPress={() => {
              const la = parseFloat(devLat);
              const ln = parseFloat(devLng);
              if (Number.isFinite(la) && Number.isFinite(ln)) setDevLocation({ lat: la, lng: ln });
              else Alert.alert('Invalid', 'Enter valid numeric lat/lng.');
            }}
          >
            <Text style={styles.devBtnApplyText}>Apply override</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.devBtn, styles.devBtnClear]}
            onPress={() => { setDevLocation(null); setDevLat(''); setDevLng(''); }}
          >
            <Text style={styles.devBtnClearText}>Use real GPS</Text>
          </TouchableOpacity>
        </View>
      </Section>
      )}

      <Section title={t('settings.sectionAbout')}>
        <ActionRow icon="information-circle-outline" label={t('settings.appVersion')} value={appVersion} />
        <ActionRow
          icon="document-text-outline"
          label={t('settings.termsOfService')}
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
  const { t } = useTranslation();
  return (
    <View style={[styles.row, { flexDirection: 'column', alignItems: 'stretch', gap: 10 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Ionicons name="language-outline" size={20} color="#9E9E9E" style={styles.rowIcon} />
        <View style={styles.rowText}>
          <Text style={styles.rowLabel}>{t('settings.voiceLanguageLabel')}</Text>
          <Text style={styles.rowSub}>{t('settings.voiceLanguageSub')}</Text>
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

  devRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, gap: 12 },
  devInputs: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingBottom: 10 },
  devInput: {
    flex: 1,
    backgroundColor: '#2A2A2A',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: '#fff',
    fontSize: 13,
  },
  devBtns: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingBottom: 14 },
  devBtn: { flex: 1, borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  devBtnApply: { backgroundColor: '#1565C0' },
  devBtnApplyText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  devBtnClear: { backgroundColor: '#2A2A2A' },
  devBtnClearText: { color: '#bbb', fontWeight: '700', fontSize: 13 },
});
