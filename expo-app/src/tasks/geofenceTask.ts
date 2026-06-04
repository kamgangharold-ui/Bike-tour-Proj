import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAppStore } from '../store/useAppStore';

export const GEOFENCE_TASK = 'BIKE_TOUR_GEOFENCE';

// Must be defined at module top-level so TaskManager can find it in background JS context.
TaskManager.defineTask(GEOFENCE_TASK, async ({ data, error }: TaskManager.TaskManagerTaskBody<{ eventType: Location.GeofencingEventType; region: Location.LocationRegion }>) => {
  if (error) {
    console.warn('[Geofence] task error:', error.message);
    return;
  }

  const { eventType, region } = data;
  const slug = region.identifier ?? '';

  if (eventType === Location.GeofencingEventType.Enter) {
    const snap = await getDocs(
      query(collection(db, 'locations'), where('slug', '==', slug)),
    );
    if (snap.empty) return;

    const loc = snap.docs[0].data();
    const isRegulatory = !!loc['regulatory_alert'];
    const regAlert = loc['regulatory_alert'] as Record<string, unknown> | undefined;

    useAppStore.getState().enterLandmark({
      activeSlug: slug,
      activeName: (loc['name'] as string) ?? '',
      activeDescription: (loc['short_description'] as string) ?? '',
      activeCategory: (loc['category'] as string) ?? 'landmark',
      activeIsRegulatory: isRegulatory,
      activeRegulatoryMessage: (regAlert?.['message'] as string) ?? '',
      activeRegulatoryFineEur: (regAlert?.['fine_eur'] as number) ?? 0,
      activeAffiliateUrl: (loc['getyourguide_affiliate_url'] as string) ?? '',
      activeAudioUrl: (loc['audio_url'] as string) ?? '',
    });

    await Notifications.scheduleNotificationAsync({
      content: {
        title: ((loc['name'] as string | undefined) ?? 'Landmark'),
        body: isRegulatory
          ? `⚠️ ${(regAlert?.['message'] as string) ?? ''}`
          : (loc['short_description'] as string) ?? '',
        data: { slug },
      },
      trigger: null,
    });

    // If a guided ride is active, record the visit (and advance the tour target).
    useAppStore.getState().markRideVisited(slug);
  } else if (eventType === Location.GeofencingEventType.Exit) {
    useAppStore.getState().exitLandmark(slug);
  }
});
