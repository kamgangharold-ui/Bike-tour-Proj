// Persists a finished ride to Firestore (best-effort) and then clears local
// ride state. Kept out of the Zustand store so the store stays free of
// Firebase imports; both End buttons (banner + Ride tab) call this.

import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import { useAppStore, type RideSummary } from '../store/useAppStore';

// Ends the ride: builds a recap summary from the live state (for the shareable
// recap screen), persists the ride to Firestore (best-effort), then clears local
// ride state. Returns the recap summary, or null for a ride not worth recapping.
export async function endRideAndSave(): Promise<RideSummary | null> {
  const s = useAppStore.getState();
  const uid = auth.currentUser?.uid;

  // Only record / recap rides that actually went somewhere or saw a landmark.
  // Bail BEFORE touching lastRide so a no-op end (e.g. the 2nd of a double-tap,
  // which sees an already-ended ride) can never clobber a good recap.
  const worthSaving = s.rideActive && (s.rideVisited.length > 0 || s.rideDistanceMeters > 0);
  if (!worthSaving) return null;

  const endedAt = Date.now();
  const startedAt = s.rideStartedAt || endedAt;
  const durationSec = Math.max(0, Math.round((endedAt - startedAt) / 1000));
  const distanceMeters = s.rideDistanceMeters;
  const summary: RideSummary = {
    startedAt,
    endedAt,
    durationSec,
    distanceMeters,
    avgSpeedKmh: durationSec > 0 ? distanceMeters / 1000 / (durationSec / 3600) : 0,
    mode: s.rideMode,
    tourId: s.rideTourId,
    tourStops: s.rideTourStops,
    visitedSlugs: s.rideVisited,
    track:
      s.rideTrack.length >= 2
        ? s.rideTrack.map((p) => ({ latitude: p.latitude, longitude: p.longitude }))
        : undefined,
  };

  // Surface the recap and clear ride state immediately — do NOT block on the
  // network. Firestore writes can stall indefinitely while offline, which would
  // otherwise hang the End → recap transition.
  s.setLastRide(summary);
  s.endRide();

  // Persist best-effort in the background, using captured locals (store is now
  // cleared). A failure/offline write never affects the recap.
  if (uid) {
    void addDoc(collection(db, 'rides'), {
      user_uid: uid,
      started_at: new Date(summary.startedAt),
      ended_at: serverTimestamp(),
      mode: summary.mode,
      tour_id: summary.tourId,
      visited_slugs: summary.visitedSlugs,
      distance_km: Math.round((summary.distanceMeters / 1000) * 100) / 100,
    }).catch((e) => console.warn('[rides] save failed', e));
  }

  return summary;
}
