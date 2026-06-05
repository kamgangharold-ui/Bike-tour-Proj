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
  const rideFreeTarget = useAppStore((s) => s.rideFreeTarget);
  const rideDistanceMeters = useAppStore((s) => s.rideDistanceMeters);
  const addRideDistance = useAppStore((s) => s.addRideDistance);
  const appendTrackPoint = useAppStore((s) => s.appendTrackPoint);

  const [pois, setPois] = useState<Map<string, Poi>>(new Map());
  const [position, setPosition] = useState<{ latitude: number; longitude: number } | null>(null);
  const [deviceHeading, setDeviceHeading] = useState<number | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [freeTargetSlug, setFreeTargetSlug] = useState<string | null>(null);

  const lastPosRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const lastTrackRef = useRef<{ latitude: number; longitude: number } | null>(null);

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
      lastTrackRef.current = null;
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
          const last = lastPosRef.current; // previous raw reading
          // `moved` = distance from the PREVIOUS reading. Used for both distance
          // accumulation and the glitch filter so a bad fix is rejected relative
          // to where we just were — not relative to the last recorded track point
          // (which would freeze the track permanently after a real signal gap).
          const moved = last
            ? haversineMetres(last.latitude, last.longitude, p.latitude, p.longitude)
            : 0;
          if (last && moved >= 3 && moved < 200) addRideDistance(moved); // skip jitter & teleports

          // Throttled track recording (~every 15 m) for the recap souvenir. Skip
          // low-accuracy and >=500 m glitch readings; lastPosRef still advances
          // below, so the anchor recovers on the next good reading.
          const acc = pos.coords.accuracy;
          const accurate = acc == null || acc <= 50; // metres
          if (accurate && moved < 500) {
            const lt = lastTrackRef.current;
            const spacing = lt
              ? haversineMetres(lt.latitude, lt.longitude, p.latitude, p.longitude)
              : Infinity;
            if (lt === null || spacing >= 15) {
              appendTrackPoint({ latitude: p.latitude, longitude: p.longitude, t: pos.timestamp });
              lastTrackRef.current = p;
            }
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
  }, [rideActive, addRideDistance, appendTrackPoint]);

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

  // Resolve the active target: tour → current stop; free → the chosen
  // destination (rideFreeTarget) until it's reached, else the nearest landmark.
  type Target = { slug: string | null; name: string; latitude: number; longitude: number };
  let target: Target | null = null;
  if (rideMode === 'tour') {
    const t = rideTargetSlug ? pois.get(rideTargetSlug) : undefined;
    if (t) target = t;
  } else if (rideFreeTarget && !(rideFreeTarget.slug && rideVisited.includes(rideFreeTarget.slug))) {
    target = {
      slug: rideFreeTarget.slug,
      name: rideFreeTarget.name,
      latitude: rideFreeTarget.lat,
      longitude: rideFreeTarget.lng,
    };
  } else {
    const t = freeTargetSlug ? pois.get(freeTargetSlug) : undefined;
    if (t) target = t;
  }

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
