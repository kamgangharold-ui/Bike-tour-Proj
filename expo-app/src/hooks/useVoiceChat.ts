// ─── Shared voice capture + Google STT ───────────────────────────────────────────
// The ONE speech-to-text pipeline, reused by the BikAI chat (tap-to-stop) and the
// map tap-to-talk (silence auto-stop). expo-av recording → Google Speech-to-Text →
// onTranscript(text). The caller decides what to do with the transcript (chat sends
// it to Claude; the map runs it through the command router). expo-av runs in Expo
// Go on both platforms — no dev build, no Apple Developer account.

import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { useSettingsStore } from '../store/useSettingsStore';
import { sttLanguageConfig } from '../utils/locale';
import { enterListenMode, exitListenMode } from '../utils/audioSession';

// Cycling domain terms that boost Google STT accuracy. Landmark names are added
// per-call via the `phrases` option.
export const SPEECH_HINTS = [
  'bike lane', 'bike lanes', 'cycle lane', 'cycling route', 'bike parking',
  'park my bike', 'Bicing', 'Bicibox', 'Bicipark', 'dismount', 'dismount zone',
  'sidewalk', 'fine', 'earphones', 'helmet', "what's near me", 'where am I',
  // command words (boosted so the local intent router matches them reliably)
  'take me to', 'navigate to', 'reroute', 'skip', 'next stop', 'how far',
  'where can I park', 'repeat', 'mute', 'louder', 'slower', 'stop the ride',
];

const SPEECH_DB = -35;      // metering above this counts as the user speaking
const METER_INTERVAL = 150; // ms between recording status updates
// Don't let a brief mid-sentence pause auto-stop the recording: require this much
// speech since it began before the trailing-silence timer is allowed to fire.
const MIN_UTTERANCE_MS = 900;

export interface UseVoiceChatOptions {
  // Called with the recognized text. The hook never sends to Claude itself.
  onTranscript: (text: string) => void;
  // Dynamic STT boost terms (e.g. nearby landmark names), read on stop.
  phrases?: () => string[];
  // Auto-stop after this much TRAILING silence once speech began (map tap-to-talk).
  // Omit to disable silence detection (chat uses tap-to-stop).
  silenceMs?: number;
  // Hard cap on a single utterance (default 60 s; the map passes ~8 s).
  maxMs?: number;
  onError?: (msg: string) => void;
}

export interface VoiceChat {
  isListening: boolean;
  transcribing: boolean;
  startListening: () => Promise<void>;
  stopListening: () => Promise<void>; // stop + transcribe
  cancel: () => Promise<void>;        // stop + discard
}

export function useVoiceChat(options: UseVoiceChatOptions): VoiceChat {
  // Keep the latest options/callbacks in a ref so a timer-fired stop (silence/max)
  // always uses the current handler, never a stale closure from an earlier render.
  const optsRef = useRef(options);
  optsRef.current = options;

  const [isListening, setIsListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const maxTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const silenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speechDetected = useRef(false);
  const speechStartedAt = useRef(0);
  const finishing = useRef(false);
  const starting = useRef(false); // synchronous guard against re-entrant startListening

  const clearTimers = () => {
    if (maxTimer.current) { clearTimeout(maxTimer.current); maxTimer.current = null; }
    if (silenceTimer.current) { clearTimeout(silenceTimer.current); silenceTimer.current = null; }
  };

  // Stop the active recording and return its file URI (or null). Idempotent.
  // Flips the audio session back to speak-mode (loudspeaker + silent-mode playback)
  // ONLY when this instance actually held a recording — a no-op stop on an idle
  // instance must not clear the shared capture count and yank the other instance's
  // live mic into playback. The error/abort paths still pair their enter.
  const stopRecording = async (): Promise<string | null> => {
    clearTimers();
    const rec = recordingRef.current;
    recordingRef.current = null;
    setIsListening(false);
    if (!rec) return null;
    try {
      await rec.stopAndUnloadAsync();
      return rec.getURI();
    } catch (e) {
      console.warn('[Voice] stop failed', e);
      return null;
    } finally {
      await exitListenMode(); // pairs the enterListenMode() from startListening
    }
  };

  const transcribe = async (uri: string) => {
    const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
    if (!apiKey) {
      optsRef.current.onError?.('EXPO_PUBLIC_GOOGLE_MAPS_API_KEY is not set.');
      return;
    }
    setTranscribing(true);
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      const appLocale = useSettingsStore.getState().appLocale;
      // Recognize in the SELECTED language only. We drop alternativeLanguageCodes:
      // they're silently ignored by latest_long AND they let Google fall back to
      // English, which (with the English hint phrases) was the "only hears English"
      // bug. The user picks the language in Settings, so trust the explicit primary.
      const { languageCode } = sttLanguageConfig(appLocale);
      // English command/domain hints bias recognition toward English tokens, so
      // only send them for an English locale. Dynamic landmark names are proper
      // nouns and help every language, so they're always included.
      const dynamicPhrases = (optsRef.current.phrases?.() ?? []).filter(Boolean);
      const boost = appLocale === 'en' ? [...dynamicPhrases, ...SPEECH_HINTS] : dynamicPhrases;
      // Drive the STT encoding from the ACTUAL bytes, not from Platform.OS. A WAV
      // file's base64 always starts with 'UklG' (= the ASCII 'RIFF' header). When a
      // header is present we OMIT encoding/sampleRate so Google reads it (declaring
      // LINEAR16 on a headerful WAV makes Google parse the 44-byte header as samples
      // → garbage). iOS records headerful 16k mono PCM .wav; Android records
      // headerless AMR_WB at a fixed 16 kHz (expo-av can't produce PCM/WAV on
      // Android) so it must declare encoding+rate; the LINEAR16 branch is a safety
      // net if iOS ever yields headerless PCM.
      const isWav = base64.startsWith('UklG');
      const audioConfig = isWav
        ? {}
        : Platform.OS === 'android'
          ? { encoding: 'AMR_WB', sampleRateHertz: 16000 }
          : { encoding: 'LINEAR16', sampleRateHertz: 16000, audioChannelCount: 1 };
      // One concise line so the format actually sent can be confirmed on-device
      // against the recording + selected language (no audio content is logged).
      console.log('[Voice][STT]', {
        platform: Platform.OS,
        isWav,
        approxBytes: Math.floor((base64.length * 3) / 4),
        languageCode,
        audioConfig,
      });
      const res = await fetch(`https://speech.googleapis.com/v1/speech:recognize?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: {
            ...audioConfig,
            languageCode,
            model: 'latest_long',
            useEnhanced: true,
            enableAutomaticPunctuation: true,
            ...(boost.length ? { speechContexts: [{ phrases: boost, boost: 10 }] } : {}),
            metadata: {
              interactionType: 'DICTATION',
              microphoneDistance: 'NEARFIELD',
              recordingDeviceType: 'SMARTPHONE',
            },
          },
          audio: { content: base64 },
        }),
      });
      const data = (await res.json()) as {
        results?: Array<{ alternatives: Array<{ transcript: string }> }>;
        error?: { message: string; status: string };
      };
      if (data.error) {
        optsRef.current.onError?.(`${data.error.status}: ${data.error.message}`);
        return;
      }
      const transcript = data.results?.[0]?.alternatives?.[0]?.transcript?.trim() ?? '';
      if (transcript) optsRef.current.onTranscript(transcript);
      else optsRef.current.onError?.('No speech detected');
    } catch (e) {
      console.warn('[Voice] transcribe failed', e);
      optsRef.current.onError?.(String(e));
    } finally {
      setTranscribing(false);
      await FileSystem.deleteAsync(uri, { idempotent: true });
    }
  };

  const stopListening = async () => {
    if (finishing.current) return;
    finishing.current = true;
    const uri = await stopRecording();
    if (uri) await transcribe(uri);
    finishing.current = false;
  };

  const cancel = async () => {
    finishing.current = true;
    await stopRecording();
    finishing.current = false;
  };

  const onStatus = (status: Audio.RecordingStatus) => {
    const silenceMs = optsRef.current.silenceMs;
    if (!status.isRecording || !silenceMs) return;
    let level = status.metering ?? -160;
    // expo-av reports metering in dBFS on iOS but using a NATURAL-log scale on
    // Android (≈2.3× more negative). Normalize Android to dBFS so the single
    // SPEECH_DB threshold means the same loudness on both platforms.
    if (Platform.OS === 'android') level *= 2.302585;
    if (level > SPEECH_DB) {
      if (!speechDetected.current) speechStartedAt.current = Date.now();
      speechDetected.current = true;
      if (silenceTimer.current) { clearTimeout(silenceTimer.current); silenceTimer.current = null; }
    } else if (speechDetected.current && !silenceTimer.current) {
      // Trailing silence after speech → auto-stop, but never before the user has
      // spoken for at least MIN_UTTERANCE_MS (so a short word + a natural pause
      // doesn't cut them off). Extend the wait by whatever min time remains.
      const spokenFor = Date.now() - speechStartedAt.current;
      const extra = Math.max(0, MIN_UTTERANCE_MS - spokenFor);
      silenceTimer.current = setTimeout(() => void stopListening(), silenceMs + extra);
    }
  };

  const startListening = async () => {
    // `starting` is a synchronous guard: recordingRef/transcribing/isListening all
    // lag behind the awaits below, so a fast double-tap (or the map auto-arm firing
    // alongside a tap) could start two recorders and orphan the first. This rejects
    // the second caller before any await.
    if (recordingRef.current || transcribing || starting.current) return;
    starting.current = true;
    let entered = false; // did we reach enterListenMode? (so the catch pairs exactly)
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        optsRef.current.onError?.('Microphone permission is required for voice.');
        return;
      }
      await enterListenMode();
      entered = true;
      speechDetected.current = false;
      speechStartedAt.current = 0;
      finishing.current = false;
      const { recording } = await Audio.Recording.createAsync(
        {
          isMeteringEnabled: true,
          android: {
            extension: '.amr',
            outputFormat: Audio.AndroidOutputFormat.AMR_WB,
            audioEncoder: Audio.AndroidAudioEncoder.AMR_WB,
            sampleRate: 16000,
            numberOfChannels: 1,
            bitRate: 23850,
          },
          ios: {
            extension: '.wav',
            outputFormat: Audio.IOSOutputFormat.LINEARPCM,
            audioQuality: Audio.IOSAudioQuality.HIGH,
            sampleRate: 16000,
            numberOfChannels: 1,
            bitRate: 256000,
            linearPCMBitDepth: 16,
            linearPCMIsBigEndian: false,
            linearPCMIsFloat: false,
          },
          web: { mimeType: 'audio/webm', bitsPerSecond: 128000 },
        },
        onStatus,
        METER_INTERVAL,
      );
      recordingRef.current = recording;
      setIsListening(true);
      maxTimer.current = setTimeout(() => void stopListening(), optsRef.current.maxMs ?? 60000);
    } catch (e) {
      console.warn('[Voice] start failed', e);
      optsRef.current.onError?.(`Could not start recording: ${String(e)}`);
      // If the recorder failed to start AFTER enterListenMode, pair the exit so the
      // capture count is balanced (otherwise ensureSpeakMode would stay blocked and
      // TTS muted). Only when we actually entered — never decrement another
      // instance's live capture.
      if (entered) await exitListenMode();
    } finally {
      starting.current = false;
    }
  };

  // Clean up if the component unmounts mid-recording.
  useEffect(() => {
    return () => { void cancel(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { isListening, transcribing, startListening, stopListening, cancel };
}
