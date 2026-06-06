// ─── Live navigation foreground-service notification (DEV-1, Android dev client) ──
// A persistent ongoing notification (foreground service via @notifee/react-native)
// that stays on the lock screen during a ride and updates live with the next
// maneuver + distance — like Google Maps' nav notification.
//
// This is a NATIVE feature that only exists in the Android dev client / standalone
// build. notifee is NOT in Expo Go, so EVERYTHING here is behind a lazy, guarded
// require: in Expo Go `nativeNavAvailable()` returns false and notifee is never
// imported, so the PART 1 Expo Go bundle never touches the missing native module.
//
// IMPORTANT: notifee.registerForegroundService() must run once at module load, but
// only inside the guard — it is registered the first time ensure() succeeds.

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import i18n from '../i18n';
import { useAppStore } from '../store/useAppStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { stop as stopSpeaking } from './voice';

// appOwnership === 'expo' is the ONLY reliable "this is Expo Go" signal —
// executionEnvironment is 'storeClient' in BOTH Expo Go and the dev client.
const isExpoGo = Constants.appOwnership === 'expo';
const supported = Platform.OS === 'android' && !isExpoGo;

/* eslint-disable @typescript-eslint/no-explicit-any */
let notifee: any = null;
let AndroidColor: any = null;
let AndroidImportance: any = null;
let AndroidForegroundServiceType: any = null;
let EventType: any = null;
let registered = false;

// Handle a tap on the notification's Stop / Mute action (foreground or background).
function handleAction(type: number, detail: any): void {
  try {
    if (!EventType || type !== EventType.ACTION_PRESS) return;
    const id = detail?.pressAction?.id;
    if (id === 'stop') {
      useAppStore.getState().endRide();
      void stopNav();
    } else if (id === 'mute') {
      useSettingsStore.getState().setVoiceGuidanceEnabled(false);
      stopSpeaking();
    }
  } catch (e) {
    console.warn('[LiveNav] action failed', e);
  }
}

// Lazily resolve notifee and register the foreground-service task + event handlers
// exactly once. Returns false (and never throws) when notifee isn't present.
function ensure(): boolean {
  if (!supported) return false;
  if (notifee) return true;
  try {
    const mod = require('@notifee/react-native');
    notifee = mod.default;
    AndroidColor = mod.AndroidColor;
    AndroidImportance = mod.AndroidImportance;
    AndroidForegroundServiceType = mod.AndroidForegroundServiceType;
    EventType = mod.EventType;
    if (!registered) {
      // The task must return a promise that lives for the service's lifetime; we
      // update the notification from updateNav() and end it via stopForegroundService().
      notifee.registerForegroundService(() => new Promise<void>(() => {}));
      notifee.onForegroundEvent(({ type, detail }: any) => handleAction(type, detail));
      notifee.onBackgroundEvent(async ({ type, detail }: any) => handleAction(type, detail));
      registered = true;
    }
    return true;
  } catch (e) {
    console.warn('[LiveNav] notifee unavailable', e);
    notifee = null;
    return false;
  }
}

export function nativeNavAvailable(): boolean {
  return ensure();
}

const CHANNEL_ID = 'nav';
const NOTIF_ID = 'live-nav';

async function display(title: string, body: string): Promise<void> {
  await notifee.displayNotification({
    id: NOTIF_ID, // same id → updates in place instead of stacking
    title,
    body,
    android: {
      channelId: CHANNEL_ID,
      asForegroundService: true,
      ongoing: true,
      onlyAlertOnce: true, // live distance ticks don't re-buzz the user
      colorized: true,
      color: AndroidColor.GREEN,
      smallIcon: 'ic_launcher',
      foregroundServiceTypes: [AndroidForegroundServiceType.FOREGROUND_SERVICE_TYPE_LOCATION],
      pressAction: { id: 'default' },
      actions: [
        { title: i18n.t('ride.mute'), pressAction: { id: 'mute' } },
        { title: i18n.t('ride.endRide'), pressAction: { id: 'stop' } },
      ],
    },
  });
}

// Begin the ongoing nav notification (call on ride start). No-op off the dev client.
export async function startNav(title: string, body: string): Promise<void> {
  if (!ensure()) return;
  try {
    await notifee.requestPermission();
    await notifee.createChannel({ id: CHANNEL_ID, name: 'Live navigation', importance: AndroidImportance.LOW });
    await display(title, body);
  } catch (e) {
    console.warn('[LiveNav] start failed', e);
  }
}

// Update the live text (next maneuver + distance). Safe to call frequently.
export async function updateNav(title: string, body: string): Promise<void> {
  if (!ensure()) return;
  try {
    await display(title, body);
  } catch (e) {
    console.warn('[LiveNav] update failed', e);
  }
}

// End the foreground service + dismiss the notification (call on ride end).
export async function stopNav(): Promise<void> {
  if (!notifee) return;
  try {
    await notifee.stopForegroundService();
  } catch (e) {
    console.warn('[LiveNav] stop failed', e);
  }
}
