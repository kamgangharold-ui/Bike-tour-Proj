// Persists a finished ride to Firestore (best-effort) and then clears local
// ride state. Kept out of the Zustand store so the store stays free of
// Firebase imports; both End buttons (banner + Ride tab) call this.

import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import { useAppStore } from '../store/useAppStore';

export async function endRideAndSave(): Promise<void> {
  const s = useAppStore.getState();
  const uid = auth.currentUser?.uid;

  // Only record rides that actually went somewhere or saw a landmark.
  const worthSaving = s.rideActive && (s.rideVisited.length > 0 || s.rideDistanceMeters > 0);
  if (uid && worthSaving) {
    try {
      await addDoc(collection(db, 'rides'), {
        user_uid: uid,
        started_at: s.rideStartedAt ? new Date(s.rideStartedAt) : serverTimestamp(),
        ended_at: serverTimestamp(),
        mode: s.rideMode,
        tour_id: s.rideTourId,
        visited_slugs: s.rideVisited,
        distance_km: Math.round((s.rideDistanceMeters / 1000) * 100) / 100,
      });
    } catch (e) {
      console.warn('[rides] save failed', e);
    }
  }

  s.endRide();
}
