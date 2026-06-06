// ─── Voice engine ──────────────────────────────────────────────────────────────
// Thin wrapper over expo-speech (foreground TTS — works in Expo Go, no native
// build needed) that adds:
//  • a serial queue so guidance cues never overlap,
//  • priority cues that preempt the queue (urgent regulatory warnings),
//  • BCP-47 language mapping for multilingual guidance.
//
// Mute is the SINGLE Settings toggle `voiceGuidanceEnabled` (useSettingsStore) —
// there is deliberately no separate persistence here, so the Settings screen, the
// ride banner, and the chat speaker all stay in sync.
//
// IMPORTANT — the original voice layer crashed because _layout.tsx called
// Audio.setAudioModeAsync({ staysActiveInBackground: true }) at startup, a native
// background-audio API that is unavailable in Expo Go. We do NOT touch the audio
// session here: expo-speech foreground TTS needs none of it. Background audio
// (speak with the screen off) is a separate, dev-build-only concern.

import * as Speech from 'expo-speech';
import { useSettingsStore } from '../store/useSettingsStore';

export type VoicePriority = 'normal' | 'high';
export interface SpeakOptions {
  lang?: string;
  priority?: VoicePriority;
  rate?: number;
  pitch?: number;
}

// BCP-47 voice codes for the languages the app supports.
const BCP47: Record<string, string> = {
  en: 'en-US', es: 'es-ES', ca: 'ca-ES', fr: 'fr-FR', de: 'de-DE', it: 'it-IT',
};

export function langToBcp47(code?: string): string {
  const key = (code ?? 'en').slice(0, 2).toLowerCase();
  return BCP47[key] ?? 'en-US';
}

// Single source of truth for "is voice guidance on". The background geofence task
// rehydrates the persisted settings before it speaks, so this reads fresh there too.
function guidanceOn(): boolean {
  try {
    return useSettingsStore.getState().voiceGuidanceEnabled;
  } catch {
    return false; // never throw from a speak() call
  }
}

// ─── Serial queue ───────────────────────────────────────────────────────────────
// A generation token guards against stale callbacks from interrupted utterances.
interface QueueItem { text: string; opts: SpeakOptions }
const queue: QueueItem[] = [];
let speaking = false;
let gen = 0;

function playNext(myGen: number): void {
  if (myGen !== gen) return; // superseded by a stop()/high-priority cue
  const next = queue.shift();
  if (!next) {
    speaking = false;
    return;
  }
  speaking = true;
  Speech.speak(next.text, {
    language: langToBcp47(next.opts.lang),
    rate: next.opts.rate ?? 0.95,
    pitch: next.opts.pitch ?? 1.0,
    onDone: () => playNext(myGen),
    onError: () => playNext(myGen),
  });
}

// Fire-and-forget. No-op when guidance is muted or the text is empty.
export function speak(text: string, opts: SpeakOptions = {}): void {
  const clean = text.trim();
  if (!clean || !guidanceOn()) return;

  if (opts.priority === 'high') {
    gen += 1; // invalidate any in-flight cue
    queue.length = 0;
    Speech.stop();
    speaking = false;
    queue.push({ text: clean, opts });
    playNext(gen);
    return;
  }

  queue.push({ text: clean, opts });
  if (!speaking) playNext(gen);
}

export function stop(): void {
  gen += 1;
  queue.length = 0;
  speaking = false;
  Speech.stop();
}

export function isSpeaking(): boolean {
  return speaking;
}
