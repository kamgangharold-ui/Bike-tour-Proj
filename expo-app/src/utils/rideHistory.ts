// Durable local ride history (Group B). Full ride records — including the GPS
// track — are persisted to AsyncStorage so past rides survive an app restart and
// can be re-opened in the recap. Local (not Firestore) because track arrays are
// large and this keeps the feature JS-only / offline. Newest first, capped.

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RideRecord } from '../store/useAppStore';

const KEY = 'rideHistory';
const MAX = 50;

export async function loadRideHistory(): Promise<RideRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as RideRecord[]) : [];
  } catch (e) {
    console.warn('[rideHistory] load failed', e);
    return [];
  }
}

// Prepend a finished ride and return the new (capped) list.
export async function addRideToHistory(record: RideRecord): Promise<RideRecord[]> {
  try {
    const existing = await loadRideHistory();
    const next = [record, ...existing].slice(0, MAX);
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
    return next;
  } catch (e) {
    console.warn('[rideHistory] add failed', e);
    return [];
  }
}

export async function getRideById(id: string): Promise<RideRecord | null> {
  const list = await loadRideHistory();
  return list.find((r) => r.id === id) ?? null;
}

export async function clearRideHistory(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch (e) {
    console.warn('[rideHistory] clear failed', e);
  }
}
