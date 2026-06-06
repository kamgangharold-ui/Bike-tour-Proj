// ─── Audio session manager ────────────────────────────────────────────────────
// ONE place that owns the iOS/Android audio session shared by STT (expo-av
// recording) and TTS (expo-speech). Two modes:
//   • listen — recording for speech-to-text (allowsRecordingIOS:true)
//   • speak  — playback for text-to-speech (allowsRecordingIOS:false so audio
//              leaves the quiet earpiece and goes to the loudspeaker)
// Both keep playsInSilentModeIOS:true so guidance is audible even with the iPhone
// ring switch on silent.
//
// Captures are tracked with a COUNTER, not a boolean: there are two useVoiceChat
// instances (chat + map) and Expo Router keeps both mounted, so a no-op stop on
// the idle one must not flip the session out from under the other's live mic. We
// only return to speak-mode when the LAST capture ends. enterListenMode /
// exitListenMode must be paired exactly once each (the hook guarantees this).
//
// CRITICAL: never pass staysActiveInBackground:true. That exact option was the
// original crash — it needs native UIBackgroundModes/entitlements that DON'T exist
// in Expo Go, so it crashes the installed APK and breaks Expo Go on iOS. Keep it
// explicitly false in BOTH modes. Every call is wrapped so it never throws.

import { Platform } from 'react-native';
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';

type Mode = 'listen' | 'speak';
let mode: Mode | null = null; // current applied mode (skip redundant native calls)
let activeCaptures = 0;        // in-flight recordings across ALL useVoiceChat instances

const LISTEN = {
  allowsRecordingIOS: true,
  playsInSilentModeIOS: true,
  staysActiveInBackground: false, // NEVER true — see header note
  interruptionModeIOS: InterruptionModeIOS.DoNotMix,
  interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
  shouldDuckAndroid: true,
  playThroughEarpieceAndroid: false,
} as const;

const SPEAK = {
  allowsRecordingIOS: false, // route playback to the loudspeaker, not the earpiece
  playsInSilentModeIOS: true, // audible even when the ring switch is on silent
  staysActiveInBackground: false, // NEVER true — see header note
  interruptionModeIOS: InterruptionModeIOS.DuckOthers,
  interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
  shouldDuckAndroid: true,
  playThroughEarpieceAndroid: false,
} as const;

async function apply(target: Mode): Promise<void> {
  if (Platform.OS === 'web' || mode === target) return;
  mode = target;
  try {
    await Audio.setAudioModeAsync(target === 'listen' ? LISTEN : SPEAK);
  } catch (e) {
    mode = null; // unknown state → re-apply next time
    console.warn(`[Audio] ${target} mode failed`, e);
  }
}

// A capture is starting. Switch to record mode and remember it's live so a
// concurrent TTS cue can't yank the session out from under the microphone.
// MUST be paired with exactly one exitListenMode().
export async function enterListenMode(): Promise<void> {
  activeCaptures += 1;
  await apply('listen');
}

// A capture ended (stop / cancel / failed-to-start). When the LAST one ends, flip
// back to playback so the spoken reply is audible.
export async function exitListenMode(): Promise<void> {
  activeCaptures = Math.max(0, activeCaptures - 1);
  if (activeCaptures === 0) await apply('speak');
}

// Called by the TTS engine right before it speaks. Ensures loudspeaker + silent-
// mode playback, but is a NO-OP while any capture is live (let listen-mode win so
// we never corrupt or abort an in-flight voice command).
export async function ensureSpeakMode(): Promise<void> {
  if (activeCaptures > 0) return;
  await apply('speak');
}
