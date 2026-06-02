import { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Linking,
} from 'react-native';
import MapView, { Marker, UrlTile, PROVIDER_DEFAULT, PROVIDER_GOOGLE, Callout } from 'react-native-maps';
import { Text } from 'react-native';
import { collection, getDocs, query, where, limit, orderBy, setDoc, doc, arrayUnion, increment } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';
import { db, auth } from '../../src/firebase/config';
import { useAppStore } from '../../src/store/useAppStore';
import { useGeofencing } from '../../src/hooks/useGeofencing';
import LandmarkCard from '../../src/components/LandmarkCard';
import { BARCELONA_CENTER } from '../../constants/rules';

interface LocationDoc {
  id: string;
  name: string;
  slug: string;
  category: string;
  coordinates: { latitude: number; longitude: number };
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

const CATEGORY_COLORS: Record<string, string> = {
  landmark: '#1565C0',
  dismount_zone: '#B71C1C',
  parking: '#2E7D32',
  hazard: '#E65100',
  viewpoint: '#4A148C',
};

export default function MapScreen() {
  const mapRef = useRef<MapView>(null);
  const [locations, setLocations] = useState<LocationDoc[]>([]);
  const [cardData, setCardData] = useState<CardData | null>(null);
  const [loadingCard, setLoadingCard] = useState(false);

  const activeSlug = useAppStore((s) => s.activeSlug);
  const activeName = useAppStore((s) => s.activeName);
  const activeDescription = useAppStore((s) => s.activeDescription);
  const activeCategory = useAppStore((s) => s.activeCategory);
  const activeIsRegulatory = useAppStore((s) => s.activeIsRegulatory);
  const activeRegulatoryMessage = useAppStore((s) => s.activeRegulatoryMessage);
  const activeRegulatoryFineEur = useAppStore((s) => s.activeRegulatoryFineEur);
  const activeAffiliateUrl = useAppStore((s) => s.activeAffiliateUrl);
  const activeAudioUrl = useAppStore((s) => s.activeAudioUrl);
  const isSubscribed = useAppStore((s) => s.isSubscribed);
  const exitLandmark = useAppStore((s) => s.exitLandmark);

  useGeofencing();

  useEffect(() => {
    (async () => {
      const snap = await getDocs(
        query(collection(db, 'locations'), where('is_active', '==', true)),
      );
      setLocations(
        snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            name: (data['name'] as string) ?? '',
            slug: (data['slug'] as string) ?? d.id,
            category: (data['category'] as string) ?? 'landmark',
            coordinates: data['coordinates'] as { latitude: number; longitude: number },
          };
        }),
      );
    })();
  }, []);

  const fetchCardData = useCallback(async (slug: string) => {
    setLoadingCard(true);
    setCardData(null);
    try {
      const [quizSnap, faqSnap] = await Promise.all([
        getDocs(
          query(
            collection(db, 'quizzes'),
            where('location_slug', '==', slug),
            where('is_active', '==', true),
            limit(1),
          ),
        ),
        getDocs(
          query(
            collection(db, 'faqs'),
            where('location_slug', '==', slug),
            where('is_active', '==', true),
            orderBy('sort_order'),
            limit(6),
          ),
        ),
      ]);

      const user = auth.currentUser;
      let completedIds: string[] = [];
      if (user) {
        const { getDoc } = await import('firebase/firestore');
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        completedIds = (userDoc.data()?.['completed_quiz_ids'] as string[]) ?? [];
      }

      let quizQuestion = '';
      let quizOptions: string[] = [];
      let quizCorrectIndex = -1;
      let quizExplanation = '';
      let quizPoints = 0;
      if (!quizSnap.empty) {
        const q = quizSnap.docs[0].data();
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
        faqQuestions: faqSnap.docs.map((d) => (d.data()['question'] as string) ?? ''),
        faqAnswers: faqSnap.docs.map((d) => (d.data()['answer'] as string) ?? ''),
        faqIsPremium: faqSnap.docs.map((d) => (d.data()['is_premium'] as boolean) ?? false),
      });
    } finally {
      setLoadingCard(false);
    }
  }, []);

  useEffect(() => {
    if (activeSlug) fetchCardData(activeSlug);
    else setCardData(null);
  }, [activeSlug, fetchCardData]);

  const handleQuizCorrect = async (points: number) => {
    const user = auth.currentUser;
    if (!user || !activeSlug) return;
    setCardData((prev) => prev ? { ...prev, quizAlreadyCompleted: true } : prev);
    await setDoc(
      doc(db, 'users', user.uid),
      {
        completed_quiz_ids: arrayUnion(activeSlug),
        total_points: increment(points),
        visited_location_slugs: arrayUnion(activeSlug),
      },
      { merge: true },
    );
  };

  const handleRecenter = () => {
    mapRef.current?.animateToRegion({
      ...BARCELONA_CENTER,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    });
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
        showsUserLocation
        initialRegion={{
          ...BARCELONA_CENTER,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }}
      >
        <UrlTile
          urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          shouldReplaceMapContent={Platform.OS !== 'android'}
          maximumZ={19}
          flipY={false}
        />
        {locations.map((loc) => {
          if (!loc.coordinates) return null;
          const color = CATEGORY_COLORS[loc.category] ?? '#1565C0';
          return (
            <Marker
              key={loc.id}
              coordinate={loc.coordinates}
              pinColor={color}
            >
              <Callout>
                <Text style={styles.calloutText}>{loc.name}</Text>
              </Callout>
            </Marker>
          );
        })}
      </MapView>

      {/* Re-center FAB */}
      <TouchableOpacity
        style={[styles.fab, activeSlug ? styles.fabWithCard : undefined]}
        onPress={handleRecenter}
      >
        <Ionicons name="navigate" size={20} color="#fff" />
      </TouchableOpacity>

      {/* Landmark bottom sheet */}
      {activeSlug.length > 0 && (
        <View style={styles.sheet}>
          {loadingCard ? (
            <View style={styles.sheetLoading}>
              <ActivityIndicator color="#00C853" />
            </View>
          ) : (
            <ScrollView>
              <LandmarkCard
                landmarkName={activeName}
                description={activeDescription}
                category={activeCategory}
                isRegulatory={activeIsRegulatory}
                regulatoryMessage={activeRegulatoryMessage}
                regulatoryFineEur={activeRegulatoryFineEur}
                audioUrl={activeAudioUrl}
                affiliateUrl={activeAffiliateUrl}
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
                onDismiss={() => exitLandmark(activeSlug)}
                onQuizCorrect={handleQuizCorrect}
                onAudioPlay={() => {
                  if (activeAudioUrl) Linking.openURL(activeAudioUrl);
                }}
              />
            </ScrollView>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  fabWithCard: { bottom: 320 },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: 300,
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
  calloutText: { fontSize: 13, fontWeight: '600', color: '#1A1A1A', minWidth: 80, textAlign: 'center' },
});
