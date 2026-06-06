// Cache for computed OSRM routes (Group C) so re-renders and return visits don't
// re-fetch. In-memory Map for instant same-session hits, backed by AsyncStorage
// so a route survives an app restart. Keyed by the OSRM path (profile+waypoints).
// Bounded (in-memory + on disk) so arbitrary free-ride destinations can't grow it
// without limit; clearable from Settings → "Clear cached data".

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ManeuverStep } from './routing';

export type LatLng = { latitude: number; longitude: number };

export interface CachedRoute {
  coords: LatLng[];
  distance: number; // metres
  duration: number; // seconds
  steps?: ManeuverStep[]; // turn-by-turn maneuvers (single-leg routes)
}

const PREFIX = 'route:';
const INDEX_KEY = 'route:__index__'; // ordered list of cached keys (oldest first)
const MAX = 60;
const mem = new Map<string, CachedRoute>();

async function loadIndex(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(INDEX_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export async function getCachedRoute(key: string): Promise<CachedRoute | null> {
  const hit = mem.get(key);
  if (hit) return hit;
  try {
    const raw = await AsyncStorage.getItem(`${PREFIX}${key}`);
    if (raw) {
      const route = JSON.parse(raw) as CachedRoute;
      mem.set(key, route);
      return route;
    }
  } catch (e) {
    console.warn('[routeCache] read failed', e);
  }
  return null;
}

export async function putCachedRoute(key: string, route: CachedRoute): Promise<void> {
  mem.set(key, route);
  if (mem.size > MAX) {
    const oldest = mem.keys().next().value;
    if (oldest !== undefined) mem.delete(oldest);
  }
  try {
    await AsyncStorage.setItem(`${PREFIX}${key}`, JSON.stringify(route));
    const idx = (await loadIndex()).filter((k) => k !== key);
    idx.push(key);
    while (idx.length > MAX) {
      const evict = idx.shift();
      if (evict) await AsyncStorage.removeItem(`${PREFIX}${evict}`);
    }
    await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(idx));
  } catch (e) {
    console.warn('[routeCache] write failed', e);
  }
}

export async function clearRouteCache(): Promise<void> {
  mem.clear();
  try {
    const keys = await AsyncStorage.getAllKeys();
    const ours = keys.filter((k) => k.startsWith(PREFIX));
    if (ours.length) await AsyncStorage.multiRemove(ours);
  } catch (e) {
    console.warn('[routeCache] clear failed', e);
  }
}

// Shared distance/duration formatter for route banners.
export function formatRouteMeta(distance: number, duration: number): { distance: string; duration: string } {
  return {
    distance: `${(distance / 1000).toFixed(1)} km`,
    duration: `${Math.round(duration / 60)} min`,
  };
}
