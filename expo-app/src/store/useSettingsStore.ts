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
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      avoidNoCyclingZones: true,
      setAvoidNoCyclingZones: (value) => set({ avoidNoCyclingZones: value }),
    }),
    {
      name: 'cycleguide-settings',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ avoidNoCyclingZones: s.avoidNoCyclingZones }),
    },
  ),
);
