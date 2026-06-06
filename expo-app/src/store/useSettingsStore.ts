import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { type AppLocale, deviceDefaultLocale } from '../utils/locale';

// Persisted user settings (AsyncStorage). Group A introduces the routing-safety
// gate; later groups (esp. the Settings screen) extend this store with more
// toggles. New fields merge over these defaults on rehydrate.
interface SettingsState {
  // Cycling & routing — when ON, computed routes (single + multi-stop tour) are
  // checked against Barcelona's no-cycling / dismount zones; crossings are
  // flagged with a warning and painted red. Default ON.
  avoidNoCyclingZones: boolean;
  setAvoidNoCyclingZones: (value: boolean) => void;
  // Voice & guidance — drives the 🔊 TTS in BikAI. Default ON.
  voiceGuidanceEnabled: boolean;
  setVoiceGuidanceEnabled: (value: boolean) => void;
  // Language for STT + TTS. Seeded from the device locale (English fallback);
  // overridable in Settings. Used for both Google STT and expo-speech.
  appLocale: AppLocale;
  setAppLocale: (value: AppLocale) => void;
  // TTS speech rate (expo-speech). Voice command "slower" lowers it. ~0.5–1.0.
  voiceRate: number;
  setVoiceRate: (value: number) => void;
  // TEMP dev-only location override (Settings) to test outside-Barcelona behavior
  // without traveling. Remove before ship. null = use real GPS.
  devLocation: { lat: number; lng: number } | null;
  setDevLocation: (value: { lat: number; lng: number } | null) => void;
  // Notifications — master switch for ALL real-time notifications (banners,
  // system notifications, ongoing ride notification). Default ON.
  notificationsEnabled: boolean;
  setNotificationsEnabled: (value: boolean) => void;
  // Gate the geofence-entry notifications specifically. Default ON.
  landmarkAlertsEnabled: boolean;
  setLandmarkAlertsEnabled: (value: boolean) => void;
  safetyAlertsEnabled: boolean;
  setSafetyAlertsEnabled: (value: boolean) => void;
  // Offline (Group C) — when ON, fetched Barcelona data is cached to AsyncStorage
  // and re-served when offline. Default ON.
  offlineCacheEnabled: boolean;
  setOfflineCacheEnabled: (value: boolean) => void;
  // Map layers — show the Bicing station overlay on the map. Default ON.
  showBicing: boolean;
  setShowBicing: (value: boolean) => void;
  // Onboarding — false until the first-launch "How to use" guide is seen/skipped.
  onboardingSeen: boolean;
  setOnboardingSeen: (value: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      avoidNoCyclingZones: true,
      setAvoidNoCyclingZones: (value) => set({ avoidNoCyclingZones: value }),
      voiceGuidanceEnabled: true,
      setVoiceGuidanceEnabled: (value) => set({ voiceGuidanceEnabled: value }),
      appLocale: deviceDefaultLocale(),
      setAppLocale: (value) => set({ appLocale: value }),
      voiceRate: 0.95,
      setVoiceRate: (value) => set({ voiceRate: value }),
      devLocation: null,
      setDevLocation: (value) => set({ devLocation: value }),
      notificationsEnabled: true,
      setNotificationsEnabled: (value) => set({ notificationsEnabled: value }),
      landmarkAlertsEnabled: true,
      setLandmarkAlertsEnabled: (value) => set({ landmarkAlertsEnabled: value }),
      safetyAlertsEnabled: true,
      setSafetyAlertsEnabled: (value) => set({ safetyAlertsEnabled: value }),
      offlineCacheEnabled: true,
      setOfflineCacheEnabled: (value) => set({ offlineCacheEnabled: value }),
      showBicing: true,
      setShowBicing: (value) => set({ showBicing: value }),
      onboardingSeen: false,
      setOnboardingSeen: (value) => set({ onboardingSeen: value }),
    }),
    {
      name: 'cycleguide-settings',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        avoidNoCyclingZones: s.avoidNoCyclingZones,
        voiceGuidanceEnabled: s.voiceGuidanceEnabled,
        notificationsEnabled: s.notificationsEnabled,
        appLocale: s.appLocale,
        voiceRate: s.voiceRate,
        // devLocation is intentionally NOT persisted — a dev-only override must
        // never survive a restart or leak into a release build.
        landmarkAlertsEnabled: s.landmarkAlertsEnabled,
        safetyAlertsEnabled: s.safetyAlertsEnabled,
        offlineCacheEnabled: s.offlineCacheEnabled,
        showBicing: s.showBicing,
        onboardingSeen: s.onboardingSeen,
      }),
    },
  ),
);
