// ─── Voice pipeline debug log (TEMPORARY — remove before ship) ─────────────────────
// Metro shows nothing useful, so the app self-reports each voice step on-screen.
// Every stage of TTS/STT pushes a line here; VoiceDebugOverlay renders them live so
// a screenshot pinpoints exactly where the pipeline breaks. Gated by __DEV__ at the
// overlay, so it never appears in a production build.

import { create } from 'zustand';

interface VoiceDebugState {
  lines: string[];
  log: (line: string) => void;
  clear: () => void;
}

const MAX = 40;

function stamp(): string {
  // Date.now is fine in app runtime (only workflow scripts forbid it).
  const d = new Date();
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}.${ms}`;
}

export const useVoiceDebug = create<VoiceDebugState>((set, get) => ({
  lines: [],
  log: (line) => {
    const entry = `${stamp()}  ${line}`;
    // eslint-disable-next-line no-console
    console.log('[VoiceDebug]', line);
    set({ lines: [...get().lines, entry].slice(-MAX) });
  },
  clear: () => set({ lines: [] }),
}));

// Module-level helper so non-React code (voice.ts, audioSession.ts, useVoiceChat)
// can log without importing the hook. Never throws.
export function vlog(line: string): void {
  try {
    useVoiceDebug.getState().log(line);
  } catch {
    /* ignore */
  }
}
