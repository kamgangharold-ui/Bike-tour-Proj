// ─── On-device speech recognition (DEV-2, Android dev client) ─────────────────────
// Real-time, accurate, multilingual STT via expo-speech-recognition (Android
// SpeechRecognizer / iOS Speech). Replaces the record→upload→Google flow on the
// Android dev client. NOT in Expo Go, so the module is lazily, guardedly required:
// in Expo Go `nativeSpeechAvailable()` returns false and the existing Google STT
// path is used instead — the PART 1 bundle never touches the missing native module.

import Constants from 'expo-constants';

// 'expo' === Expo Go specifically (executionEnvironment is 'storeClient' in the dev
// client too, so it can't be used to distinguish).
const isExpoGo = Constants.appOwnership === 'expo';

/* eslint-disable @typescript-eslint/no-explicit-any */
let M: any = null; // ExpoSpeechRecognitionModule
let resolved = false;

function ensure(): boolean {
  if (isExpoGo) return false;
  if (resolved) return !!M;
  resolved = true;
  try {
    M = require('expo-speech-recognition').ExpoSpeechRecognitionModule;
  } catch {
    M = null;
  }
  return !!M;
}

// True only when the native recognizer is present AND the OS exposes a recognizer.
export function nativeSpeechAvailable(): boolean {
  if (!ensure()) return false;
  try {
    return M.isRecognitionAvailable();
  } catch {
    return false;
  }
}

export interface NativeListenHandlers {
  onResult: (text: string, isFinal: boolean) => void;
  onError: (msg: string) => void;
  onEnd: () => void;
}

let subs: Array<{ remove: () => void }> = [];
function clearSubs(): void {
  subs.forEach((s) => { try { s.remove(); } catch { /* ignore */ } });
  subs = [];
}

// Start on-device recognition in the given BCP-47 language. Returns false if it
// couldn't start (caller then falls back to the Google flow). Never throws.
export async function startNativeListening(
  lang: string,
  contextualStrings: string[],
  h: NativeListenHandlers,
): Promise<boolean> {
  if (!ensure()) return false;
  try {
    const perm = await M.requestPermissionsAsync();
    if (!perm.granted) {
      h.onError('Microphone/speech permission is required for voice.');
      return false;
    }
    clearSubs();
    subs.push(M.addListener('result', (e: any) => {
      const text = e?.results?.[0]?.transcript ?? '';
      h.onResult(text, !!e?.isFinal);
    }));
    subs.push(M.addListener('error', (e: any) => h.onError(e?.message ?? String(e?.error ?? 'speech error'))));
    subs.push(M.addListener('end', () => { clearSubs(); h.onEnd(); }));
    const onDevice = typeof M.supportsOnDeviceRecognition === 'function'
      ? M.supportsOnDeviceRecognition()
      : false;
    M.start({
      lang,
      interimResults: true,
      continuous: false, // ends on natural end-of-speech
      requiresOnDeviceRecognition: onDevice,
      contextualStrings: contextualStrings.filter(Boolean).slice(0, 50),
      maxAlternatives: 1,
    });
    return true;
  } catch (e) {
    clearSubs();
    h.onError(String(e));
    return false;
  }
}

// Stop + finalize (emits a final result then 'end').
export function stopNativeListening(): void {
  if (!M) return;
  try { M.stop(); } catch { /* ignore */ }
}

// Cancel immediately, discard.
export function abortNativeListening(): void {
  clearSubs();
  if (!M) return;
  try { M.abort(); } catch { /* ignore */ }
}
