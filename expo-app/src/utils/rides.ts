// Persists a finished ride to Firestore (best-effort) and then clears local
// ride state. Kept out of the Zustand store so the store stays free of
// Firebase imports; both End buttons (banner + Ride tab) call this.

import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import { useAppStore, type RideSummary } from '../store/useAppStore';

// Ends the ride: ALWAYS clears local ride state, builds a recap summary when the
// ride is worth recapping (for the shareable recap screen), and persists to
// Firestore best-effort. Returns the recap summary, or null when there's nothing
// to recap (a trivial ride, or an already-ended ride from a double-tap).
export async function endRideAndSave(): Promise<RideSummary | null> {
  const s = useAppStore.getState();
  const uid = auth.currentUser?.uid;

  // Nothing to end (e.g. the 2nd tap of a double-tap, which sees an already-ended
  // ride) — return without touching lastRide so a good recap is never clobbered.
  if (!s.rideActive) return null;

  // A ride is "worth recapping" only if it went somewhere or saw a landmark.
  const worthSaving = s.rideVisited.length > 0 || s.rideDistanceMeters > 0;

  const endedAt = Date.now();
  const startedAt = s.rideStartedAt || endedAt;
  const durationSec = Math.max(0, Math.round((endedAt - startedAt) / 1000));
  const distanceMeters = s.rideDistanceMeters;
  const summary: RideSummary | null = worthSaving
    ? {
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
      }
    : null;

  // Record the recap only when worthwhile (so a trivial end can't wipe a prior
  // one), but ALWAYS end the ride. Neither blocks on the network — Firestore
  // writes can stall indefinitely while offline.
  if (summary) s.setLastRide(summary);
  s.endRide();

  // Persist best-effort in the background, using captured locals (store is now
  // cleared). A failure/offline write never affects the recap.
  if (uid && summary) {
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
