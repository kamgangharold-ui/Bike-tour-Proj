// Lightweight AsyncStorage cache for Barcelona data (landmarks, tours) so the
// app shows previously-loaded content without a signal. NOT for map tiles.
// Firestore's JS-SDK IndexedDB persistence does not work in React Native, so we
// cache the already-mapped plain objects ourselves.

import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'cache:';

export const CACHE_KEYS = {
  locations: 'locations',
  tours: 'tours',
} as const;

export interface CacheEnvelope<T> {
  at: number; // epoch ms the cache was written
  data: T;
}

export async function writeCache<T>(key: string, data: T): Promise<void> {
  try {
    const envelope: CacheEnvelope<T> = { at: Date.now(), data };
    await AsyncStorage.setItem(`${PREFIX}${key}`, JSON.stringify(envelope));
  } catch (e) {
    console.warn('[cache] write failed', key, e);
  }
}

export async function readCache<T>(key: string): Promise<CacheEnvelope<T> | null> {
  try {
    const raw = await AsyncStorage.getItem(`${PREFIX}${key}`);
    return raw ? (JSON.parse(raw) as CacheEnvelope<T>) : null;
  } catch (e) {
    console.warn('[cache] read failed', key, e);
    return null;
  }
}

// Remove all cached Barcelona data (used by the Settings "offline" controls).
export async function clearCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const ours = keys.filter((k) => k.startsWith(PREFIX));
    if (ours.length) await AsyncStorage.multiRemove(ours);
  } catch (e) {
    console.warn('[cache] clear failed', e);
  }
}

// Most-recent cache timestamp across known keys (for "last updated" in Settings).
export async function getCacheInfo(): Promise<{ lastUpdated: number | null }> {
  const [loc, tours] = await Promise.all([
    readCache(CACHE_KEYS.locations),
    readCache(CACHE_KEYS.tours),
  ]);
  const times = [loc?.at, tours?.at].filter((x): x is number => typeof x === 'number');
  return { lastUpdated: times.length ? Math.max(...times) : null };
}
