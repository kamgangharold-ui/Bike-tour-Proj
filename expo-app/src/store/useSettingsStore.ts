import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  // Notifications — gate the geofence-entry notifications. Default ON.
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
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      avoidNoCyclingZones: true,
      setAvoidNoCyclingZones: (value) => set({ avoidNoCyclingZones: value }),
      voiceGuidanceEnabled: true,
      setVoiceGuidanceEnabled: (value) => set({ voiceGuidanceEnabled: value }),
      landmarkAlertsEnabled: true,
      setLandmarkAlertsEnabled: (value) => set({ landmarkAlertsEnabled: value }),
      safetyAlertsEnabled: true,
      setSafetyAlertsEnabled: (value) => set({ safetyAlertsEnabled: value }),
      offlineCacheEnabled: true,
      setOfflineCacheEnabled: (value) => set({ offlineCacheEnabled: value }),
      showBicing: true,
      setShowBicing: (value) => set({ showBicing: value }),
    }),
    {
      name: 'cycleguide-settings',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        avoidNoCyclingZones: s.avoidNoCyclingZones,
        voiceGuidanceEnabled: s.voiceGuidanceEnabled,
        landmarkAlertsEnabled: s.landmarkAlertsEnabled,
        safetyAlertsEnabled: s.safetyAlertsEnabled,
        offlineCacheEnabled: s.offlineCacheEnabled,
        showBicing: s.showBicing,
      }),
    },
  ),
);
