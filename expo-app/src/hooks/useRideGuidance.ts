// ─── Ride guidance ──────────────────────────────────────────────────────────────
// Drives the live directional guidance while a ride is active:
//  • watches GPS position (accumulates ride distance, computes distance-to-target),
//  • watches device heading (for the on-screen arrow),
//  • picks the effective target (curated tour → next stop; free roam → nearest
//    unvisited landmark).
// Mounted once (in the global RideBanner) so there is a single set of subscriptions.

import { useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAppStore } from '../store/useAppStore';
import { haversineMetres, bearing, bearingToCompass } from '../utils/haversine';

interface Poi { slug: string; name: string; latitude: number; longitude: number }

export interface RideGuidance {
  targetSlug: string | null;
  targetName: string | null;
  distanceToTargetM: number | null;
  bearingToTarget: number | null;
  deviceHeading: number | null;
  arrowRotation: number;     // degrees to rotate an upward arrow (bearing − heading)
  headingLabel: string;      // compass label of the bearing to target, e.g. "NE"
  elapsedSec: number;
  visitedCount: number;
  distanceTraveledM: number;
}

function angleDiff(a: number, b: number): number {
  return ((((a - b) % 360) + 540) % 360) - 180; // signed shortest delta, −180..180
}

export function useRideGuidance(): RideGuidance {
  const rideActive = useAppStore((s) => s.rideActive);
  const rideMode = useAppStore((s) => s.rideMode);
  const rideTargetSlug = useAppStore((s) => s.rideTargetSlug);
  const rideStartedAt = useAppStore((s) => s.rideStartedAt);
  const rideVisited = useAppStore((s) => s.rideVisited);
  const rideDistanceMeters = useAppStore((s) => s.rideDistanceMeters);
  const addRideDistance = useAppStore((s) => s.addRideDistance);

  const [pois, setPois] = useState<Map<string, Poi>>(new Map());
  const [position, setPosition] = useState<{ latitude: number; longitude: number } | null>(null);
  const [deviceHeading, setDeviceHeading] = useState<number | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [freeTargetSlug, setFreeTargetSlug] = useState<string | null>(null);

  const lastPosRef = useRef<{ latitude: number; longitude: number } | null>(null);

  // Load active landmarks once per ride.
  useEffect(() => {
    if (!rideActive) { setPois(new Map()); return; }
    let cancelled = false;
    void (async () => {
      try {
        const snap = await getDocs(query(collection(db, 'locations'), where('is_active', '==', true)));
        if (cancelled) return;
        const m = new Map<string, Poi>();
        snap.docs.forEach((d) => {
          const data = d.data();
          const slug = (data['slug'] as string) ?? d.id;
          const c = data['coordinates'] as { latitude?: number; longitude?: number } | null;
          if (c?.latitude != null && c?.longitude != null) {
            m.set(slug, { slug, name: (data['name'] as string) ?? slug, latitude: c.latitude, longitude: c.longitude });
          }
        });
        setPois(m);
      } catch (e) {
        console.warn('[RideGuidance] landmark fetch failed', e);
      }
    })();
    return () => { cancelled = true; };
  }, [rideActive]);

  // Position + heading subscriptions.
  useEffect(() => {
    if (!rideActive) {
      setPosition(null);
      setDeviceHeading(null);
      lastPosRef.current = null;
      return;
    }
    let posSub: Location.LocationSubscription | null = null;
    let headSub: Location.LocationSubscription | null = null;
    void (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      posSub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 5 },
        (pos) => {
          const p = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
          setPosition(p);
          const last = lastPosRef.current;
          if (last) {
            const d = haversineMetres(last.latitude, last.longitude, p.latitude, p.longitude);
            if (d >= 3 && d < 200) addRideDistance(d); // skip GPS jitter and teleports
          }
          lastPosRef.current = p;
        },
      );
      headSub = await Location.watchHeadingAsync((h) => {
        const heading = h.trueHeading >= 0 ? h.trueHeading : h.magHeading;
        setDeviceHeading((prev) => (prev == null || Math.abs(angleDiff(heading, prev)) > 2 ? heading : prev));
      });
    })();
    return () => { posSub?.remove(); headSub?.remove(); };
  }, [rideActive, addRideDistance]);

  // Elapsed timer.
  useEffect(() => {
    if (!rideActive) { setElapsedSec(0); return; }
    const id = setInterval(() => setElapsedSec(Math.max(0, Math.floor((Date.now() - rideStartedAt) / 1000))), 1000);
    return () => clearInterval(id);
  }, [rideActive, rideStartedAt]);

  // Free roam: target the nearest landmark not yet visited this ride.
  useEffect(() => {
    if (rideMode === 'tour' || !position || pois.size === 0) return;
    let bestSlug: string | null = null;
    let bestDist = Infinity;
    for (const poi of pois.values()) {
      if (rideVisited.includes(poi.slug)) continue;
      const d = haversineMetres(position.latitude, position.longitude, poi.latitude, poi.longitude);
      if (d < bestDist) { bestDist = d; bestSlug = poi.slug; }
    }
    setFreeTargetSlug(bestSlug);
  }, [rideMode, position, pois, rideVisited]);

  const targetSlug = rideMode === 'tour' ? rideTargetSlug : freeTargetSlug;
  const target = targetSlug ? pois.get(targetSlug) ?? null : null;

  let distanceToTargetM: number | null = null;
  let bearingToTarget: number | null = null;
  if (target && position) {
    distanceToTargetM = haversineMetres(position.latitude, position.longitude, target.latitude, target.longitude);
    bearingToTarget = bearing(position, target);
  }
  const arrowRotation =
    bearingToTarget != null && deviceHeading != null ? bearingToTarget - deviceHeading : bearingToTarget ?? 0;
  const headingLabel = bearingToTarget != null ? bearingToCompass(bearingToTarget) : '';

  return {
    targetSlug: target?.slug ?? null,
    targetName: target?.name ?? null,
    distanceToTargetM,
    bearingToTarget,
    deviceHeading,
    arrowRotation,
    headingLabel,
    elapsedSec,
    visitedCount: rideVisited.length,
    distanceTraveledM: rideDistanceMeters,
  };
}
