// ─── Voice engine ──────────────────────────────────────────────────────────────
// Thin wrapper over expo-speech (already used in chat.tsx) that adds:
//  • a serial queue so guidance cues never overlap,
//  • a persisted mute flag (the "Voice guidance" toggle on Profile),
//  • a cached app language mapped to a BCP-47 voice code,
//  • priority cues that preempt the queue (urgent regulatory warnings).
// The background geofence task can run in a fresh JS context, so getMuted()/getLang()
// fall back to AsyncStorage when the in-memory cache hasn't been hydrated yet.

import * as Speech from 'expo-speech';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Stored under "enabled" semantics: 'true' = guidance on, 'false' = muted.
const MUTE_KEY = 'voice_guidance_enabled';
const LANG_KEY = 'voice_guidance_lang';

export type VoicePriority = 'normal' | 'high';
export interface SpeakOptions {
  lang?: string;
  priority?: VoicePriority;
  rate?: number;
  pitch?: number;
}

// BCP-47 voice codes for the languages the app supports (users.preferred_language).
const BCP47: Record<string, string> = {
  en: 'en-US', es: 'es-ES', ca: 'ca-ES', fr: 'fr-FR', de: 'de-DE', it: 'it-IT',
};

let muted = false; // false = guidance ON
let langCode = 'en';
let hydrated = false;

export function langToBcp47(code?: string): string {
  const key = (code ?? langCode ?? 'en').slice(0, 2).toLowerCase();
  return BCP47[key] ?? 'en-US';
}

async function hydrate(): Promise<void> {
  if (hydrated) return;
  try {
    const [m, l] = await Promise.all([
      AsyncStorage.getItem(MUTE_KEY),
      AsyncStorage.getItem(LANG_KEY),
    ]);
    muted = m === 'false'; // default (null) → guidance on
    if (l) langCode = l;
  } catch {
    // keep defaults
  }
  hydrated = true;
}
void hydrate(); // best-effort eager hydration; getters also guard

export async function getMuted(): Promise<boolean> {
  await hydrate();
  return muted;
}

export async function setMuted(value: boolean): Promise<void> {
  muted = value;
  hydrated = true;
  try {
    await AsyncStorage.setItem(MUTE_KEY, value ? 'false' : 'true');
  } catch {
    // ignore persistence failure
  }
  if (value) stop();
}

// Profile UI thinks in "guidance enabled" (the inverse of muted).
export async function isGuidanceEnabled(): Promise<boolean> {
  return !(await getMuted());
}
export async function setGuidanceEnabled(on: boolean): Promise<void> {
  await setMuted(!on);
}

export function getLang(): string {
  return langCode;
}
export async function setLang(code: string): Promise<void> {
  if (!code) return;
  langCode = code;
  try {
    await AsyncStorage.setItem(LANG_KEY, code);
  } catch {
    // ignore
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

export async function speak(text: string, opts: SpeakOptions = {}): Promise<void> {
  const clean = text.trim();
  if (!clean) return;
  if (await getMuted()) return;

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
