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
import { ensureSpeakMode } from './audioSession';
import { vlog } from '../store/useVoiceDebug';

// Priority ranks: 'urgent' (regulatory/safety warnings) outranks everything and
// can never be silenced by a lower cue; 'high' (e.g. an explicit chat answer)
// preempts ambient 'normal' ride cues but NOT an in-flight 'urgent' warning.
export type VoicePriority = 'normal' | 'high' | 'urgent';
const RANK: Record<VoicePriority, number> = { normal: 0, high: 1, urgent: 2 };

export interface SpeakOptions {
  lang?: string;
  priority?: VoicePriority;
  rate?: number;
  pitch?: number;
}

// Android TextToSpeech rejects input over ~4000 chars (SpeechInputIsToLong),
// which would leave the queue stuck `speaking`. Clamp well under that.
const MAX_SPEECH_CHARS = 3900;

// BCP-47 voice codes for the languages the app supports.
const BCP47: Record<string, string> = {
  en: 'en-US', es: 'es-ES', ca: 'ca-ES', fr: 'fr-FR', de: 'de-DE', it: 'it-IT',
};

export function langToBcp47(code?: string): string {
  const key = (code ?? 'en').slice(0, 2).toLowerCase();
  return BCP47[key] ?? 'en-US';
}

// One-time probe of installed TTS voices so we can fall back when a selected
// language has no voice on this device (commonly Catalan). TTS-only — STT and
// on-screen text stay in the user's chosen locale. Never throws.
let availablePrefixes: Set<string> | null = null;
let probed = false;
async function ensureVoices(): Promise<void> {
  if (probed) return;
  probed = true;
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    availablePrefixes = new Set(voices.map((v) => (v.language ?? '').slice(0, 2).toLowerCase()));
  } catch {
    availablePrefixes = null; // unknown → don't substitute
  }
}
void ensureVoices();

function resolveSpeakLang(code?: string): string {
  const bcp = langToBcp47(code);
  const prefix = bcp.slice(0, 2).toLowerCase();
  if (availablePrefixes && availablePrefixes.size > 0 && !availablePrefixes.has(prefix)) {
    return prefix === 'ca' ? 'es-ES' : 'en-US'; // Catalan → Spanish, else English
  }
  return bcp;
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
let currentRank = -1; // rank of the cue currently speaking (-1 = idle)
let gen = 0;
let lastSpoken: { text: string; lang?: string } = { text: '' }; // for "repeat"

// Last thing the app spoke + the language it was spoken in (the "repeat" intent
// re-speaks in the SAME language, e.g. an English turn cue stays English).
export function getLastSpoken(): { text: string; lang?: string } {
  return lastSpoken;
}

function settingsRate(): number {
  try {
    return useSettingsStore.getState().voiceRate;
  } catch {
    return 0.95;
  }
}

async function playNext(myGen: number): Promise<void> {
  if (myGen !== gen) return; // superseded by a stop()/preempting cue
  const next = queue.shift();
  if (!next) {
    speaking = false;
    currentRank = -1;
    return;
  }
  speaking = true;
  currentRank = RANK[next.opts.priority ?? 'normal'];
  lastSpoken = { text: next.text, lang: next.opts.lang };
  // Flip the audio session to playback (loudspeaker + silent-mode) before the
  // first utterance, so TTS is audible — even right after a voice recording left
  // the session in record/earpiece mode, and even with the ring switch on silent.
  // No-op while a recording is active, and never throws.
  await ensureSpeakMode();
  if (myGen !== gen) return; // stop()/preempt may have fired during the await
  speakItem(next, myGen, false);
}

// Speak one queue item. On error, retry ONCE with a guaranteed-installed default
// voice (en-US) before giving up — a missing locale voice must never silence
// guidance. Every onDone/onError is logged for diagnosability.
function speakItem(item: QueueItem, myGen: number, isRetry: boolean): void {
  const language = isRetry ? 'en-US' : resolveSpeakLang(item.opts.lang);
  vlog(`speak${isRetry ? ' (retry en-US)' : ''}: "${item.text.slice(0, 32)}" [${language}]`);
  try {
    Speech.speak(item.text, {
      language,
      rate: item.opts.rate ?? settingsRate(),
      pitch: item.opts.pitch ?? 1.0,
      onDone: () => { vlog('TTS onDone'); void playNext(myGen); },
      onError: (e) => {
        vlog(`TTS onError: ${String(e)}`);
        console.warn('[Voice] TTS error', e);
        if (!isRetry && language !== 'en-US' && myGen === gen) {
          speakItem(item, myGen, true); // fall back to the default voice, still speak
        } else {
          void playNext(myGen);
        }
      },
    });
  } catch (e) {
    // Some platforms can throw synchronously (e.g. an unsupported voice). Don't let
    // it stall the queue: retry once on the default voice, else advance.
    console.warn('[Voice] TTS threw', e);
    if (!isRetry && language !== 'en-US' && myGen === gen) speakItem(item, myGen, true);
    else void playNext(myGen);
  }
}

// Fire-and-forget. No-op when guidance is muted or the text is empty.
export function speak(text: string, opts: SpeakOptions = {}): void {
  const clean = text.trim().slice(0, MAX_SPEECH_CHARS);
  if (!clean) return;
  if (!guidanceOn()) { vlog('speak skipped — voice guidance is OFF (🔊 toggle)'); return; }
  const rank = RANK[opts.priority ?? 'normal'];

  // high/urgent cues preempt — but NEVER knock out an in-flight cue that
  // outranks them (a chat reply must not silence a regulatory warning); those
  // queue behind it instead.
  if (rank >= RANK.high) {
    if (speaking && rank < currentRank) {
      queue.push({ text: clean, opts });
      return;
    }
    gen += 1; // invalidate any in-flight cue
    queue.length = 0;
    Speech.stop();
    speaking = false;
    currentRank = -1;
    queue.push({ text: clean, opts });
    void playNext(gen);
    return;
  }

  queue.push({ text: clean, opts });
  if (!speaking) void playNext(gen);
}

export function stop(): void {
  gen += 1;
  queue.length = 0;
  speaking = false;
  currentRank = -1;
  Speech.stop();
}

export function isSpeaking(): boolean {
  return speaking;
}
