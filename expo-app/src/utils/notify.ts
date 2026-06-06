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
import { useSettingsStore } from '../store/useSettingsStore';
import { speak } from './voice';

function notificationsOn(): boolean {
  try {
    return useSettingsStore.getState().notificationsEnabled;
  } catch {
    return true;
  }
}

export type NotifKind = BannerKind; // 'navigation' | 'alert' | 'info'

const CHANNEL: Record<NotifKind, string> = {
  navigation: 'navigation',
  alert: 'alerts',
  info: 'info',
};

// Permission + Android channels. Call once at startup. Returns whether the OS
// will actually present notifications — on Android 13+ and iOS, everything below
// silently no-ops until the user grants permission, so we check the result
// instead of assuming the manifest entry is enough.
export async function setupNotifications(): Promise<boolean> {
  let granted = false;
  try {
    const current = await Notifications.getPermissionsAsync();
    const status =
      current.granted || current.status === 'granted'
        ? current
        : await Notifications.requestPermissionsAsync();
    granted = status.granted || status.status === 'granted';
    if (!granted) {
      console.warn('[Notify] notification permission not granted — system notifications will not appear');
    }
  } catch (e) {
    console.warn('[Notify] permission check failed', e);
  }
  if (Platform.OS !== 'android') return granted;
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
  return granted;
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

// Within-runtime de-bounce of repeated dispatches (keyed by the stable slug when
// present, so two physically-distinct same-named landmarks are NOT collapsed).
// NOTE: this is per-JS-runtime; the foreground (app) and background (geofence
// task) runtimes don't share it. Cross-runtime double-fire is prevented by
// OWNERSHIP instead: the foreground path emits banner+voice only, the background
// task owns the system notification (see geofenceTask + map foreground geofence).
let lastKey = '';
let lastAt = 0;

// Dispatch one event. Never throws.
export async function notify(o: NotifyOpts): Promise<void> {
  if (!notificationsOn()) return; // master switch (Settings)
  const key = `${o.kind}:${(o.data?.slug as string | undefined) ?? o.title}`;
  const now = Date.now();
  if (key === lastKey && now - lastAt < 5000) return;
  lastKey = key;
  lastAt = now;

  const foreground = AppState.currentState === 'active';
  const postSystem = !foreground || !!o.alwaysNotify;
  if (foreground) {
    // Show the in-app banner ONLY when we are NOT also posting a system
    // notification — otherwise the rider sees the event twice (dark in-app banner +
    // white OS notification). Each event surfaces exactly once. Spoken line still
    // plays in the foreground regardless.
    if (!postSystem) {
      try { useEventBanner.getState().show({ kind: o.kind, title: o.title, body: o.body }); } catch { /* ignore */ }
    }
    if (o.speak) speak(o.speak, { priority: o.kind === 'alert' ? 'urgent' : 'normal' });
  }
  if (postSystem) {
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
  if (!notificationsOn()) return;
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
