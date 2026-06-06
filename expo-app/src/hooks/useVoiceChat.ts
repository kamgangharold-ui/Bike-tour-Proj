// ─── Shared voice capture + Google STT (expo-audio) ───────────────────────────────
// The ONE speech-to-text pipeline, reused by the BikAI chat (tap-to-stop) and the
// map tap-to-talk (silence auto-stop). MIGRATED off the deprecated expo-av (dead in
// SDK 54 Expo Go) to expo-audio: useAudioRecorder → file → Google Speech-to-Text →
// onTranscript(text). expo-audio works in Expo Go on SDK 54 (recording + audio
// session), which is the root-cause fix for voice being dead.
//
// Every step pushes a line to the on-screen voice debug overlay (vlog) so failures
// are visible on-device without Metro.

import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import {
  useAudioRecorder,
  requestRecordingPermissionsAsync,
  IOSOutputFormat,
  AudioQuality,
  type RecordingOptions,
} from 'expo-audio';
import { useSettingsStore } from '../store/useSettingsStore';
import { sttLanguageConfig, localeToBcp47 } from '../utils/locale';
import { enterListenMode, exitListenMode } from '../utils/audioSession';
import { vlog } from '../store/useVoiceDebug';
import { parseWavHeader } from '../utils/wav';
import {
  nativeSpeechAvailable,
  startNativeListening,
  stopNativeListening,
  abortNativeListening,
} from '../utils/nativeSpeech';

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

// expo-audio metering scales differ by platform: iOS reports averagePower (RMS-style
// dBFS), Android reports 20*log10(maxAmplitude/32767) — a PEAK over the poll window,
// which runs much hotter, so it needs a higher threshold. The Android value is a
// starting point; the debug overlay logs live dB so it can be calibrated on-device.
const SPEECH_DB = Platform.OS === 'android' ? -22 : -40; // dBFS; above this = speaking
const METER_INTERVAL = 200; // ms between metering polls (silence detection)
// Don't let a brief mid-sentence pause auto-stop the recording: require this much
// speech since it began before the trailing-silence timer is allowed to fire.
const MIN_UTTERANCE_MS = 900;

// 16 kHz MONO, Google-STT-friendly. iOS → true LINEAR16 WAV; Android → AMR_WB
// (Google-supported; expo-audio's MediaRecorder can't emit raw PCM/WAV on Android).
const STT_RECORDING_OPTIONS: RecordingOptions = {
  isMeteringEnabled: true,
  extension: '.amr',
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 23850,
  android: {
    extension: '.amr',
    outputFormat: 'amrwb',
    audioEncoder: 'amr_wb',
    sampleRate: 16000,
  },
  ios: {
    extension: '.wav',
    outputFormat: IOSOutputFormat.LINEARPCM,
    audioQuality: AudioQuality.HIGH,
    sampleRate: 16000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: { mimeType: 'audio/webm', bitsPerSecond: 128000 },
};

export interface UseVoiceChatOptions {
  onTranscript: (text: string) => void;
  phrases?: () => string[];
  silenceMs?: number; // auto-stop after this much trailing silence (map tap-to-talk)
  maxMs?: number;     // hard cap on one utterance (default 60 s; map passes ~8 s)
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
  const optsRef = useRef(options);
  optsRef.current = options;

  const recorder = useAudioRecorder(STT_RECORDING_OPTIONS);

  const [isListening, setIsListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);

  const recordingActiveRef = useRef(false); // true between record() and stop()
  const maxTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const meterTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const silenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speechDetected = useRef(false);
  const speechStartedAt = useRef(0);
  const finishing = useRef(false);
  const starting = useRef(false); // synchronous guard against re-entrant startListening
  const startSeq = useRef(0);     // token to detect teardown during the start awaits
  const nativeActiveRef = useRef(false); // on-device recognizer (standalone Android) is listening

  const clearTimers = () => {
    if (maxTimer.current) { clearTimeout(maxTimer.current); maxTimer.current = null; }
    if (meterTimer.current) { clearInterval(meterTimer.current); meterTimer.current = null; }
    if (silenceTimer.current) { clearTimeout(silenceTimer.current); silenceTimer.current = null; }
  };

  // Poll input level for trailing-silence auto-stop (map tap-to-talk).
  const pollMeter = () => {
    const silenceMs = optsRef.current.silenceMs;
    if (!silenceMs) return;
    let level = -160;
    try { level = recorder.getStatus().metering ?? -160; } catch { /* ignore */ }
    if (level > SPEECH_DB) {
      if (!speechDetected.current) { speechStartedAt.current = Date.now(); vlog(`speech detected @ ${level.toFixed(0)}dB`); }
      speechDetected.current = true;
      if (silenceTimer.current) { clearTimeout(silenceTimer.current); silenceTimer.current = null; }
    } else if (speechDetected.current && !silenceTimer.current) {
      const spokenFor = Date.now() - speechStartedAt.current;
      const extra = Math.max(0, MIN_UTTERANCE_MS - spokenFor);
      vlog(`silence @ ${level.toFixed(0)}dB → stop in ${silenceMs + extra}ms`);
      silenceTimer.current = setTimeout(() => void stopListening(), silenceMs + extra);
    }
  };

  // Stop the active recording and return its file URI (or null). Idempotent.
  // Pairs exitListenMode ONLY when this instance actually held a recording (a no-op
  // stop on an idle instance must not clear the shared capture count).
  const stopRecording = async (): Promise<string | null> => {
    clearTimers();
    if (!recordingActiveRef.current) return null;
    recordingActiveRef.current = false;
    setIsListening(false);
    // Capture duration BEFORE stop() — recorder.currentTime resets to 0 afterwards
    // (that's why the debug showed dur:0ms, not an empty recording).
    let durMs = 0;
    try { durMs = recorder.getStatus().durationMillis ?? 0; } catch { /* ignore */ }
    try {
      await recorder.stop();
      const uri = recorder.uri;
      vlog(`recording stopped — uri:${uri ? 'ok' : 'null'} dur:${Math.round(durMs)}ms`);
      return uri ?? null;
    } catch (e) {
      vlog(`stop failed: ${String(e)}`);
      console.warn('[Voice] stop failed', e);
      return null;
    } finally {
      await exitListenMode();
    }
  };

  const transcribe = async (uri: string) => {
    const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
    if (!apiKey) {
      optsRef.current.onError?.('EXPO_PUBLIC_GOOGLE_MAPS_API_KEY is not set.');
      vlog('STT abort: no API key');
      return;
    }
    setTranscribing(true);
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      const appLocale = useSettingsStore.getState().appLocale;
      const { languageCode } = sttLanguageConfig(appLocale);
      const dynamicPhrases = (optsRef.current.phrases?.() ?? []).filter(Boolean);
      const boost = appLocale === 'en' ? [...dynamicPhrases, ...SPEECH_HINTS] : dynamicPhrases;
      const approxBytes = Math.floor((base64.length * 3) / 4);
      // Header is parsed for DIAGNOSTICS only (the on-device log) — NOT to choose the
      // encoding. The fmt field reads 0 unreliably, so gating on it pushed the code
      // into the omit/"auto" branch, which Google rejects with "bad encoding". We
      // KNOW the recorded format from the RecordingOptions, so declare it explicitly:
      //   • iOS  = 16 kHz mono 16-bit LINEAR16 PCM WAV  → LINEAR16/16000/1
      //   • Android = headerless AMR_WB @ 16 kHz         → AMR_WB/16000
      const wav = parseWavHeader(base64);
      vlog(`file head: "${wav?.head12 ?? '?'}" fmt:${wav?.audioFormat ?? '?'} ch:${wav?.channels ?? '?'} rate:${wav?.sampleRate ?? '?'} bits:${wav?.bitsPerSample ?? '?'} ${approxBytes}B`);
      const audioConfig: Record<string, unknown> =
        Platform.OS === 'android'
          ? { encoding: 'AMR_WB', sampleRateHertz: 16000 }
          : { encoding: 'LINEAR16', sampleRateHertz: 16000, audioChannelCount: 1 };
      if (approxBytes < 1200) vlog('⚠ recording is tiny — likely empty/too short');

      type STTResp = {
        results?: Array<{ alternatives: Array<{ transcript: string }> }>;
        error?: { message: string; status: string };
      };
      const recognize = async (cfg: Record<string, unknown>): Promise<STTResp> => {
        const res = await fetch(`https://speech.googleapis.com/v1/speech:recognize?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            config: {
              ...cfg,
              languageCode,
              model: 'latest_long',
              useEnhanced: true,
              enableAutomaticPunctuation: true,
              ...(boost.length ? { speechContexts: [{ phrases: boost, boost: 10 }] } : {}),
              metadata: { interactionType: 'DICTATION', microphoneDistance: 'NEARFIELD', recordingDeviceType: 'SMARTPHONE' },
            },
            audio: { content: base64 },
          }),
        });
        return (await res.json()) as STTResp;
      };

      vlog(`STT → ${languageCode} ${(audioConfig.encoding as string) ?? 'auto'}@${(audioConfig.sampleRateHertz as number) ?? '?'}`);
      let data = await recognize(audioConfig);
      // Fallback: if the explicit config errored on a WAV, retry once letting Google
      // auto-detect from the header (the two encodings cover each other's failure mode).
      if (data.error && wav?.isRiffWave && Object.keys(audioConfig).length > 0) {
        vlog(`STT retry (auto-detect) after: ${data.error.status}`);
        data = await recognize({});
      }
      if (data.error) {
        vlog(`STT error ${data.error.status}: ${data.error.message}`);
        optsRef.current.onError?.(`${data.error.status}: ${data.error.message}`);
        return;
      }
      const transcript = data.results?.[0]?.alternatives?.[0]?.transcript?.trim() ?? '';
      if (transcript) { vlog(`STT result: "${transcript}"`); optsRef.current.onTranscript(transcript); }
      else { vlog('STT result: (empty)'); optsRef.current.onError?.('No speech detected'); }
    } catch (e) {
      vlog(`STT fetch failed: ${String(e)}`);
      console.warn('[Voice] transcribe failed', e);
      optsRef.current.onError?.(String(e));
    } finally {
      setTranscribing(false);
      await FileSystem.deleteAsync(uri, { idempotent: true });
    }
  };

  const stopListening = async () => {
    if (nativeActiveRef.current) { stopNativeListening(); return; } // 'end' event resets state
    startSeq.current += 1; // invalidate any in-flight start (so it releases its capture)
    if (finishing.current) return;
    finishing.current = true;
    const uri = await stopRecording();
    if (uri) await transcribe(uri);
    finishing.current = false;
  };

  const cancel = async () => {
    if (nativeActiveRef.current) {
      abortNativeListening();
      nativeActiveRef.current = false;
      setIsListening(false);
      return;
    }
    startSeq.current += 1; // invalidate any in-flight start
    finishing.current = true;
    await stopRecording();
    finishing.current = false;
  };

  const startListening = async () => {
    if (recordingActiveRef.current || transcribing || starting.current || nativeActiveRef.current) return;

    // Prefer the on-device recognizer when present (standalone Android) — real-time,
    // multilingual, no record→upload, and immune to the WAV/format issues. In Expo
    // Go this is false, so we fall through to the expo-audio + Google STT flow.
    if (nativeSpeechAvailable()) {
      nativeActiveRef.current = true;
      setIsListening(true);
      vlog('on-device STT: listening…');
      const lang = localeToBcp47(useSettingsStore.getState().appLocale);
      const ok = await startNativeListening(lang, optsRef.current.phrases?.() ?? [], {
        onResult: (text, isFinal) => { if (isFinal && text.trim()) optsRef.current.onTranscript(text.trim()); },
        onError: (msg) => { nativeActiveRef.current = false; setIsListening(false); optsRef.current.onError?.(msg); },
        onEnd: () => { nativeActiveRef.current = false; setIsListening(false); },
      });
      if (!ok) { nativeActiveRef.current = false; setIsListening(false); }
      return;
    }

    starting.current = true;
    const seq = ++startSeq.current; // this start's token; teardown bumps startSeq
    let entered = false;
    try {
      vlog('mic tapped → requesting permission');
      const { granted } = await requestRecordingPermissionsAsync();
      if (seq !== startSeq.current) return; // cancelled/unmounted during await
      if (!granted) {
        vlog('mic permission DENIED');
        optsRef.current.onError?.('Microphone permission is required for voice.');
        return;
      }
      await enterListenMode();
      entered = true;
      // If we were torn down during permission/enter, release the capture we just
      // took so activeCaptures never strands at +1 (which would mute TTS forever).
      if (seq !== startSeq.current) { entered = false; await exitListenMode(); return; }
      speechDetected.current = false;
      speechStartedAt.current = 0;
      finishing.current = false;
      await recorder.prepareToRecordAsync();
      if (seq !== startSeq.current) { entered = false; await exitListenMode(); return; }
      recorder.record();
      recordingActiveRef.current = true;
      setIsListening(true);
      vlog('recording started — listening…');
      if (optsRef.current.silenceMs) meterTimer.current = setInterval(pollMeter, METER_INTERVAL);
      maxTimer.current = setTimeout(() => void stopListening(), optsRef.current.maxMs ?? 60000);
    } catch (e) {
      vlog(`start failed: ${String(e)}`);
      console.warn('[Voice] start failed', e);
      optsRef.current.onError?.(`Could not start recording: ${String(e)}`);
      recordingActiveRef.current = false;
      setIsListening(false);
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
