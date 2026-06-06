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
  const { onTranscript, phrases, silenceMs, maxMs = 60000, onError } = options;

  const [isListening, setIsListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const maxTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const silenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speechDetected = useRef(false);
  const finishing = useRef(false);

  const clearTimers = () => {
    if (maxTimer.current) { clearTimeout(maxTimer.current); maxTimer.current = null; }
    if (silenceTimer.current) { clearTimeout(silenceTimer.current); silenceTimer.current = null; }
  };

  // Stop the active recording and return its file URI (or null). Idempotent.
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
    }
  };

  const transcribe = async (uri: string) => {
    const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
    if (!apiKey) {
      onError?.('EXPO_PUBLIC_GOOGLE_MAPS_API_KEY is not set.');
      return;
    }
    setTranscribing(true);
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      const { languageCode, alternativeLanguageCodes } = sttLanguageConfig(
        useSettingsStore.getState().appLocale,
      );
      const boost = [...(phrases?.() ?? []), ...SPEECH_HINTS].filter(Boolean);
      const res = await fetch(`https://speech.googleapis.com/v1/speech:recognize?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: {
            encoding: Platform.OS === 'android' ? 'AMR_WB' : 'LINEAR16',
            sampleRateHertz: 16000,
            languageCode,
            alternativeLanguageCodes,
            model: 'latest_long',
            useEnhanced: true,
            enableAutomaticPunctuation: true,
            speechContexts: [{ phrases: boost, boost: 15 }],
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
        onError?.(`${data.error.status}: ${data.error.message}`);
        return;
      }
      const transcript = data.results?.[0]?.alternatives?.[0]?.transcript?.trim() ?? '';
      if (transcript) onTranscript(transcript);
      else onError?.('No speech detected');
    } catch (e) {
      console.warn('[Voice] transcribe failed', e);
      onError?.(String(e));
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
    if (!status.isRecording || !silenceMs) return;
    const level = status.metering ?? -160;
    if (level > SPEECH_DB) {
      speechDetected.current = true;
      if (silenceTimer.current) { clearTimeout(silenceTimer.current); silenceTimer.current = null; }
    } else if (speechDetected.current && !silenceTimer.current) {
      // trailing silence after speech → auto-stop
      silenceTimer.current = setTimeout(() => void stopListening(), silenceMs);
    }
  };

  const startListening = async () => {
    if (recordingRef.current || transcribing) return;
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        onError?.('Microphone permission is required for voice.');
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      speechDetected.current = false;
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
      maxTimer.current = setTimeout(() => void stopListening(), maxMs);
    } catch (e) {
      console.warn('[Voice] start failed', e);
      onError?.(`Could not start recording: ${String(e)}`);
    }
  };

  // Clean up if the component unmounts mid-recording.
  useEffect(() => {
    return () => { void cancel(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { isListening, transcribing, startListening, stopListening, cancel };
}
