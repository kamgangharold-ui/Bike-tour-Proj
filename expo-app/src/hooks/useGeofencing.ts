import { useState, useEffect } from 'react';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { GEOFENCE_TASK } from '../tasks/geofenceTask';

export function useGeofencing() {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const fg = await Location.requestForegroundPermissionsAsync();
        if (fg.status !== 'granted') {
          if (!cancelled) setError('Foreground location permission denied');
          return;
        }

        const bg = await Location.requestBackgroundPermissionsAsync();
        if (bg.status !== 'granted') {
          if (!cancelled) setError('Background location permission denied');
          return;
        }

        await Notifications.requestPermissionsAsync();

        const snap = await getDocs(
          query(collection(db, 'locations'), where('is_active', '==', true)),
        );

        const regions: Location.LocationRegion[] = snap.docs.map((d) => {
          const data = d.data();
          const coords = data['coordinates'] as { latitude: number; longitude: number };
          return {
            identifier: (data['slug'] as string) ?? d.id,
            latitude: coords?.latitude ?? 0,
            longitude: coords?.longitude ?? 0,
            radius: (data['geofence_radius_metres'] as number) ?? 40,
            notifyOnEntry: true,
            notifyOnExit: true,
          };
        });

        if (regions.length > 0) {
          const alreadyRunning = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK);
          if (!alreadyRunning) {
            await Location.startGeofencingAsync(GEOFENCE_TASK, regions);
          }
        }

        if (!cancelled) setIsReady(true);
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Geofencing setup failed');
        }
      }
    })();

    return () => { cancelled = true; };
  }, []);

  return { isReady, error };
}
