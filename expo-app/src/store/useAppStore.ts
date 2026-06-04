import { create } from 'zustand';

interface LandmarkData {
  activeSlug: string;
  activeName: string;
  activeDescription: string;
  activeCategory: string;
  activeIsRegulatory: boolean;
  activeRegulatoryMessage: string;
  activeRegulatoryFineEur: number;
  activeAffiliateUrl: string;
  activeAudioUrl: string;
}

export type RideMode = 'tour' | 'free';

interface RideState {
  rideActive: boolean;
  rideStartedAt: number;       // epoch ms
  rideMode: RideMode;
  rideTourId: string | null;
  rideTargetSlug: string | null;
  rideTourStops: string[];     // ordered location slugs (tour mode)
  rideVisited: string[];       // slugs visited during this ride
  rideDistanceMeters: number;
}

interface RideActions {
  startRide: (opts: { mode: RideMode; tourId?: string; stops?: string[] }) => void;
  endRide: () => void;
  setRideTarget: (slug: string | null) => void;
  markRideVisited: (slug: string) => void;
  addRideDistance: (metres: number) => void;
}

interface AppState extends LandmarkData, RideState, RideActions {
  isSubscribed: boolean;
  biciboxJson: string;
  biciparkJson: string;
  chatPrefill: string;
  enterLandmark: (data: LandmarkData) => void;
  exitLandmark: (slug: string) => void;
  setSubscribed: (val: boolean) => void;
  setBiciboxJson: (json: string) => void;
  setBiciparkJson: (json: string) => void;
  setChatPrefill: (msg: string) => void;
}

const CLEARED: LandmarkData = {
  activeSlug: '',
  activeName: '',
  activeDescription: '',
  activeCategory: '',
  activeIsRegulatory: false,
  activeRegulatoryMessage: '',
  activeRegulatoryFineEur: 0,
  activeAffiliateUrl: '',
  activeAudioUrl: '',
};

const RIDE_CLEARED: RideState = {
  rideActive: false,
  rideStartedAt: 0,
  rideMode: 'free',
  rideTourId: null,
  rideTargetSlug: null,
  rideTourStops: [],
  rideVisited: [],
  rideDistanceMeters: 0,
};

export const useAppStore = create<AppState>((set, get) => ({
  ...CLEARED,
  ...RIDE_CLEARED,
  isSubscribed: false,
  biciboxJson: '',
  biciparkJson: '',
  chatPrefill: '',
  enterLandmark: (data) => set(data),
  exitLandmark: (slug) => {
    if (get().activeSlug === slug) set(CLEARED);
  },
  setSubscribed: (val) => set({ isSubscribed: val }),
  setBiciboxJson: (json) => set({ biciboxJson: json }),
  setBiciparkJson: (json) => set({ biciparkJson: json }),
  setChatPrefill: (msg) => set({ chatPrefill: msg }),

  startRide: (opts) =>
    set({
      rideActive: true,
      rideStartedAt: Date.now(),
      rideMode: opts.mode,
      rideTourId: opts.tourId ?? null,
      rideTourStops: opts.stops ?? [],
      rideTargetSlug: opts.stops && opts.stops.length > 0 ? opts.stops[0] : null,
      rideVisited: [],
      rideDistanceMeters: 0,
    }),
  endRide: () => set({ ...RIDE_CLEARED }),
  setRideTarget: (slug) => set({ rideTargetSlug: slug }),
  markRideVisited: (slug) => {
    const s = get();
    if (!s.rideActive) return;
    const rideVisited = s.rideVisited.includes(slug)
      ? s.rideVisited
      : [...s.rideVisited, slug];
    let rideTargetSlug = s.rideTargetSlug;
    if (s.rideMode === 'tour' && slug === s.rideTargetSlug) {
      const idx = s.rideTourStops.indexOf(slug);
      rideTargetSlug =
        s.rideTourStops.slice(idx + 1).find((x) => !rideVisited.includes(x)) ?? null;
    }
    set({ rideVisited, rideTargetSlug });
  },
  addRideDistance: (metres) =>
    set({ rideDistanceMeters: get().rideDistanceMeters + Math.max(0, metres) }),
}));
