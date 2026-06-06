// ─── Real-time notification dispatcher (Drop 2) ───────────────────────────────
// ONE place that turns an app event into the right outputs, coordinated so a
// single event never double-announces:
//   • foreground → in-app banner (+ one spoken line if unmuted)
//   • backgrounded → a local system notification on the right channel
//   • safety alerts → also a system notification even in foreground
// Plus a best-effort "ride in progress" ongoing notification. Everything is
// guarded so it never throws (also runs in the background geofence JS context).
//
// NOTE: a TRUE Android foreground-service ongoing notification and background TTS
// need a dev build; in Expo Go this is a normal/sticky notification, and spoken
// lines only play in the foreground.

import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useEventBanner, type BannerKind } from '../store/useEventBanner';
import { speak } from './voice';

export type NotifKind = BannerKind; // 'navigation' | 'alert' | 'info'

const CHANNEL: Record<NotifKind, string> = {
  navigation: 'navigation',
  alert: 'alerts',
  info: 'info',
};

// Permission + Android channels. Call once at startup.
export async function setupNotifications(): Promise<void> {
  try {
    await Notifications.requestPermissionsAsync();
  } catch {
    /* user can grant later */
  }
  if (Platform.OS !== 'android') return;
  const H = Notifications.AndroidImportance.HIGH;
  const D = Notifications.AndroidImportance.DEFAULT;
  const L = Notifications.AndroidImportance.LOW;
  try {
    await Notifications.setNotificationChannelAsync('navigation', { name: 'Navigation', importance: H });
    await Notifications.setNotificationChannelAsync('alerts', { name: 'Safety alerts', importance: H });
    await Notifications.setNotificationChannelAsync('info', { name: 'Info', importance: D });
    await Notifications.setNotificationChannelAsync('ride', { name: 'Ride in progress', importance: L });
  } catch {
    /* ignore */
  }
}

function androidTrigger(channelId: string): Notifications.NotificationTriggerInput | null {
  // Channel-aware immediate trigger on Android; immediate (null) on iOS.
  return Platform.OS === 'android' ? ({ channelId } as Notifications.ChannelAwareTriggerInput) : null;
}

export interface NotifyOpts {
  kind: NotifKind;
  title: string;
  body: string;
  speak?: string;        // spoken line (foreground only; speak() self-gates on the mute setting)
  alwaysNotify?: boolean; // post a system notification even when foregrounded (safety)
  data?: Record<string, unknown>;
}

// Coordinate against double-announce: the same event from two paths (e.g. the
// background geofence task AND the foreground geofence) within a short window is
// dispatched once.
let lastKey = '';
let lastAt = 0;

// Dispatch one event. Never throws.
export async function notify(o: NotifyOpts): Promise<void> {
  const key = `${o.kind}:${o.title}`;
  const now = Date.now();
  if (key === lastKey && now - lastAt < 5000) return;
  lastKey = key;
  lastAt = now;

  const foreground = AppState.currentState === 'active';
  if (foreground) {
    try { useEventBanner.getState().show({ kind: o.kind, title: o.title, body: o.body }); } catch { /* ignore */ }
    if (o.speak) speak(o.speak, { priority: o.kind === 'alert' ? 'urgent' : 'normal' });
  }
  if (!foreground || o.alwaysNotify) {
    try {
      await Notifications.scheduleNotificationAsync({
        content: { title: o.title, body: o.body, data: o.data, sound: o.kind === 'alert' },
        trigger: androidTrigger(CHANNEL[o.kind]),
      });
    } catch {
      /* ignore */
    }
  }
}

// ─── Ongoing "ride in progress" notification ──────────────────────────────────
const RIDE_NOTIF_ID = 'ride-ongoing';

export async function setRideOngoing(title: string, body: string): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: RIDE_NOTIF_ID, // stable id → updates replace, not stack
      content: { title, body, sticky: true, autoDismiss: false },
      trigger: androidTrigger('ride'),
    });
  } catch {
    /* ignore (best-effort; true foreground service needs a dev build) */
  }
}

export async function clearRideOngoing(): Promise<void> {
  try { await Notifications.dismissNotificationAsync(RIDE_NOTIF_ID); } catch { /* ignore */ }
  try { await Notifications.cancelScheduledNotificationAsync(RIDE_NOTIF_ID); } catch { /* ignore */ }
}
