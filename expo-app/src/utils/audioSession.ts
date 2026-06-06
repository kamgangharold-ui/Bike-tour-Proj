// ─── Audio session manager (expo-audio) ───────────────────────────────────────────
// ONE place that owns the iOS/Android audio session shared by STT (expo-audio
// recording) and TTS (expo-speech). Migrated off the DEPRECATED expo-av (which is
// non-functional in SDK 54 Expo Go and removed in SDK 55) to expo-audio's
// setAudioModeAsync — the root-cause fix for voice being dead in Expo Go.
//
// Two modes:
//   • listen — recording for STT (allowsRecording true)
//   • speak  — playback for TTS (allowsRecording false → iOS releases the record
//              category so playback leaves the quiet earpiece for the loudspeaker)
// Both keep playsInSilentMode true so guidance is audible with the iPhone ring
// switch on silent. shouldPlayInBackground stays false (no background-audio entitlement
// needed; that was the original expo-av crash vector and doesn't exist here).
//
// Captures are COUNTED (not a boolean): two useVoiceChat instances (chat + map) stay
// mounted, so a no-op stop on the idle one must not flip the session out from under
// the other's live mic. We only return to speak-mode when the LAST capture ends.

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { setAudioModeAsync } from 'expo-audio';
import { vlog } from '../store/useVoiceDebug';

type Mode = 'listen' | 'speak';
let mode: Mode | null = null;
let activeCaptures = 0;

// Background audio (TTS continues when the screen is off) is enabled ONLY in a real
// build (standalone APK / dev client) where it's paired with a foreground service.
// NEVER in Expo Go — that's the original crash (no UIBackgroundModes entitlement).
const BG = Constants.appOwnership !== 'expo';

const LISTEN = {
  allowsRecording: true,        // iOS: enable mic + record category
  playsInSilentMode: true,      // iOS: audible even with the hardware silent switch on
  shouldPlayInBackground: BG,
  shouldRouteThroughEarpiece: false, // Android: loudspeaker, not earpiece
  interruptionMode: 'duckOthers',
} as const;

const SPEAK = {
  allowsRecording: false,       // iOS: drop record category → playback → loudspeaker
  playsInSilentMode: true,
  shouldPlayInBackground: BG,   // keep speaking screen-off in the standalone build
  shouldRouteThroughEarpiece: false,
  interruptionMode: 'duckOthers',
} as const;

async function apply(target: Mode): Promise<void> {
  if (Platform.OS === 'web' || mode === target) return;
  mode = target;
  try {
    await setAudioModeAsync(target === 'listen' ? LISTEN : SPEAK);
    vlog(`audio session → ${target} mode`);
  } catch (e) {
    mode = null; // unknown state → re-apply next time
    vlog(`audio session ${target} FAILED: ${String(e)}`);
    console.warn(`[Audio] ${target} mode failed`, e);
  }
}

// A capture is starting. Switch to record mode. MUST be paired with one exitListenMode().
export async function enterListenMode(): Promise<void> {
  activeCaptures += 1;
  await apply('listen');
}

// A capture ended (stop / cancel / failed-to-start). When the LAST ends, return to
// speak-mode so the spoken reply is audible.
export async function exitListenMode(): Promise<void> {
  activeCaptures = Math.max(0, activeCaptures - 1);
  if (activeCaptures === 0) await apply('speak');
}

// Called by the TTS engine before speaking: ensure loudspeaker + silent-mode playback,
// but NO-OP while a capture is live (let recording win).
export async function ensureSpeakMode(): Promise<void> {
  if (activeCaptures > 0) return;
  await apply('speak');
}
