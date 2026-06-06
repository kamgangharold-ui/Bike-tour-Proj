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

export interface TourPreview {
  tourId: string;
  tourName: string;
  slugs: string[];
  distanceKm: number;
  estMinutes: number;
}

// A throttled GPS sample recorded during a ride.
export interface TrackPoint {
  latitude: number;
  longitude: number;
  t: number; // epoch ms
}

// Snapshot of a finished ride, captured at End Ride for the shareable recap.
export interface RideSummary {
  startedAt: number; // epoch ms
  endedAt: number;   // epoch ms
  durationSec: number;
  distanceMeters: number;
  avgSpeedKmh: number;
  mode: RideMode;
  tourId: string | null;
  tourStops: string[];     // ordered slugs (tour mode)
  visitedSlugs: string[];
  // Recorded GPS path (Group C). The recap draws it when present, else falls
  // back to a line through the visited / tour-stop coordinates.
  track?: { latitude: number; longitude: number }[];
}

// A finished ride persisted to local history (Group B). `id` keys the recap.
export interface RideRecord extends RideSummary {
  id: string;
}

// A chosen free-ride destination: a curated landmark (slug) or a dropped map
// point (slug = null). Drives the route + bearing guidance for a free ride.
export interface FreeTarget {
  slug: string | null;
  lat: number;
  lng: number;
  name: string;
}

interface RideState {
  rideActive: boolean;
  rideStartedAt: number;       // epoch ms
  rideMode: RideMode;
  rideTourId: string | null;
  rideTargetSlug: string | null;
  rideTourStops: string[];     // ordered location slugs (tour mode)
  rideVisited: string[];       // slugs visited during this ride
  rideDistanceMeters: number;
  rideTrack: TrackPoint[];     // throttled GPS path for this ride
  rideFreeTarget: FreeTarget | null; // chosen free-ride destination (null = nearest)
}

interface RideActions {
  startRide: (opts: { mode: RideMode; tourId?: string; stops?: string[]; freeTarget?: FreeTarget }) => void;
  endRide: () => void;
  setRideTarget: (slug: string | null) => void;
  setRideFreeTarget: (target: FreeTarget | null) => void;
  markRideVisited: (slug: string) => void;
  addRideDistance: (metres: number) => void;
  appendTrackPoint: (p: TrackPoint) => void;
}

interface AppState extends LandmarkData, RideState, RideActions {
  isSubscribed: boolean;
  // Live connectivity (driven by expo-network); read by the offline banner.
  isOnline: boolean;
  setOnline: (val: boolean) => void;
  biciboxJson: string;
  biciparkJson: string;
  chatPrefill: string;
  // Voice navigation hand-off: chat sets a destination query → the map consumes it
  // and starts turn-by-turn (so "guide me to X" in chat runs real navigation).
  navRequest: string | null;
  setNavRequest: (q: string | null) => void;
  // Live GPS position — single source of truth shared by the map + AI chat.
  userLat: number | null;
  userLng: number | null;
  // Tour preview: set when tapping a tour card; map reads this to show the route.
  tourPreview: TourPreview | null;
  // Last finished ride, set at End Ride; read by the recap screen.
  lastRide: RideSummary | null;
  // Local ride history (Group B), newest first; powers the Profile list.
  rideHistory: RideRecord[];
  enterLandmark: (data: LandmarkData) => void;
  exitLandmark: (slug: string) => void;
  setSubscribed: (val: boolean) => void;
  setBiciboxJson: (json: string) => void;
  setBiciparkJson: (json: string) => void;
  setChatPrefill: (msg: string) => void;
  setUserCoords: (lat: number, lng: number) => void;
  setTourPreview: (p: TourPreview) => void;
  clearTourPreview: () => void;
  setLastRide: (summary: RideSummary | null) => void;
  setRideHistory: (list: RideRecord[]) => void;
  addRideRecord: (record: RideRecord) => void;
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
  rideTrack: [],
  rideFreeTarget: null,
};

export const useAppStore = create<AppState>((set, get) => ({
  ...CLEARED,
  ...RIDE_CLEARED,
  isSubscribed: false,
  isOnline: true,
  setOnline: (val) => set({ isOnline: val }),
  biciboxJson: '',
  biciparkJson: '',
  chatPrefill: '',
  navRequest: null,
  setNavRequest: (q) => set({ navRequest: q }),
  userLat: null,
  userLng: null,
  tourPreview: null,
  lastRide: null,
  rideHistory: [],
  enterLandmark: (data) => set(data),
  exitLandmark: (slug) => {
    if (get().activeSlug === slug) set(CLEARED);
  },
  setSubscribed: (val) => set({ isSubscribed: val }),
  setBiciboxJson: (json) => set({ biciboxJson: json }),
  setBiciparkJson: (json) => set({ biciparkJson: json }),
  setChatPrefill: (msg) => set({ chatPrefill: msg }),
  setUserCoords: (lat, lng) => set({ userLat: lat, userLng: lng }),
  setTourPreview: (p) => set({ tourPreview: p }),
  clearTourPreview: () => set({ tourPreview: null }),
  setLastRide: (summary) => set({ lastRide: summary }),
  setRideHistory: (list) => set({ rideHistory: list }),
  addRideRecord: (record) => set({ rideHistory: [record, ...get().rideHistory].slice(0, 50) }),

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
      rideTrack: [],
      rideFreeTarget: opts.freeTarget ?? null,
      lastRide: null, // a new ride invalidates the previous recap
    }),
  endRide: () => set({ ...RIDE_CLEARED }),
  setRideTarget: (slug) => set({ rideTargetSlug: slug }),
  setRideFreeTarget: (target) => set({ rideFreeTarget: target }),
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
  appendTrackPoint: (p) => {
    const track = get().rideTrack;
    if (track.length >= 5000) return; // safety cap for a very long ride
    set({ rideTrack: [...track, p] });
  },
}));
