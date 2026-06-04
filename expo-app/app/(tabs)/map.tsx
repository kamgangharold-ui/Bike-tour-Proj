import { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Linking,
  Platform,
} from 'react-native';
import MapView, { Marker, UrlTile, PROVIDER_DEFAULT } from 'react-native-maps';
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
import { BARCELONA_CENTER } from '../../constants/rules';
import { haversineMetres } from '../../src/utils/haversine';

// ─── Types ───────────────────────────────────────────────────────────────────

type Coords = { latitude: number; longitude: number };

interface LocationDoc {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string;
  coordinates: Coords;
  isRegulatory: boolean;
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

const CATEGORY_LABELS: Record<string, string> = {
  landmark: 'Landmark',
  dismount_zone: 'Dismount Zone',
  parking: 'Parking',
  hazard: 'Hazard',
  viewpoint: 'Viewpoint',
};

const BICING_INFO = 'https://api.bsmsa.eu/ext/api/bsm/gbfs/v2/en/station_information.json';
const BICING_STATUS = 'https://api.bsmsa.eu/ext/api/bsm/gbfs/v2/en/station_status.json';
const FETCH_OPTS = { headers: { Accept: 'application/json', 'User-Agent': 'BikeTourGuide/1.0' } };

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

  // Free-tap state (any map location)
  const [tappedMapPoint, setTappedMapPoint] = useState<{
    latitude: number;
    longitude: number;
    name: string;
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

  useGeofencing();

  // ── Feature 4: Real-time position tracking ──────────────────────────────────
  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const initial = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setUserLocation({
        latitude: initial.coords.latitude,
        longitude: initial.coords.longitude,
      });
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 10 },
        (pos) =>
          setUserLocation({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          }),
      );
    })();
    return () => { sub?.remove(); };
  }, []);

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
          isRegulatory: !!reg,
          regulatoryMessage: (reg?.['message'] as string) ?? '',
          regulatoryFineEur: (reg?.['fine_eur'] as number) ?? 0,
          audioUrl: (data['audio_url'] as string) ?? '',
          affiliateUrl: (data['getyourguide_affiliate_url'] as string) ?? '',
        } satisfies LocationDoc;
      });
      const seen = new Set<string>();
      const deduplicated = docs.filter((loc) => {
        if (seen.has(loc.slug)) return false;
        seen.add(loc.slug);
        return true;
      });
      setLocations(deduplicated);
      } catch (e) {
        console.warn('[Map] Firestore fetch failed', e);
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

  const handleDismissCard = useCallback(() => {
    if (tappedLandmark) {
      setTappedLandmark(null);
      setShowFullDetails(false);
      setCardData(null);
    } else {
      exitLandmark(activeSlug);
    }
  }, [tappedLandmark, exitLandmark, activeSlug]);

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

  // ── Free-tap: any map location ────────────────────────────────────────────────
  const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
        { headers: { 'User-Agent': 'BikeTourGuide/1.0', Accept: 'application/json' } },
      );
      const data = await res.json() as {
        name?: string;
        display_name?: string;
        address?: { road?: string; neighbourhood?: string; suburb?: string; city_district?: string };
      };
      const a = data.address;
      return data.name ?? a?.road ?? a?.neighbourhood ?? a?.suburb ?? a?.city_district ?? data.display_name ?? 'This location';
    } catch {
      return 'This location';
    }
  };

  const handleMapPress = useCallback(async (e: { nativeEvent: { coordinate: Coords } }) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;

    // Tap within 80 m of a landmark → treat as landmark tap (shows preview + Full details)
    const nearby = locations.find(
      (loc) => haversineMetres(latitude, longitude, loc.coordinates.latitude, loc.coordinates.longitude) < 80,
    );
    if (nearby) {
      handleLandmarkPress(nearby);
      return;
    }

    setTappedLandmark(null);
    setShowFullDetails(false);
    setCardData(null);
    setTappedMapPoint({ latitude, longitude, name: '…' });
    const name = await reverseGeocode(latitude, longitude);
    setTappedMapPoint({ latitude, longitude, name });
  }, [locations, handleLandmarkPress]);

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

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_DEFAULT}
        mapType={Platform.OS === 'android' ? 'none' : 'standard'}
        showsUserLocation
        onMapReady={() => setMapReady(true)}
        onPress={(e) => void handleMapPress(e)}
        initialRegion={{ ...BARCELONA_CENTER, latitudeDelta: 0.02, longitudeDelta: 0.02 }}
      >
        {Platform.OS === 'android' && (
          <UrlTile
            urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            maximumZ={19}
            flipY={false}
            zIndex={-1}
          />
        )}
        {/* Landmark markers */}
        {locations.map((loc) => {
          if (!loc.coordinates.latitude && !loc.coordinates.longitude) return null;
          return (
            <Marker
              key={loc.id}
              coordinate={loc.coordinates}
              pinColor={CATEGORY_COLORS[loc.category] ?? '#1565C0'}
              tracksViewChanges={false}
              onPress={() => handleLandmarkPress(loc)}
            />
          );
        })}

        {/* Bicing station markers */}
        {bicingStations.map((station) => (
          <Marker
            key={`bicing-${station.station_id}`}
            coordinate={{ latitude: station.lat, longitude: station.lon }}
            tracksViewChanges={false}
          >
            <View
              style={[
                styles.bicingMarker,
                { backgroundColor: station.num_bikes_available > 0 ? '#2E7D32' : '#C62828' },
              ]}
            >
              <Text style={styles.bicingMarkerLabel}>B</Text>
            </View>
          </Marker>
        ))}
      </MapView>

      {/* Re-centre FAB */}
      <TouchableOpacity
        style={[styles.fab, sheetVisible && styles.fabWithSheet]}
        onPress={handleRecenter}
      >
        <Ionicons name="navigate" size={20} color="#fff" />
      </TouchableOpacity>

      {/* AI chat FAB */}
      <TouchableOpacity
        style={[styles.aiFab, sheetVisible && styles.aiFabWithSheet]}
        onPress={() => router.push('/(tabs)/chat')}
      >
        <Ionicons name="chatbubble-ellipses" size={20} color="#fff" />
      </TouchableOpacity>

      {/* Cycling routes FAB — opens BikAI pre-filled with a cycling route question */}
      <TouchableOpacity
        style={[styles.bicingFab, sheetVisible && styles.bicingFabWithSheet, { backgroundColor: '#00C853' }]}
        onPress={() => {
          setChatPrefill('What are the best cycling routes and bike lanes near my current location in Barcelona?');
          router.push('/(tabs)/chat');
        }}
      >
        <Ionicons name="bicycle" size={20} color="#fff" />
      </TouchableOpacity>

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
      {tappedMapPoint !== null && tappedLandmark === null && activeSlug.length === 0 && (
        <View style={styles.previewSheet}>
          <View style={styles.previewHeader}>
            <View style={[styles.chip, { backgroundColor: '#E3F2FD', borderColor: '#1565C0' }]}>
              <Text style={[styles.chipText, { color: '#1565C0' }]}>Location</Text>
            </View>
            <TouchableOpacity
              onPress={() => setTappedMapPoint(null)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="close" size={22} color="#9E9E9E" />
            </TouchableOpacity>
          </View>
          <Text style={styles.previewTitle}>{tappedMapPoint.name}</Text>
          <Text style={styles.previewDist}>
            {tappedMapPoint.latitude.toFixed(5)}, {tappedMapPoint.longitude.toFixed(5)}
          </Text>
          <View style={styles.previewActions}>
            <TouchableOpacity
              style={styles.previewAIBtn}
              onPress={() => handleAskAI(tappedMapPoint.name)}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={14} color="#00C853" />
              <Text style={styles.previewAIBtnText}> Ask AI about this</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.previewDetailsBtn}
              onPress={() => {
                const url = Platform.OS === 'ios'
                  ? `maps://maps.apple.com/?saddr=Current+Location&daddr=${tappedMapPoint.latitude},${tappedMapPoint.longitude}&dirflg=b`
                  : `https://www.google.com/maps/dir/?api=1&destination=${tappedMapPoint.latitude},${tappedMapPoint.longitude}&travelmode=bicycling`;
                void Linking.openURL(url);
              }}
            >
              <Ionicons name="navigate" size={14} color="#fff" />
              <Text style={styles.previewDetailsBtnText}> Directions</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Map loading overlay */}
      {(locationsLoading || !mapReady) && (
        <View style={styles.mapOverlay}>
          <ActivityIndicator color="#00C853" size="large" />
          <Text style={styles.mapLoadingText}>Loading Barcelona…</Text>
        </View>
      )}

      {/* Full landmark card sheet */}
      {showFullCard && (
        <View style={styles.sheet}>
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

  bicingFab: {
    position: 'absolute',
    bottom: 128,
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
  bicingFabWithSheet: { bottom: 424 },

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

  // Full card sheet
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '75%',
    paddingBottom: 12,
    paddingTop: 8,
    backgroundColor: '#121212',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
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
});
