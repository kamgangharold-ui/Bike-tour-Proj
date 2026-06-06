// ─── Minimal WAV header parser ─────────────────────────────────────────────────
// React Native has no Buffer, so we decode just the first ~64 bytes of the base64
// recording to read the RIFF/WAVE header. This lets the STT request declare the
// ACTUAL sample rate / channel count the recorder produced (expo-audio may ignore
// the requested 16 kHz and use the hardware rate), instead of a hard-coded guess —
// the real cause of "bad encoding" when the declared config doesn't match the file.

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

// Decode up to maxBytes from the start of a base64 string into byte values.
function decodePrefix(b64: string, maxBytes: number): number[] {
  const out: number[] = [];
  let buf = 0;
  let bits = 0;
  for (let i = 0; i < b64.length && out.length < maxBytes; i++) {
    const v = B64.indexOf(b64[i]);
    if (v < 0) continue; // skip '=', newlines, stray chars
    buf = (buf << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((buf >> bits) & 0xff);
    }
  }
  return out;
}

const ascii = (b: number[], s: number, e: number) =>
  b.slice(s, e).map((c) => (c >= 32 && c < 127 ? String.fromCharCode(c) : '·')).join('');
const u16 = (b: number[], o: number) => (b[o] | (b[o + 1] << 8)) >>> 0;
const u32 = (b: number[], o: number) => ((b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0);

export interface WavInfo {
  head12: string;       // ASCII of the first 12 bytes (should be "RIFF····WAVE")
  isRiffWave: boolean;
  audioFormat: number;  // 1 = PCM (LINEAR16)
  channels: number;
  sampleRate: number;
  bitsPerSample: number;
}

// Parse a canonical WAV header (RIFF/WAVE + 'fmt ' chunk at offset 12). Returns null
// if there aren't enough bytes. Never throws.
export function parseWavHeader(base64: string): WavInfo | null {
  try {
    const b = decodePrefix(base64, 64);
    if (b.length < 36) return null;
    const isRiffWave = ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WAVE';
    return {
      head12: ascii(b, 0, 12),
      isRiffWave,
      audioFormat: u16(b, 20),
      channels: u16(b, 22) || 1,
      sampleRate: u32(b, 24) || 16000,
      bitsPerSample: u16(b, 34) || 16,
    };
  } catch {
    return null;
  }
}
