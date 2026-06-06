import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAppStore } from '../store/useAppStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { speak } from '../utils/voice';

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

    // Gate the notification on the user's Settings (Group D). This is a fresh
    // background JS context, so rehydrate the persisted settings first.
    try { await useSettingsStore.persist.rehydrate(); } catch { /* use defaults */ }
    const { landmarkAlertsEnabled, safetyAlertsEnabled } = useSettingsStore.getState();
    const notifyAllowed = isRegulatory ? safetyAlertsEnabled : landmarkAlertsEnabled;

    if (notifyAllowed) {
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
    }

    // Hands-free voice announcement. Gated by voiceGuidanceEnabled inside speak()
    // (the settings store was rehydrated just above for this background context).
    // Regulatory zones speak an URGENT, queue-preempting warning.
    const name = (loc['name'] as string) ?? 'a landmark';
    if (isRegulatory) {
      const message = (regAlert?.['message'] as string) ?? 'cycling restriction ahead';
      const fine = (regAlert?.['fine_eur'] as number) ?? 0;
      const fineText = fine > 0 ? ` Fine: ${Math.round(fine)} euros.` : '';
      speak(`Warning: ${name}. ${message}${fineText}`, { priority: 'urgent' });
    } else {
      const desc = (loc['short_description'] as string) ?? '';
      speak(`You're arriving at ${name}.${desc ? ' ' + desc : ''}`);
    }

    // If a guided ride is active, record the visit (and advance the tour target).
    // Always done regardless of the notification toggles (it's not a notification).
    useAppStore.getState().markRideVisited(slug);
  } else if (eventType === Location.GeofencingEventType.Exit) {
    useAppStore.getState().exitLandmark(slug);
  }
});
