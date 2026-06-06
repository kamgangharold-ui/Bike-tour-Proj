import { useEffect, useRef, useState, useCallback, useMemo, type ComponentProps } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  PanResponder,
  Platform,
  Vibration,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import {
  collection,
  getDocs,
  getDoc,
  query,
  where,
  limit,
  setDoc,
  doc,
  arrayUnion,
  increment,
} from 'firebase/firestore';
import { db, auth } from '../../src/firebase/config';
import { useAppStore } from '../../src/store/useAppStore';
import { useGeofencing } from '../../src/hooks/useGeofencing';
import LandmarkCard from '../../src/components/LandmarkCard';
import { BARCELONA_CENTER, DISMOUNT_ZONE_CATEGORY } from '../../constants/rules';
import { haversineMetres } from '../../src/utils/haversine';
import { speak, stop as stopSpeaking, isSpeaking, getLastSpoken } from '../../src/utils/voice';
import {
  parseOsrmSteps,
  nextManeuver,
  distanceToPolyline,
  type ManeuverStep,
  type OsrmRoute,
} from '../../src/utils/routing';
import { useVoiceChat } from '../../src/hooks/useVoiceChat';
import { buildBikAISystemPrompt, type LandmarkInfo } from '../../src/utils/systemPrompt';
import { runCommand, parseLocalIntent, isAffirmative, isNegative, type CommandContext } from '../../src/intents/router';
import { phrases } from '../../src/intents/phrases';
import { bestLandmarkMatch, dedupeBySlug } from '../../src/utils/landmarks';
import { fetchNearestParking } from '../../src/utils/parkingService';
import { notify } from '../../src/utils/notify';
import { endRideAndSave } from '../../src/utils/rides';
import MicButton, { type MicState } from '../../src/components/MicButton';
import { useSettingsStore } from '../../src/store/useSettingsStore';
import { checkRouteAgainstZones, type RouteZone } from '../../src/utils/routeSafety';
import { writeCache, readCache, CACHE_KEYS } from '../../src/utils/offlineCache';
import { getCachedRoute, putCachedRoute, formatRouteMeta } from '../../src/utils/routeCache';

// ─── Types ───────────────────────────────────────────────────────────────────

type Coords = { latitude: number; longitude: number };

interface TourStop {
  slug: string;
  name: string;
  coordinates: Coords;
  index: number; // 0-based tour order
}

interface LocationDoc {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string;
  coordinates: Coords;
  geofenceRadius: number;
  isRegulatory: boolean;
  regulatoryAlertType: string;
  regulatoryMessage: string;
  regulatoryFineEur: number;
  audioUrl: string;
  affiliateUrl: string;
}

interface BicingStation {
  station_id: string;
  name: string;
  lat: number;
  lon: number;
  mechanical: number;
  ebike: number;
  num_bikes_available: number;
  num_docks_available: number;
  distance: number;
}

interface CardData {
  quizQuestion: string;
  quizOptions: string[];
  quizCorrectIndex: number;
  quizExplanation: string;
  quizPoints: number;
  quizAlreadyCompleted: boolean;
  faqQuestions: string[];
  faqAnswers: string[];
  faqIsPremium: boolean[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  landmark: '#1565C0',
  dismount_zone: '#B71C1C',
  parking: '#2E7D32',
  hazard: '#E65100',
  viewpoint: '#4A148C',
};

// Android renders custom-view markers BLANK when `tracksViewChanges` is false from
// the first frame — the native side never captures the marker bitmap. So we start
// tracking ON (the marker draws), then flip it OFF after a beat for performance.
// Bump `trackKey` to force a re-capture when the marker's content changes (e.g. a
// tour pin going pending → visited). iOS is unaffected but follows the same path.
function TrackedMarker({
  trackKey,
  children,
  ...props
}: ComponentProps<typeof Marker> & { trackKey?: string | number }) {
  const [tracks, setTracks] = useState(true);
  useEffect(() => {
    setTracks(true);
    const t = setTimeout(() => setTracks(false), 600);
    return () => clearTimeout(t);
  }, [trackKey]);
  return (
    <Marker {...props} tracksViewChanges={tracks}>
      {children}
    </Marker>
  );
}

const CATEGORY_LABELS: Record<string, string> = {
  landmark: 'Landmark',
  dismount_zone: 'Dismount Zone',
  parking: 'Parking',
  hazard: 'Hazard',
  viewpoint: 'Viewpoint',
};

const PLACE_TYPE_COLORS: Record<string, string> = {
  restaurant: '#E65100', cafe: '#6D4C41', bar: '#4A148C',
  tourist_attraction: '#1565C0', museum: '#1565C0', park: '#2E7D32',
  lodging: '#1A237E', store: '#880E4F', bakery: '#6D4C41',
  supermarket: '#2E7D32', hospital: '#B71C1C', pharmacy: '#1B5E20',
};

const PLACE_TYPE_LABELS: Record<string, string> = {
  restaurant: 'Restaurant', cafe: 'Café', bar: 'Bar', food: 'Food',
  tourist_attraction: 'Attraction', museum: 'Museum', park: 'Park',
  lodging: 'Hotel', store: 'Store', shopping_mall: 'Mall',
  bakery: 'Bakery', supermarket: 'Supermarket', hospital: 'Hospital',
  pharmacy: 'Pharmacy', gym: 'Gym', bank: 'Bank', church: 'Church',
  point_of_interest: 'Place', establishment: 'Place',
};

const BICING_INFO = 'https://api.bsmsa.eu/ext/api/bsm/gbfs/v2/en/station_information.json';
const BICING_STATUS = 'https://api.bsmsa.eu/ext/api/bsm/gbfs/v2/en/station_status.json';
const FETCH_OPTS = { headers: { Accept: 'application/json', 'User-Agent': 'BikeTourGuide/1.0' } };

// Free on-device reverse geocode (no Google Places billing) — used for long-press drops.
async function reverseGeocodeName(lat: number, lng: number): Promise<{ name: string; vicinity: string } | null> {
  try {
    const [a] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    if (!a) return null;
    const street = a.street ? (a.streetNumber ? `${a.street}, ${a.streetNumber}` : a.street) : '';
    const name = a.name || street || 'Dropped pin';
    const vicinity = [street && street !== name ? street : '', a.postalCode, a.city].filter(Boolean).join(', ');
    return { name, vicinity };
  } catch {
    return null;
  }
}

// A landmark counts as a no-cycling zone when it's a dismount zone or carries a
// dismount / no_cycling regulatory alert. (speed_limit / fine_warning alerts are
// regulatory but do NOT prohibit cycling, so they are not treated as zones.)
function isNoCyclingZone(loc: LocationDoc): boolean {
  return (
    loc.category === DISMOUNT_ZONE_CATEGORY ||
    loc.regulatoryAlertType === 'dismount' ||
    loc.regulatoryAlertType === 'no_cycling'
  );
}

// Human-readable warning for a route that crosses one or more no-cycling zones.
function routeWarningText(conflicts: { name: string; fineEur: number }[]): string {
  if (conflicts.length === 1) {
    const c = conflicts[0];
    const fine = c.fineEur > 0 ? `, €${Math.round(c.fineEur)} fine` : '';
    return `This route crosses ${c.name} — cycling prohibited${fine}. Dismount or reroute.`;
  }
  const names = conflicts.map((c) => c.name).join(', ');
  const maxFine = Math.max(...conflicts.map((c) => c.fineEur));
  const fine = maxFine > 0 ? ` (up to €${Math.round(maxFine)} fine)` : '';
  return `Route crosses ${conflicts.length} no-cycling zones${fine}: ${names}. Dismount or reroute.`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function MapScreen() {
  const mapRef = useRef<MapView>(null);
  const router = useRouter();

  // Location (Feature 4)
  const [userLocation, setUserLocation] = useState<Coords | null>(null);

  // Map data
  const [locations, setLocations] = useState<LocationDoc[]>([]);
  const [bicingRaw, setBicingRaw] = useState<Omit<BicingStation, 'distance'>[]>([]);
  const [bicingStations, setBicingStations] = useState<BicingStation[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [locationsLoading, setLocationsLoading] = useState(true);

  // Sheet state (Feature 2)
  const [tappedLandmark, setTappedLandmark] = useState<LocationDoc | null>(null);
  const [showFullDetails, setShowFullDetails] = useState(false);
  const [cardData, setCardData] = useState<CardData | null>(null);
  const [loadingCard, setLoadingCard] = useState(false);
  const [routeCoords, setRouteCoords] = useState<{ latitude: number; longitude: number }[]>([]);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeDest, setRouteDest] = useState<Coords | null>(null);
  const routeReqRef = useRef(0); // token to ignore superseded single-route responses

  // Turn-by-turn (Group F): maneuvers of the active single-leg route + the live
  // next turn (also read by the voice "status" intent). All local to the map.
  const [navSteps, setNavSteps] = useState<ManeuverStep[]>([]);
  const [nextTurn, setNextTurn] = useState<{ instruction: string; distanceM: number } | null>(null);
  const navStepIdxRef = useRef(0);
  const announcedTurnsRef = useRef<Set<number>>(new Set());
  const offRouteCountRef = useRef(0);

  // Tour preview / active tour state
  const [tourStops, setTourStops] = useState<TourStop[]>([]);
  const [tourRouteCoords, setTourRouteCoords] = useState<Coords[]>([]);
  const [tourRouteMeta, setTourRouteMeta] = useState<{ distance: string; duration: string } | null>(null);
  const [tourRouteLoading, setTourRouteLoading] = useState(false);
  const hasFittedTourRef = useRef(false);

  // Free-tap state (any map location)
  const [tappedMapPoint, setTappedMapPoint] = useState<{
    latitude: number;
    longitude: number;
    name: string;
    type?: string;
    rating?: number;
    vicinity?: string;
  } | null>(null);

  // Zustand
  const activeSlug = useAppStore((s) => s.activeSlug);
  const activeName = useAppStore((s) => s.activeName);
  const activeDescription = useAppStore((s) => s.activeDescription);
  const activeCategory = useAppStore((s) => s.activeCategory);
  const activeIsRegulatory = useAppStore((s) => s.activeIsRegulatory);
  const activeRegulatoryMessage = useAppStore((s) => s.activeRegulatoryMessage);
  const activeRegulatoryFineEur = useAppStore((s) => s.activeRegulatoryFineEur);
  const activeAffiliateUrl = useAppStore((s) => s.activeAffiliateUrl);
  const isSubscribed = useAppStore((s) => s.isSubscribed);
  const exitLandmark = useAppStore((s) => s.exitLandmark);
  const setChatPrefill = useAppStore((s) => s.setChatPrefill);
  const setUserCoords = useAppStore((s) => s.setUserCoords);
  const tourPreview = useAppStore((s) => s.tourPreview);
  const clearTourPreview = useAppStore((s) => s.clearTourPreview);
  const startRide = useAppStore((s) => s.startRide);
  const rideActive = useAppStore((s) => s.rideActive);
  const rideMode = useAppStore((s) => s.rideMode);
  const rideTourStops = useAppStore((s) => s.rideTourStops);
  const rideTargetSlug = useAppStore((s) => s.rideTargetSlug);
  const rideVisited = useAppStore((s) => s.rideVisited);
  const rideFreeTarget = useAppStore((s) => s.rideFreeTarget);
  const avoidNoCyclingZones = useSettingsStore((s) => s.avoidNoCyclingZones);
  const showBicing = useSettingsStore((s) => s.showBicing);
  const appLocale = useSettingsStore((s) => s.appLocale);
  const setVoiceGuidanceEnabled = useSettingsStore((s) => s.setVoiceGuidanceEnabled);
  const devLocation = useSettingsStore((s) => s.devLocation);

  useGeofencing();

  // ── Feature 4: Real-time position tracking (works ANYWHERE — no city gate) ───
  useEffect(() => {
    // TEMP dev override (dev builds only — never honored in a release build): pin
    // the position so outside-Barcelona behavior is testable without traveling.
    if (__DEV__ && devLocation) {
      setUserLocation({ latitude: devLocation.lat, longitude: devLocation.lng });
      return;
    }
    let sub: Location.LocationSubscription | null = null;
    let cancelled = false;
    (async () => {
      const loc = useSettingsStore.getState().appLocale; // read at use time (keeps deps lean)
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        speak(phrases(loc).needLocation, { lang: loc, priority: 'high' });
        return;
      }
      // Robust first fix: race a timeout, then fall back to last-known. Never hang
      // silently — if we truly can't locate, SAY so.
      let coords: Coords | null = null;
      try {
        const initial = await Promise.race([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000)),
        ]);
        coords = { latitude: initial.coords.latitude, longitude: initial.coords.longitude };
      } catch {
        const last = await Location.getLastKnownPositionAsync().catch(() => null);
        if (last) coords = { latitude: last.coords.latitude, longitude: last.coords.longitude };
      }
      if (cancelled) return;
      if (coords) setUserLocation(coords);
      else speak(phrases(loc).needLocation, { lang: loc, priority: 'high' });
      try {
        sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, distanceInterval: 10 },
          (pos) => setUserLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        );
      } catch (e) {
        console.warn('[Map] watchPosition failed', e);
      }
    })();
    return () => { cancelled = true; sub?.remove(); };
  }, [devLocation]);

  // Mirror the live position into the store so the AI chat reads the SAME
  // position the map uses (single source of truth).
  useEffect(() => {
    if (userLocation) setUserCoords(userLocation.latitude, userLocation.longitude);
  }, [userLocation, setUserCoords]);

  // One-time auto-center on the user's first GPS fix. initialRegion is only a
  // Barcelona bootstrap; without this a rider OUTSIDE Barcelona would open on
  // Barcelona and have to tap re-center to find themselves. Skipped while a tour
  // is shown (the tour-fit effect owns the camera then). No bounds gate — the
  // map always follows the real user, anywhere.
  const hasAutoCenteredRef = useRef(false);
  useEffect(() => {
    if (hasAutoCenteredRef.current || !userLocation || !mapReady) return;
    // If a tour owns the camera right now, mark auto-center done WITHOUT snapping —
    // otherwise the effect would re-run when the tour later clears (tourStops → 0)
    // and yank the camera off wherever the user had panned.
    if (tourStops.length > 0) { hasAutoCenteredRef.current = true; return; }
    hasAutoCenteredRef.current = true;
    mapRef.current?.animateToRegion({
      ...userLocation,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    });
  }, [userLocation, mapReady, tourStops.length]);

  // Foreground geofence: keep activeSlug in sync with the live position using the
  // SAME Haversine + per-landmark radius as the native geofence, so the map and
  // the AI agree even in Expo Go (where the native geofence task does not fire).
  useEffect(() => {
    if (!userLocation || locations.length === 0) return;
    let inside: LocationDoc | null = null;
    let insideDist = Infinity;
    for (const loc of locations) {
      if (!loc.coordinates.latitude && !loc.coordinates.longitude) continue;
      const d = haversineMetres(userLocation.latitude, userLocation.longitude, loc.coordinates.latitude, loc.coordinates.longitude);
      if (d <= loc.geofenceRadius && d < insideDist) { insideDist = d; inside = loc; }
    }
    const store = useAppStore.getState();
    if (inside) {
      if (inside.slug !== store.activeSlug) {
        store.enterLandmark({
          activeSlug: inside.slug,
          activeName: inside.name,
          activeDescription: inside.description,
          activeCategory: inside.category,
          activeIsRegulatory: inside.isRegulatory,
          activeRegulatoryMessage: inside.regulatoryMessage,
          activeRegulatoryFineEur: inside.regulatoryFineEur,
          activeAffiliateUrl: inside.affiliateUrl,
          activeAudioUrl: inside.audioUrl,
        });
        // Foreground arrival/regulatory event → unified dispatcher (in-app banner
        // + spoken line). The background geofence task covers the backgrounded
        // case; notify()'s 5 s dedupe prevents a double when both fire. Gated by
        // the same Settings toggles as the system notification.
        const set = useSettingsStore.getState();
        const allowed = inside.isRegulatory ? set.safetyAlertsEnabled : set.landmarkAlertsEnabled;
        if (allowed) {
          if (inside.isRegulatory) {
            const fineText = inside.regulatoryFineEur > 0 ? ` Fine: ${Math.round(inside.regulatoryFineEur)} euros.` : '';
            void notify({
              kind: 'alert',
              title: `⚠️ ${inside.name}`,
              body: `${inside.regulatoryMessage}${fineText}`,
              speak: `Warning: ${inside.name}. ${inside.regulatoryMessage}${fineText}`,
              alwaysNotify: true,
              data: { slug: inside.slug },
            });
          } else {
            void notify({
              kind: 'navigation',
              title: inside.name,
              body: inside.description,
              speak: `You're arriving at ${inside.name}.${inside.description ? ' ' + inside.description : ''}`,
              data: { slug: inside.slug },
            });
            // Quiz-available event (Drop 2): surface it if this landmark has one.
            const enteredSlug = inside.slug;
            const enteredName = inside.name;
            void (async () => {
              try {
                const qs = await getDocs(
                  query(
                    collection(db, 'quizzes'),
                    where('location_slug', '==', enteredSlug),
                    where('is_active', '==', true),
                    limit(1),
                  ),
                );
                if (!qs.empty) {
                  void notify({ kind: 'info', title: `Quiz available — ${enteredName}`, body: 'Test your knowledge.', data: { slug: enteredSlug } });
                }
              } catch {
                /* ignore */
              }
            })();
          }
        }
      }
    } else if (store.activeSlug) {
      // Hysteresis: only exit once clearly outside the active landmark's radius.
      const act = locations.find((l) => l.slug === store.activeSlug);
      const stillNear = act
        ? haversineMetres(userLocation.latitude, userLocation.longitude, act.coordinates.latitude, act.coordinates.longitude) <= act.geofenceRadius + 25
        : false;
      if (!stillNear) store.exitLandmark(store.activeSlug);
    }
  }, [userLocation, locations]);

  // ── Firestore: load landmarks ────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
      const snap = await getDocs(
        query(collection(db, 'locations'), where('is_active', '==', true)),
      );
      const docs = snap.docs.map((d) => {
        const data = d.data();
        const name = (data['name'] as string) ?? '';
        console.log('[Map] Loaded landmark:', name);
        const reg = data['regulatory_alert'] as Record<string, unknown> | undefined;
        const rawCoords = data['coordinates'] as { latitude: number; longitude: number } | null;
        return {
          id: d.id,
          name,
          slug: (data['slug'] as string) ?? d.id,
          category: (data['category'] as string) ?? 'landmark',
          description: (data['short_description'] as string) ?? '',
          coordinates: {
            latitude: rawCoords?.latitude ?? 0,
            longitude: rawCoords?.longitude ?? 0,
          },
          geofenceRadius: (data['geofence_radius_metres'] as number) ?? 40,
          isRegulatory: !!reg,
          regulatoryAlertType: (reg?.['alert_type'] as string) ?? '',
          regulatoryMessage: (reg?.['message'] as string) ?? '',
          regulatoryFineEur: (reg?.['fine_eur'] as number) ?? 0,
          audioUrl: (data['audio_url'] as string) ?? '',
          affiliateUrl: (data['getyourguide_affiliate_url'] as string) ?? '',
        } satisfies LocationDoc;
      });
      const deduplicated = dedupeBySlug(docs); // duplicate Firestore docs can exist
      setLocations(deduplicated);
      // Cache for offline use (Group C), gated by the Settings toggle. Never
      // overwrite a good cache with an empty/partial result.
      if (deduplicated.length && useSettingsStore.getState().offlineCacheEnabled) {
        void writeCache(CACHE_KEYS.locations, deduplicated);
      }
      } catch (e) {
        console.warn('[Map] Firestore fetch failed; trying cache', e);
        const cached = await readCache<LocationDoc[]>(CACHE_KEYS.locations);
        if (cached?.data?.length) setLocations(cached.data);
      } finally {
        setLocationsLoading(false);
      }
    })();
  }, []);

  // ── Bicing GBFS fetch (with HTML-response guard) ──────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [infoText, statusText] = await Promise.all([
          fetch(BICING_INFO, FETCH_OPTS).then((r) => r.text()),
          fetch(BICING_STATUS, FETCH_OPTS).then((r) => r.text()),
        ]);
        if (infoText.trim().startsWith('<') || statusText.trim().startsWith('<')) {
          console.warn('[Bicing] API blocked — HTML response');
          return;
        }
        const infoJson = JSON.parse(infoText) as { data?: { stations?: Record<string, unknown>[] } };
        const statusJson = JSON.parse(statusText) as { data?: { stations?: Record<string, unknown>[] } };
        const statusMap = new Map<string, Record<string, unknown>>();
        (statusJson.data?.stations ?? []).forEach((s) =>
          statusMap.set(s['station_id'] as string, s),
        );
        const raw = (infoJson.data?.stations ?? []).map((info) => {
          const s = statusMap.get(info['station_id'] as string) ?? {};
          const types = s['num_bikes_available_types'] as { mechanical?: number; ebike?: number } | undefined;
          return {
            station_id: info['station_id'] as string,
            name: info['name'] as string,
            lat: info['lat'] as number,
            lon: info['lon'] as number,
            mechanical: types?.mechanical ?? 0,
            ebike: types?.ebike ?? 0,
            num_bikes_available: (s['num_bikes_available'] as number) ?? 0,
            num_docks_available: (s['num_docks_available'] as number) ?? 0,
          };
        });
        setBicingRaw(raw);
      } catch (e) {
        console.warn('[Bicing] fetch failed', e);
      }
    })();
  }, []);

  // ── Filter Bicing to 1500 m ───────────────────────────────────────────────────
  useEffect(() => {
    if (!userLocation) { setBicingStations([]); return; }
    const { latitude: uLat, longitude: uLon } = userLocation;
    const filtered = bicingRaw
      .map((s) => ({ ...s, distance: Math.round(haversineMetres(uLat, uLon, s.lat, s.lon)) }))
      .filter((s) => s.distance <= 1500)
      .sort((a, b) => a.distance - b.distance);
    setBicingStations(filtered);
  }, [userLocation, bicingRaw]);

  // ── Fetch quiz + FAQ data ─────────────────────────────────────────────────────
  const fetchCardData = useCallback(async (slug: string) => {
    setLoadingCard(true);
    setCardData(null);
    try {
      const [quizSnap, faqSnap] = await Promise.all([
        getDocs(
          query(
            collection(db, 'quizzes'),
            where('location_slug', '==', slug),
            limit(5),
          ),
        ),
        getDocs(
          query(
            collection(db, 'faqs'),
            where('location_slug', '==', slug),
            limit(10),
          ),
        ),
      ]);

      const activeFaqs = faqSnap.docs
        .map((d) => d.data())
        .filter((d) => d['is_active'] !== false)
        .sort(
          (a, b) =>
            ((a['sort_order'] as number) ?? 0) - ((b['sort_order'] as number) ?? 0),
        )
        .slice(0, 6);

      const seenQ = new Set<string>();
      const uniqueFaqs = activeFaqs.filter((d) => {
        const q = (d['question'] as string) ?? '';
        if (seenQ.has(q)) return false;
        seenQ.add(q);
        return true;
      });

      const user = auth.currentUser;
      let completedIds: string[] = [];
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        completedIds = (userDoc.data()?.['completed_quiz_ids'] as string[]) ?? [];
      }

      let quizQuestion = '';
      let quizOptions: string[] = [];
      let quizCorrectIndex = -1;
      let quizExplanation = '';
      let quizPoints = 0;
      const activeQuizDoc = quizSnap.docs.find(d => d.data()['is_active'] !== false);
      if (activeQuizDoc) {
        const q = activeQuizDoc.data();
        quizQuestion = (q['question'] as string) ?? '';
        quizOptions = (q['options'] as string[]) ?? [];
        quizCorrectIndex = (q['correct_option_index'] as number) ?? -1;
        quizExplanation = (q['explanation'] as string) ?? '';
        quizPoints = (q['points_reward'] as number) ?? 0;
      }

      setCardData({
        quizQuestion,
        quizOptions,
        quizCorrectIndex,
        quizExplanation,
        quizPoints,
        quizAlreadyCompleted: completedIds.includes(slug),
        faqQuestions: uniqueFaqs.map((d) => (d['question'] as string) ?? ''),
        faqAnswers: uniqueFaqs.map((d) => (d['answer'] as string) ?? ''),
        faqIsPremium: uniqueFaqs.map((d) => (d['is_premium'] as boolean) ?? false),
      });
    } catch (e) {
      console.warn('[fetchCardData] failed', e);
    } finally {
      setLoadingCard(false);
    }
  }, []);

  // Load card for geofence-triggered landmark
  const tappedRef = useRef(tappedLandmark);
  tappedRef.current = tappedLandmark;
  useEffect(() => {
    if (activeSlug && !tappedRef.current) void fetchCardData(activeSlug);
    else if (!activeSlug && !tappedRef.current) setCardData(null);
  }, [activeSlug, fetchCardData]);

  // ── Feature 2: Landmark marker tap ───────────────────────────────────────────
  const handleLandmarkPress = useCallback((loc: LocationDoc) => {
    setTappedMapPoint(null);
    setTappedLandmark(loc);
    setShowFullDetails(false);
    setCardData(null);
  }, []);

  const handleFullDetails = useCallback(() => {
    if (!tappedLandmark) return;
    setShowFullDetails(true);
    void fetchCardData(tappedLandmark.slug);
  }, [tappedLandmark, fetchCardData]);

  const handleAskAI = useCallback(
    (landmarkName: string) => {
      setChatPrefill(`Tell me about ${landmarkName}`);
      router.push('/(tabs)/chat');
    },
    [setChatPrefill, router],
  );

  const handleDismissPreview = useCallback(() => {
    setTappedLandmark(null);
    setShowFullDetails(false);
    setCardData(null);
    setTappedMapPoint(null);
  }, []);

  // Closing the card does NOT clear the directions route — route state is
  // independent of the card/landmark, cleared only by the route banner's ✕ or a
  // new directions request.
  const handleDismissCard = useCallback(() => {
    if (tappedLandmark) {
      setTappedLandmark(null);
      setShowFullDetails(false);
      setCardData(null);
    } else {
      exitLandmark(activeSlug);
    }
  }, [tappedLandmark, exitLandmark, activeSlug]);

  // Swipe down on the card's grab handle to dismiss it (ref keeps the latest dismiss).
  const dismissCardRef = useRef(handleDismissCard);
  dismissCardRef.current = handleDismissCard;
  const sheetPan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderRelease: (_, g) => { if (g.dy > 50) dismissCardRef.current(); },
    }),
  ).current;

  // ── Quiz correct ──────────────────────────────────────────────────────────────
  const effectiveSlug =
    tappedLandmark && showFullDetails ? tappedLandmark.slug : activeSlug;

  const handleQuizCorrect = async (points: number) => {
    const user = auth.currentUser;
    if (!user || !effectiveSlug) return;
    setCardData((prev) => (prev ? { ...prev, quizAlreadyCompleted: true } : prev));
    await setDoc(
      doc(db, 'users', user.uid),
      {
        completed_quiz_ids: arrayUnion(effectiveSlug),
        total_points: increment(points),
        visited_location_slugs: arrayUnion(effectiveSlug),
      },
      { merge: true },
    );
  };

  // ── Feature 4: Re-centre on user ─────────────────────────────────────────────
  const handleRecenter = () => {
    const target = userLocation ?? BARCELONA_CENTER;
    mapRef.current?.animateToRegion({
      ...target,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    });
  };

  // Native POI tap — fires on Android Google Maps only (Apple Maps does NOT expose
  // POI-label taps). Shows the place straight from the native event's name +
  // coordinate. No Places API, no billing.
  const handlePoiClick = useCallback(
    (e: { nativeEvent: { name?: string; coordinate: Coords } }) => {
      const { coordinate, name } = e.nativeEvent;
      const { latitude, longitude } = coordinate;
      setTappedLandmark(null);
      setShowFullDetails(false);
      setCardData(null);
      if (activeSlug) exitLandmark(activeSlug);
      setTappedMapPoint({ latitude, longitude, name: (name ?? 'Place').split('\n')[0] });
    },
    [activeSlug, exitLandmark],
  );

  // Long-press drops a pin and reverse-geocodes it (free, on-device). Single taps
  // stay clean: empty taps do nothing; pins and Android POI labels handle their own taps.
  const handleMapLongPress = useCallback(async (e: { nativeEvent: { coordinate: Coords } }) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setTappedLandmark(null);
    setShowFullDetails(false);
    setCardData(null);
    if (activeSlug) exitLandmark(activeSlug);
    setTappedMapPoint({ latitude, longitude, name: 'Dropped pin' });
    const addr = await reverseGeocodeName(latitude, longitude);
    if (addr) {
      setTappedMapPoint((prev) =>
        prev && prev.latitude === latitude && prev.longitude === longitude
          ? { latitude, longitude, name: addr.name, vicinity: addr.vicinity }
          : prev,
      );
    }
  }, [activeSlug, exitLandmark]);

  // Reset turn-by-turn tracking (new route or cleared route).
  const resetNav = useCallback((steps: ManeuverStep[]) => {
    navStepIdxRef.current = 0;
    announcedTurnsRef.current = new Set();
    offRouteCountRef.current = 0;
    setNavSteps(steps);
    setNextTurn(null);
  }, []);

  // Clear the single-leg route + finish pin, and cancel any in-flight request.
  const clearSingleRoute = useCallback(() => {
    routeReqRef.current++;
    setRouteCoords([]);
    setRouteInfo(null);
    setRouteDest(null);
    setRouteLoading(false);
    resetNav([]);
  }, [resetNav]);

  const fetchRoute = useCallback(async (destLat: number, destLng: number) => {
    if (!userLocation) return;
    const token = ++routeReqRef.current; // supersede any earlier in-flight request
    const { latitude: srcLat, longitude: srcLng } = userLocation;
    setRouteDest({ latitude: destLat, longitude: destLng });
    const key = `cycling/${srcLng.toFixed(5)},${srcLat.toFixed(5)};${destLng.toFixed(5)},${destLat.toFixed(5)}`;

    // Cache hit → show instantly, no network.
    const cached = await getCachedRoute(key);
    if (routeReqRef.current !== token) return; // superseded while reading cache
    if (cached) {
      setRouteCoords(cached.coords);
      setRouteInfo(formatRouteMeta(cached.distance, cached.duration));
      resetNav(cached.steps ?? []);
      setRouteLoading(false);
      return;
    }

    // Miss → clear, show the instant bearing-line placeholder + loading, fetch.
    setRouteCoords([]);
    setRouteInfo(null);
    resetNav([]);
    setRouteLoading(true);
    try {
      // steps=true → turn-by-turn maneuvers for the voice guidance (Group F).
      const url = `https://router.project-osrm.org/route/v1/${key}?overview=full&geometries=geojson&steps=true`;
      const res = await fetch(url);
      const data = await res.json() as { routes?: OsrmRoute[] };
      if (routeReqRef.current !== token) return; // superseded by a newer request
      const route = data.routes?.[0];
      if (!route) return;
      const coords = route.geometry.coordinates.map(([lng, lat]) => ({ latitude: lat, longitude: lng }));
      const steps = parseOsrmSteps(route, appLocale);
      setRouteCoords(coords);
      setRouteInfo(formatRouteMeta(route.distance, route.duration));
      resetNav(steps);
      void putCachedRoute(key, { coords, distance: route.distance, duration: route.duration, steps });
    } catch (e) {
      console.warn('[fetchRoute]', e);
    } finally {
      if (routeReqRef.current === token) setRouteLoading(false);
    }
  }, [userLocation, appLocale, resetNav]);

  // ── Turn-by-turn cues + off-route reroute (Group F) ──────────────────────────
  // Driven by the live position. `nextTurn` stays fresh for the voice "status"
  // intent; each maneuver is spoken once at ~150 m (only while riding, so a route
  // preview doesn't chatter). Off-route for 3 readings → recalc to the same dest.
  useEffect(() => {
    if (!userLocation) return;
    if (navSteps.length > 0) {
      const nt = nextManeuver(userLocation, navSteps, navStepIdxRef.current);
      if (nt) {
        navStepIdxRef.current = nt.index;
        setNextTurn({ instruction: nt.step.instruction, distanceM: nt.distanceM });
        if (rideActive && nt.distanceM <= 150 && !announcedTurnsRef.current.has(nt.index)) {
          announcedTurnsRef.current.add(nt.index);
          const m = Math.max(10, Math.round(nt.distanceM / 10) * 10);
          speak(`In ${m} meters, ${nt.step.instruction}`, { lang: 'en' });
        }
      } else {
        setNextTurn(null);
      }
    }
    if (rideActive && routeDest && routeCoords.length > 1) {
      const off = distanceToPolyline(userLocation, routeCoords);
      if (off > 50) {
        offRouteCountRef.current += 1;
        if (offRouteCountRef.current >= 3) {
          offRouteCountRef.current = 0;
          void notify({ kind: 'navigation', title: 'Rerouting', body: 'Recalculating the route.', speak: 'Recalculating route' });
          void fetchRoute(routeDest.latitude, routeDest.longitude);
        }
      } else {
        offRouteCountRef.current = 0;
      }
    }
  }, [userLocation, navSteps, routeCoords, routeDest, rideActive, fetchRoute]);

  // ── Voice command & control (Group G) ────────────────────────────────────────
  // Landmarks in the shape the system prompt + STT boost expect.
  const landmarkInfos = useMemo<LandmarkInfo[]>(
    () =>
      locations.map((l) => ({
        name: l.name,
        slug: l.slug,
        short_description: l.description,
        category: l.category,
        coordinates: l.coordinates,
        geofence_radius_metres: l.geofenceRadius,
        regulatory_alert: l.isRegulatory
          ? { message: l.regulatoryMessage, fine_eur: l.regulatoryFineEur }
          : undefined,
      })),
    [locations],
  );

  const [micPhase, setMicPhase] = useState<'idle' | 'thinking' | 'speaking'>('idle');
  // A low-confidence destination awaiting a spoken yes/no confirmation.
  const pendingNavRef = useRef<{ lat: number; lng: number; name: string } | null>(null);

  // Run a recognized utterance: build the executors (reuse the route pipeline,
  // store actions, parking service), let the hybrid router execute + return the
  // spoken reply, then speak it. Rebuilt each render so it reads fresh state; the
  // voice hook always calls the latest via its options ref.
  const handleCommand = async (transcript: string, forceNavigate = false) => {
    const ph = phrases(appLocale);

    // Start (or retarget) navigation to a resolved point + speak the destination
    // and distance. No ride → auto-start a free ride so turn-by-turn runs. Active
    // FREE ride → retarget (keep guidance/banner/voice in sync with the new route).
    // Active TOUR → don't silently hijack the tour; ask the rider to finish it.
    const doNavigate = async (lat: number, lng: number, name: string): Promise<string> => {
      const st = useAppStore.getState();
      if (!st.rideActive) {
        st.startRide({ mode: 'free', freeTarget: { slug: null, lat, lng, name } });
      } else if (st.rideMode === 'free') {
        st.setRideFreeTarget({ slug: null, lat, lng, name });
      } else {
        return ph.navBusyTour;
      }
      freeRouteKeyRef.current = `${lat},${lng}`; // we fetch now → skip the free-route effect's duplicate fetch
      await fetchRoute(lat, lng);
      const d =
        st.userLat != null && st.userLng != null
          ? haversineMetres(st.userLat, st.userLng, lat, lng)
          : null;
      const distStr = d == null ? '' : d < 1000 ? `${Math.round(d)} m` : `${(d / 1000).toFixed(1)} km`;
      return distStr ? ph.headingTo(name, distStr) : ph.routing(name);
    };

    // If we asked "did you mean X?", this turn may be the yes/no answer — BUT a
    // fresh explicit command (e.g. "stop the ride", "where can I park") must win
    // over the stale confirmation.
    if (pendingNavRef.current) {
      const pend = pendingNavRef.current;
      const fresh = parseLocalIntent(transcript, appLocale);
      if (fresh) {
        pendingNavRef.current = null; // a real command → fall through to run it
      } else if (isAffirmative(transcript, appLocale)) {
        pendingNavRef.current = null;
        setMicPhase('speaking');
        speak(await doNavigate(pend.lat, pend.lng, pend.name), { lang: appLocale, priority: 'high' });
        return;
      } else if (isNegative(transcript, appLocale)) {
        pendingNavRef.current = null;
        setMicPhase('speaking');
        speak(ph.cancelled, { lang: appLocale, priority: 'high' });
        return;
      } else {
        pendingNavRef.current = null; // unrecognized → drop the pending question
      }
    }

    const ctx: CommandContext = {
      locale: appLocale,
      systemContext: () => buildBikAISystemPrompt(landmarkInfos, appLocale),
      navigate: async (query) => {
        const s = useAppStore.getState();
        if (s.userLat == null || s.userLng == null) return ph.needLocation;
        // 1) Best landmark match over the deduped list (accent/case-insensitive,
        // similarity-scored). Confident → go; plausible → confirm; weak → geocode.
        const m = bestLandmarkMatch(query, landmarkInfos);
        if (m && m.item.coordinates) {
          if (m.score >= 0.6) {
            return doNavigate(m.item.coordinates.latitude, m.item.coordinates.longitude, m.item.name ?? query);
          }
          if (m.score >= 0.4) {
            pendingNavRef.current = {
              lat: m.item.coordinates.latitude,
              lng: m.item.coordinates.longitude,
              name: m.item.name ?? query,
            };
            return ph.didYouMean(m.item.name ?? query);
          }
        }
        // 2) Geocode, biased to the user's region (city from reverse-geocode), and
        // pick the candidate nearest the user — never a same-named place elsewhere.
        let city = '';
        try {
          const rg = await Location.reverseGeocodeAsync({ latitude: s.userLat, longitude: s.userLng });
          city = rg[0]?.city ?? rg[0]?.region ?? '';
        } catch {
          /* no reverse geocode → use raw query */
        }
        const forms = city ? [`${query}, ${city}`, query] : [query];
        let dest: Coords | null = null;
        for (const g of forms) {
          try {
            const geo = await Location.geocodeAsync(g);
            if (geo.length) {
              const nearest = geo
                .map((p) => ({ p, d: haversineMetres(s.userLat!, s.userLng!, p.latitude, p.longitude) }))
                .sort((a, b) => a.d - b.d)[0];
              dest = { latitude: nearest.p.latitude, longitude: nearest.p.longitude };
              break;
            }
          } catch {
            /* try next form */
          }
        }
        if (!dest) return ph.notFound(query);
        return doNavigate(dest.latitude, dest.longitude, query);
      },
      reroute: async () => {
        if (!routeDest) return ph.noRoute;
        await fetchRoute(routeDest.latitude, routeDest.longitude);
        return ph.rerouting;
      },
      skipStop: () => {
        const s = useAppStore.getState();
        if (s.rideMode !== 'tour' || s.rideTourStops.length === 0) return ph.skipNone;
        const idx = s.rideTargetSlug ? s.rideTourStops.indexOf(s.rideTargetSlug) : -1;
        const next = s.rideTourStops.slice(idx + 1).find((x) => !s.rideVisited.includes(x)) ?? null;
        s.setRideTarget(next);
        if (!next) return ph.skipNone;
        return ph.skipped(landmarkInfos.find((l) => l.slug === next)?.name ?? next);
      },
      findParking: async () => {
        const s = useAppStore.getState();
        if (s.userLat == null || s.userLng == null) return ph.needLocation;
        try {
          const list = await fetchNearestParking(s.userLat, s.userLng, 1500);
          if (!list.length) return ph.parkingNone;
          const n = list[0];
          setTappedMapPoint({ latitude: n.latitude, longitude: n.longitude, name: n.name });
          return ph.parkingFound(n.name, n.distanceMetres);
        } catch {
          return ph.parkingError;
        }
      },
      status: () => {
        const parts: string[] = [];
        if (nextTurn) parts.push(ph.statusToTurn(Math.max(10, Math.round(nextTurn.distanceM / 10) * 10)));
        if (routeInfo) parts.push(ph.statusToDest(routeInfo.distance, routeInfo.duration));
        return parts.length ? parts.join(' ') : ph.statusNoRoute;
      },
      // Location question — answer from live GPS via reverse-geocode (no route
      // needed; works anywhere, not just Barcelona).
      whereAmI: async () => {
        const s = useAppStore.getState();
        if (s.userLat == null || s.userLng == null) return ph.needLocation;
        // GPS present but the name can't be resolved (offline / remote) → still
        // answer with coordinates rather than falsely claiming we lack location.
        const coords = ph.youAreNearCoords(s.userLat.toFixed(4), s.userLng.toFixed(4));
        try {
          const a = (await Location.reverseGeocodeAsync({ latitude: s.userLat, longitude: s.userLng }))[0];
          if (!a) return coords;
          const street = a.street || a.name || '';
          const area = a.district || a.subregion || a.city || a.region || '';
          const place = [street, area].filter(Boolean).join(', ');
          return place ? ph.youAreAt(place) : coords;
        } catch {
          return coords;
        }
      },
      repeat: () => {
        const last = getLastSpoken();
        if (last.text) speak(last.text, { lang: last.lang, priority: 'high' });
        return ''; // re-spoken directly in its original language
      },
      setMuted: (muted) => {
        setVoiceGuidanceEnabled(!muted);
        if (muted) {
          stopSpeaking();
          Vibration.vibrate(40); // tactile confirm — TTS is now off, can't speak it
          return '';
        }
        return ph.unmuted;
      },
      slower: () => {
        const cur = useSettingsStore.getState().voiceRate;
        useSettingsStore.getState().setVoiceRate(Math.max(0.5, Math.round((cur - 0.15) * 100) / 100));
        return ph.slower;
      },
      louder: () => ph.louderNote,
      endRide: async () => {
        const summary = await endRideAndSave();
        if (summary) router.push('/recap');
        return ph.ending;
      },
    };

    setMicPhase('thinking');
    try {
      const spoken = forceNavigate ? await ctx.navigate(transcript) : await runCommand(transcript, ctx);
      if (spoken && spoken.trim()) {
        setMicPhase('speaking');
        speak(spoken, { lang: appLocale, priority: 'high' });
      } else if (isSpeaking()) {
        setMicPhase('speaking'); // an executor re-spoke directly (e.g. repeat)
      } else {
        setMicPhase('idle');
      }
    } catch {
      setMicPhase('idle');
    }
  };

  // Map tap-to-talk: silence auto-stop (~1.5 s) + 8 s cap. startListening() is the
  // single entry a future wake-word engine can call.
  const commandVoice = useVoiceChat({
    onTranscript: (t) => void handleCommand(t),
    phrases: () => landmarkInfos.map((l) => l.name ?? '').filter(Boolean),
    silenceMs: 1500,
    maxMs: 8000,
    onError: () => setMicPhase('idle'),
  });

  // Tap while speaking → barge-in (interrupt + listen); while listening → stop.
  const onMicPress = () => {
    if (commandVoice.isListening) {
      void commandVoice.stopListening();
      return;
    }
    if (isSpeaking()) stopSpeaking();
    setMicPhase('idle');
    Vibration.vibrate(20); // short tactile start cue (hands-free, screen-free)
    void commandVoice.startListening();
  };

  const micState: MicState = commandVoice.isListening
    ? 'listening'
    : commandVoice.transcribing
      ? 'thinking'
      : micPhase;

  // Drop back to idle once TTS finishes (expo-speech has no per-call done hook
  // here). If a "did you mean X?" confirmation is pending, auto-arm the mic so the
  // rider can answer yes/no fully hands-free (no second tap needed).
  useEffect(() => {
    if (micPhase !== 'speaking') return;
    const id = setInterval(() => {
      if (isSpeaking()) return;
      clearInterval(id);
      clearTimeout(max);
      if (pendingNavRef.current && !commandVoice.isListening) {
        void commandVoice.startListening(); // listen for the spoken yes/no
      }
      setMicPhase('idle');
    }, 300);
    const max = setTimeout(() => setMicPhase('idle'), 30000);
    return () => { clearInterval(id); clearTimeout(max); };
  }, [micPhase]);

  // Consume a chat → map navigation hand-off ("guide me to X" typed in BikAI):
  // run it straight through the navigate executor (real turn-by-turn).
  const navRequest = useAppStore((s) => s.navRequest);
  const setNavRequest = useAppStore((s) => s.setNavRequest);
  useEffect(() => {
    if (!navRequest) return;
    const q = navRequest;
    setNavRequest(null);
    void handleCommand(q, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navRequest]);

  const fetchTourRoute = useCallback(async (stops: TourStop[]) => {
    if (stops.length < 2) return;
    const waypoints = stops
      .map((s) => `${s.coordinates.longitude},${s.coordinates.latitude}`)
      .join(';');
    const key = `cycling/${waypoints}`;

    // Cache hit → show instantly.
    const cached = await getCachedRoute(key);
    if (cached) {
      setTourRouteCoords(cached.coords);
      setTourRouteMeta(formatRouteMeta(cached.distance, cached.duration));
      setTourRouteLoading(false);
      return;
    }

    // Miss → clear (the straight-line placeholder shows) and fetch ONE request.
    setTourRouteCoords([]);
    setTourRouteMeta(null);
    setTourRouteLoading(true);
    try {
      const url = `https://router.project-osrm.org/route/v1/${key}?overview=full&geometries=geojson`;
      const res = await fetch(url);
      const data = await res.json() as {
        routes?: Array<{ geometry: { coordinates: [number, number][] }; distance: number; duration: number }>;
      };
      const route = data.routes?.[0];
      if (!route) return;
      const coords = route.geometry.coordinates.map(([lng, lat]) => ({ latitude: lat, longitude: lng }));
      setTourRouteCoords(coords);
      setTourRouteMeta(formatRouteMeta(route.distance, route.duration));
      void putCachedRoute(key, { coords, distance: route.distance, duration: route.duration });
    } catch (e) {
      console.warn('[fetchTourRoute]', e);
    } finally {
      setTourRouteLoading(false);
    }
  }, []);

  // Resolve tour stop slugs → TourStop objects whenever tourPreview or active tour changes.
  useEffect(() => {
    const slugs =
      rideActive && rideMode === 'tour' ? rideTourStops :
      tourPreview ? tourPreview.slugs : [];
    if (slugs.length === 0 || locations.length === 0) {
      setTourStops([]);
      setTourRouteCoords([]);
      setTourRouteMeta(null);
      setTourRouteLoading(false);
      return;
    }
    const resolved = slugs
      .map((slug, i) => {
        const loc = locations.find((l) => l.slug === slug);
        return loc
          ? { slug, name: loc.name, coordinates: loc.coordinates, index: i }
          : null;
      })
      .filter((s): s is TourStop => s !== null);
    setTourStops(resolved);
  }, [tourPreview, rideActive, rideMode, rideTourStops, locations]);

  // Fetch multi-waypoint OSRM route when stops are resolved.
  useEffect(() => {
    if (tourStops.length >= 2) void fetchTourRoute(tourStops);
  }, [tourStops, fetchTourRoute]);

  // Group A: when a free ride has a chosen destination, draw the route to it
  // (reuses the single-leg OSRM route). Fetch once per destination.
  const freeRouteKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (rideActive && rideMode === 'free' && rideFreeTarget && userLocation) {
      const key = `${rideFreeTarget.lat},${rideFreeTarget.lng}`;
      if (freeRouteKeyRef.current !== key) {
        freeRouteKeyRef.current = key;
        void fetchRoute(rideFreeTarget.lat, rideFreeTarget.lng);
      }
    } else if (!rideActive || rideMode !== 'free' || !rideFreeTarget) {
      freeRouteKeyRef.current = null;
    }
  }, [rideActive, rideMode, rideFreeTarget, userLocation, fetchRoute]);

  // FIX 6: when a ride/navigation ENDS, clear the single-leg route, maneuver
  // steps, next-turn, destination and polyline — the dotted line vanishes and the
  // next ride can't inherit it. (The tour route auto-clears via the tour-stops
  // resolver.) Only fires on the active→inactive transition, never on start.
  const prevRideActiveRef = useRef(rideActive);
  useEffect(() => {
    if (prevRideActiveRef.current && !rideActive) clearSingleRoute();
    prevRideActiveRef.current = rideActive;
  }, [rideActive, clearSingleRoute]);

  // Fit camera to all tour stop pins once when the route first loads.
  useEffect(() => {
    if (tourStops.length === 0) { hasFittedTourRef.current = false; return; }
    if (!tourRouteCoords.length || !mapReady || hasFittedTourRef.current) return;
    hasFittedTourRef.current = true;
    mapRef.current?.fitToCoordinates(
      tourStops.map((s) => s.coordinates),
      { edgePadding: { top: 100, right: 40, bottom: 280, left: 40 }, animated: true },
    );
  }, [tourStops, tourRouteCoords, mapReady]);

  // ── Group A: rule-aware routing safety ───────────────────────────────────────
  // No-cycling / dismount zones, modeled as circles for route checking.
  const noCyclingZones = useMemo<RouteZone[]>(
    () =>
      locations.filter(isNoCyclingZone).map((l) => ({
        slug: l.slug,
        name: l.name,
        coordinates: l.coordinates,
        radiusMetres: l.geofenceRadius,
        fineEur: l.regulatoryFineEur,
        message: l.regulatoryMessage,
      })),
    [locations],
  );

  // Gated behind the "Avoid no-cycling zones" setting (Group D; default ON).
  const routeSafety = useMemo(
    () =>
      avoidNoCyclingZones && routeCoords.length > 0
        ? checkRouteAgainstZones(routeCoords, noCyclingZones)
        : { conflicts: [], redSegments: [] },
    [avoidNoCyclingZones, routeCoords, noCyclingZones],
  );

  const tourRouteSafety = useMemo(
    () =>
      avoidNoCyclingZones && tourRouteCoords.length > 0
        ? checkRouteAgainstZones(tourRouteCoords, noCyclingZones)
        : { conflicts: [], redSegments: [] },
    [avoidNoCyclingZones, tourRouteCoords, noCyclingZones],
  );

  // The route currently on screen (a tour takes precedence over a single leg).
  const activeConflicts =
    tourStops.length > 0 ? tourRouteSafety.conflicts : routeSafety.conflicts;

  // ── Derived state for which sheet to show ────────────────────────────────────
  const showPreview = tappedLandmark !== null && !showFullDetails;
  const showFullCard =
    (tappedLandmark !== null && showFullDetails) ||
    (activeSlug.length > 0 && tappedLandmark === null);

  // Resolve data source for full card (tapped vs geofence)
  const isTappedFull = tappedLandmark !== null && showFullDetails;
  const fullName = isTappedFull ? tappedLandmark.name : activeName;
  const fullDesc = isTappedFull ? tappedLandmark.description : activeDescription;
  const fullCat = isTappedFull ? tappedLandmark.category : activeCategory;
  const fullIsReg = isTappedFull ? tappedLandmark.isRegulatory : activeIsRegulatory;
  const fullRegMsg = isTappedFull ? tappedLandmark.regulatoryMessage : activeRegulatoryMessage;
  const fullRegFine = isTappedFull ? tappedLandmark.regulatoryFineEur : activeRegulatoryFineEur;
  const fullAffiliate = isTappedFull ? tappedLandmark.affiliateUrl : activeAffiliateUrl;
  const activeLandmarkCoords = !isTappedFull && activeSlug
    ? locations.find((l) => l.slug === activeSlug)?.coordinates
    : undefined;
  const fullLat = isTappedFull ? tappedLandmark.coordinates.latitude : activeLandmarkCoords?.latitude;
  const fullLng = isTappedFull ? tappedLandmark.coordinates.longitude : activeLandmarkCoords?.longitude;

  const sheetVisible = showPreview || showFullCard;
  // The bottom tour banner (preview or active-tour) shares the FABs' corner, so
  // lift the FABs above it when it's showing.
  const tourBannerVisible =
    (!!tourPreview && tourStops.length > 0 && !rideActive) ||
    (rideActive && rideMode === 'tour' && tourStops.length > 0);

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={Platform.OS === 'android' && process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
        mapType="standard"
        showsPointsOfInterest
        onPoiClick={handlePoiClick}
        onLongPress={(e) => void handleMapLongPress(e)}
        showsUserLocation
        onMapReady={() => setMapReady(true)}
        initialRegion={{ ...BARCELONA_CENTER, latitudeDelta: 0.02, longitudeDelta: 0.02 }}
        mapPadding={{ top: 0, left: 0, right: 0, bottom: tourBannerVisible ? 100 : 8 }}
      >
        {/* Tour stop pins — shown during preview or active tour */}
        {tourStops.map((stop, i, arr) => {
          const visited = rideActive && rideVisited.includes(stop.slug);
          const isTarget = rideActive && stop.slug === rideTargetSlug;
          const isFinish = i === arr.length - 1; // last RESOLVED stop = distinct finish pin
          return (
            <TrackedMarker
              key={`tour-${stop.slug}`}
              trackKey={`${visited ? 'v' : ''}${isTarget ? 't' : ''}${isFinish ? 'f' : ''}${stop.index}`}
              coordinate={stop.coordinates}
              anchor={{ x: 0.5, y: 0.5 }}
              zIndex={isFinish ? 11 : 10}
            >
              <View style={[
                styles.tourPin,
                visited ? styles.tourPinDone : isTarget ? styles.tourPinTarget : styles.tourPinPending,
                isFinish && styles.tourPinFinish,
              ]}>
                <Text style={styles.tourPinNum}>{visited ? '✓' : isFinish ? '🏁' : stop.index + 1}</Text>
              </View>
            </TrackedMarker>
          );
        })}

        {/* Regular landmark pins — hidden while a tour is displayed */}
        {tourStops.length === 0 && locations.map((loc) => {
          if (!loc.coordinates.latitude && !loc.coordinates.longitude) return null;
          const pinColor = CATEGORY_COLORS[loc.category] ?? '#1565C0';
          return (
            <TrackedMarker
              key={loc.id}
              trackKey={pinColor}
              coordinate={loc.coordinates}
              anchor={{ x: 0.5, y: 0.5 }}
              onPress={() => handleLandmarkPress(loc)}
            >
              <View style={styles.pinHitArea}>
                <View style={[styles.pin, { backgroundColor: pinColor }]} />
              </View>
            </TrackedMarker>
          );
        })}

        {/* Bicing station markers (toggle: Settings → Map layers) */}
        {showBicing && bicingStations.map((station) => (
          <TrackedMarker
            key={`bicing-${station.station_id}`}
            trackKey={station.num_bikes_available > 0 ? 'g' : 'r'}
            coordinate={{ latitude: station.lat, longitude: station.lon }}
          >
            <View
              style={[
                styles.bicingMarker,
                { backgroundColor: station.num_bikes_available > 0 ? '#2E7D32' : '#C62828' },
              ]}
            >
              <Text style={styles.bicingMarkerLabel}>B</Text>
            </View>
          </TrackedMarker>
        ))}
        {/* Group C: instant straight placeholder while the real route loads */}
        {tourRouteLoading && tourRouteCoords.length === 0 && tourStops.length >= 2 && (
          <Polyline
            coordinates={tourStops.map((s) => s.coordinates)}
            strokeColor="#00C853"
            strokeWidth={3}
            lineDashPattern={[6, 6]}
          />
        )}
        {routeLoading && routeCoords.length === 0 && userLocation && routeDest && tourStops.length === 0 && (
          <Polyline
            coordinates={[userLocation, routeDest]}
            strokeColor="#00C853"
            strokeWidth={3}
            lineDashPattern={[6, 6]}
          />
        )}
        {/* Tour route — full multi-stop green line */}
        {tourRouteCoords.length > 0 && (
          <Polyline
            coordinates={tourRouteCoords}
            strokeColor="#00C853"
            strokeWidth={5}
            zIndex={5}
          />
        )}
        {/* Single-leg directions — only when no tour is active */}
        {routeCoords.length > 0 && tourStops.length === 0 && (
          <Polyline
            coordinates={routeCoords}
            strokeColor="#00C853"
            strokeWidth={4}
          />
        )}
        {/* Group A: red overlays where the route crosses a no-cycling zone */}
        {tourRouteCoords.length > 0 &&
          tourRouteSafety.redSegments.map((seg, i) => (
            <Polyline
              key={`tour-red-${i}`}
              coordinates={seg}
              strokeColor="#D50000"
              strokeWidth={6}
              zIndex={20}
            />
          ))}
        {routeCoords.length > 0 &&
          tourStops.length === 0 &&
          routeSafety.redSegments.map((seg, i) => (
            <Polyline
              key={`route-red-${i}`}
              coordinates={seg}
              strokeColor="#D50000"
              strokeWidth={6}
              zIndex={20}
            />
          ))}
        {/* Group C: finish pin at a single/free-ride destination — tied to the
            real route line so it can't outlive it (no orphan on a failed fetch). */}
        {routeDest && routeCoords.length > 0 && tourStops.length === 0 && (
          <TrackedMarker coordinate={routeDest} trackKey="finish" anchor={{ x: 0.5, y: 0.5 }} zIndex={15}>
            <View style={styles.finishPin}>
              <Ionicons name="flag" size={14} color="#fff" />
            </View>
          </TrackedMarker>
        )}
      </MapView>

      {/* Re-centre FAB */}
      <TouchableOpacity
        style={[styles.fab, sheetVisible ? styles.fabWithSheet : tourBannerVisible && styles.fabAboveBanner]}
        onPress={handleRecenter}
      >
        <Ionicons name="navigate" size={20} color="#fff" />
      </TouchableOpacity>

      {/* AI chat FAB */}
      <TouchableOpacity
        style={[styles.aiFab, sheetVisible ? styles.aiFabWithSheet : tourBannerVisible && styles.aiFabAboveBanner]}
        onPress={() => router.push('/(tabs)/chat')}
      >
        <Ionicons name="chatbubble-ellipses" size={20} color="#fff" />
      </TouchableOpacity>

      {/* Hands-free tap-to-talk — ALWAYS available; sits directly above the two
          map control buttons (recenter + chat), tracking their position. */}
      <MicButton
        state={micState}
        onPress={onMicPress}
        right={2}
        bottom={(sheetVisible ? 372 : tourBannerVisible ? 212 : 76) + 56}
      />

      {/* Feature 2: Landmark preview sheet */}
      {showPreview && tappedLandmark && (
        <View style={styles.previewSheet}>
          <View style={styles.previewHeader}>
            <View
              style={[
                styles.chip,
                {
                  backgroundColor:
                    (CATEGORY_COLORS[tappedLandmark.category] ?? '#1565C0') + '22',
                  borderColor: CATEGORY_COLORS[tappedLandmark.category] ?? '#1565C0',
                },
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: CATEGORY_COLORS[tappedLandmark.category] ?? '#1565C0' },
                ]}
              >
                {CATEGORY_LABELS[tappedLandmark.category] ?? tappedLandmark.category}
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleDismissPreview}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="close" size={22} color="#9E9E9E" />
            </TouchableOpacity>
          </View>

          <Text style={styles.previewTitle}>{tappedLandmark.name}</Text>

          {tappedLandmark.isRegulatory && (
            <View style={styles.previewRegBanner}>
              <Ionicons name="warning" size={14} color="#C62828" />
              <Text style={styles.previewRegText}>
                {tappedLandmark.regulatoryMessage}
                {tappedLandmark.regulatoryFineEur > 0
                  ? ` — Fine: €${Math.round(tappedLandmark.regulatoryFineEur)}`
                  : ''}
              </Text>
            </View>
          )}

          <Text style={styles.previewDesc} numberOfLines={3}>
            {tappedLandmark.description}
          </Text>

          {userLocation !== null && (
            <Text style={styles.previewDist}>
              📍{' '}
              {Math.round(
                haversineMetres(
                  userLocation.latitude,
                  userLocation.longitude,
                  tappedLandmark.coordinates.latitude,
                  tappedLandmark.coordinates.longitude,
                ),
              )}{' '}
              m away
            </Text>
          )}

          <View style={styles.previewActions}>
            <TouchableOpacity
              style={styles.previewAIBtn}
              onPress={() => handleAskAI(tappedLandmark.name)}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={14} color="#00C853" />
              <Text style={styles.previewAIBtnText}> Ask AI about this place</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.previewDetailsBtn} onPress={handleFullDetails}>
              <Text style={styles.previewDetailsBtnText}>Full details →</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Free-tap location sheet */}
      {tappedMapPoint !== null && tappedLandmark === null && activeSlug.length === 0 && (() => {
        const pt = tappedMapPoint;
        const typeColor = PLACE_TYPE_COLORS[pt.type ?? ''] ?? '#1565C0';
        const typeLabel = PLACE_TYPE_LABELS[pt.type ?? ''] ?? 'Location';
        return (
          <View style={styles.previewSheet}>
            <View style={styles.previewHeader}>
              <View style={[styles.chip, { backgroundColor: typeColor + '22', borderColor: typeColor }]}>
                <Text style={[styles.chipText, { color: typeColor }]}>{typeLabel}</Text>
              </View>
              <TouchableOpacity
                onPress={() => setTappedMapPoint(null)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons name="close" size={22} color="#9E9E9E" />
              </TouchableOpacity>
            </View>
            <Text style={styles.previewTitle}>{pt.name}</Text>
            {pt.rating !== undefined
              ? <Text style={styles.previewDist}>⭐ {pt.rating.toFixed(1)}{pt.vicinity ? ` · ${pt.vicinity}` : ''}</Text>
              : pt.vicinity
                ? <Text style={styles.previewDist} numberOfLines={1}>{pt.vicinity}</Text>
                : <Text style={styles.previewDist}>{pt.latitude.toFixed(5)}, {pt.longitude.toFixed(5)}</Text>
            }
            <View style={styles.previewActions}>
              <TouchableOpacity
                style={styles.previewAIBtn}
                onPress={() => handleAskAI(pt.name)}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={14} color="#00C853" />
                <Text style={styles.previewAIBtnText}> Ask AI about this</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.previewDetailsBtn}
                onPress={() => void fetchRoute(pt.latitude, pt.longitude)}
              >
                <Ionicons name="navigate" size={14} color="#fff" />
                <Text style={styles.previewDetailsBtnText}> Directions</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.startHereBtn}
              onPress={() => {
                startRide({
                  mode: 'free',
                  freeTarget: { slug: null, lat: pt.latitude, lng: pt.longitude, name: pt.name },
                });
                setTappedMapPoint(null);
              }}
            >
              <Ionicons name="bicycle" size={16} color="#000" />
              <Text style={styles.startHereText}> Start ride here</Text>
            </TouchableOpacity>
          </View>
        );
      })()}

      {/* Map loading overlay */}
      {(locationsLoading || !mapReady) && (
        <View style={styles.mapOverlay}>
          <ActivityIndicator color="#00C853" size="large" />
          <Text style={styles.mapLoadingText}>Loading Barcelona…</Text>
        </View>
      )}

      {/* Tour preview banner */}
      {tourPreview && tourStops.length > 0 && !rideActive && (
        <View style={styles.tourBanner}>
          <View style={styles.tourBannerRow}>
            <Text style={styles.tourBannerTitle} numberOfLines={1}>{tourPreview.tourName}</Text>
            <TouchableOpacity
              onPress={() => { clearTourPreview(); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={20} color="#9E9E9E" />
            </TouchableOpacity>
          </View>
          <Text style={styles.tourBannerMeta}>
            {tourRouteMeta
              ? `${tourStops.length} stops · ${tourRouteMeta.distance} · ${tourRouteMeta.duration} by bike`
              : tourRouteLoading
                ? `${tourStops.length} stops · loading route…`
                : `${tourStops.length} stops`}
          </Text>
          <TouchableOpacity
            style={styles.tourStartBtn}
            onPress={() => {
              startRide({ mode: 'tour', tourId: tourPreview.tourId, stops: tourPreview.slugs });
              clearTourPreview();
            }}
          >
            <Ionicons name="play" size={16} color="#000" />
            <Text style={styles.tourStartBtnText}>Start Tour</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Active tour status banner */}
      {rideActive && rideMode === 'tour' && tourStops.length > 0 && (
        <View style={styles.tourBanner}>
          <Text style={styles.tourBannerTitle}>
            {`Stop ${Math.min(rideVisited.length + 1, rideTourStops.length)}/${rideTourStops.length}`}
          </Text>
          <Text style={styles.tourBannerMeta}>
            {rideTargetSlug
              ? `Next: ${tourStops.find((s) => s.slug === rideTargetSlug)?.name ?? rideTargetSlug}`
              : 'Tour complete 🎉'}
          </Text>
        </View>
      )}

      {/* Group A: top banner stack — zone warning above route info; flows in a
          column so the two never overlap regardless of wrapped text height. */}
      {(activeConflicts.length > 0 || ((routeInfo || routeLoading) && tourStops.length === 0)) && (
        <View style={[styles.topBannerStack, rideActive && styles.topBannerStackRiding]} pointerEvents="box-none">
          {activeConflicts.length > 0 && (
            <View style={styles.routeWarnBanner}>
              <Ionicons name="warning" size={18} color="#fff" />
              <Text style={styles.routeWarnText}>{routeWarningText(activeConflicts)}</Text>
            </View>
          )}
          {tourStops.length === 0 && routeInfo ? (
            <View style={styles.routeBanner}>
              <Ionicons name="bicycle" size={16} color="#fff" />
              <Text style={styles.routeText}>{routeInfo.distance} · {routeInfo.duration} by bike</Text>
              <TouchableOpacity onPress={clearSingleRoute}>
                <Ionicons name="close-circle" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : tourStops.length === 0 && routeLoading ? (
            <View style={styles.routeBanner}>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={styles.routeText}>Loading route…</Text>
              <TouchableOpacity onPress={clearSingleRoute}>
                <Ionicons name="close-circle" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : null}
          {/* Turn-by-turn next maneuver (Group F) */}
          {rideActive && nextTurn && tourStops.length === 0 && (
            <View style={styles.turnBanner}>
              <Ionicons name="navigate" size={16} color="#fff" />
              <Text style={styles.turnText} numberOfLines={2}>
                {`In ${Math.max(10, Math.round(nextTurn.distanceM / 10) * 10)} m · ${nextTurn.instruction}`}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Full landmark card sheet */}
      {showFullCard && (
        <View style={styles.sheet}>
          <View style={styles.sheetHandleArea} {...sheetPan.panHandlers}>
            <View style={styles.sheetHandle} />
          </View>
          {loadingCard ? (
            <View style={styles.sheetLoading}>
              <ActivityIndicator color="#00C853" />
            </View>
          ) : (
            <ScrollView>
              <LandmarkCard
                landmarkName={fullName}
                description={fullDesc}
                category={fullCat}
                isRegulatory={fullIsReg}
                regulatoryMessage={fullRegMsg}
                regulatoryFineEur={fullRegFine}
                affiliateUrl={fullAffiliate}
                isSubscribed={isSubscribed}
                quizQuestion={cardData?.quizQuestion ?? ''}
                quizOptions={cardData?.quizOptions ?? []}
                quizCorrectIndex={cardData?.quizCorrectIndex ?? -1}
                quizExplanation={cardData?.quizExplanation ?? ''}
                quizPoints={cardData?.quizPoints ?? 0}
                quizAlreadyCompleted={cardData?.quizAlreadyCompleted ?? false}
                faqQuestions={cardData?.faqQuestions ?? []}
                faqAnswers={cardData?.faqAnswers ?? []}
                faqIsPremium={cardData?.faqIsPremium ?? []}
                destinationLat={fullLat}
                destinationLng={fullLng}
                onDismiss={handleDismissCard}
                onQuizCorrect={handleQuizCorrect}
                onGetDirections={fullLat !== undefined && fullLng !== undefined
                  ? () => void fetchRoute(fullLat, fullLng)
                  : undefined}
              />
            </ScrollView>
          )}
        </View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1E1E1E',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  fabWithSheet: { bottom: 320 },
  fabAboveBanner: { bottom: 160 },

  aiFab: {
    position: 'absolute',
    bottom: 76,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#00C853',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  aiFabWithSheet: { bottom: 372 },
  aiFabAboveBanner: { bottom: 212 },

  pinHitArea: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pin: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.5,
    shadowRadius: 2,
    elevation: 4,
  },
  bicingMarker: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  bicingMarkerLabel: { color: '#fff', fontSize: 10, fontWeight: '800' },

  // Tour stop pins
  tourPin: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.4,
    shadowRadius: 2,
  },
  tourPinPending: { backgroundColor: '#C62828' },
  tourPinTarget: { backgroundColor: '#FF6F00', transform: [{ scale: 1.2 }] },
  tourPinDone: { backgroundColor: '#00C853' },
  tourPinFinish: { borderColor: '#FFD600', borderWidth: 3 }, // gold ring marks the last stop
  tourPinNum: { color: '#fff', fontSize: 11, fontWeight: '800' },
  finishPin: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#00C853',
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.4,
    shadowRadius: 2,
  },

  // Tour banner
  tourBanner: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: '#1E1E1E',
    borderRadius: 16,
    padding: 16,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  tourBannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  tourBannerTitle: { color: '#fff', fontSize: 17, fontWeight: '700', flex: 1, marginRight: 8 },
  tourBannerMeta: { color: '#9E9E9E', fontSize: 13, marginBottom: 12 },
  tourStartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00C853',
    borderRadius: 10,
    paddingVertical: 12,
    gap: 6,
  },
  tourStartBtnText: { color: '#000', fontSize: 15, fontWeight: '800' },

  // Preview sheet (Feature 2)
  previewSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    paddingBottom: 28,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  chip: {
    borderRadius: 4,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  chipText: { fontSize: 11, fontWeight: '600', letterSpacing: 0.4 },
  previewTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 6,
  },
  previewRegBanner: {
    flexDirection: 'row',
    backgroundColor: '#FFEBEE',
    borderColor: '#EF9A9A',
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
    gap: 6,
    alignItems: 'flex-start',
  },
  previewRegText: { color: '#B71C1C', fontSize: 12, flex: 1, lineHeight: 17 },
  previewDesc: {
    fontSize: 14,
    color: '#424242',
    lineHeight: 20,
    marginBottom: 6,
  },
  previewDist: { fontSize: 12, color: '#757575', marginBottom: 12 },
  previewActions: { flexDirection: 'row', gap: 8 },
  previewAIBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#00C853',
    borderRadius: 10,
    paddingVertical: 10,
  },
  previewAIBtnText: { fontSize: 13, color: '#00C853', fontWeight: '600' },
  previewDetailsBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1565C0',
    borderRadius: 10,
    paddingVertical: 10,
  },
  previewDetailsBtnText: { fontSize: 13, color: '#fff', fontWeight: '600' },
  startHereBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00C853',
    borderRadius: 10,
    paddingVertical: 10,
    marginTop: 8,
  },
  startHereText: { fontSize: 13, color: '#000', fontWeight: '700' },

  // Full card sheet
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '50%',
    paddingBottom: 12,
    paddingTop: 4,
    backgroundColor: '#121212',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  sheetHandleArea: { alignItems: 'center', paddingTop: 6, paddingBottom: 10 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#555' },
  sheetLoading: {
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#121212',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  mapLoadingText: { color: '#aaa', fontSize: 14 },
  topBannerStack: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    gap: 8,
  },
  topBannerStackRiding: { top: 104 }, // clear the global ride banner at the top
  routeBanner: {
    backgroundColor: '#1B5E20',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  routeText: { color: '#fff', fontSize: 13, fontWeight: '600', flex: 1 },
  turnBanner: {
    backgroundColor: '#0D47A1',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  turnText: { color: '#fff', fontSize: 14, fontWeight: '700', flex: 1 },
  routeWarnBanner: {
    backgroundColor: '#C62828',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
  },
  routeWarnText: { color: '#fff', fontSize: 13, fontWeight: '700', flex: 1, lineHeight: 18 },
});
