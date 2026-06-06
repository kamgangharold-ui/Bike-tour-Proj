// ─── Landmark dedupe + fuzzy match ───────────────────────────────────────────
// Shared helpers so the destination list, map markers, and the voice navigate
// resolver all treat landmarks consistently (duplicate Firestore docs can exist
// until the data dedup runs — the client must never show or mis-route on them).

export interface Slugged {
  slug?: string;
  name?: string;
  coordinates?: { latitude: number; longitude: number };
  latitude?: number;
  longitude?: number;
}

// Keep exactly one item per slug (fallback: normalized name + rounded coords).
export function dedupeBySlug<T extends Slugged>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const it of items) {
    const lat = it.coordinates?.latitude ?? it.latitude;
    const lng = it.coordinates?.longitude ?? it.longitude;
    const key =
      it.slug && it.slug.trim()
        ? `s:${it.slug.trim().toLowerCase()}`
        : `n:${normalize(it.name ?? '')}@${lat?.toFixed(4)},${lng?.toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out;
}

// Lowercase + strip diacritics so "família"/"familia", "batlló"/"batllo" match.
const DIACRITICS = /[̀-ͯ]/g;
export function normalize(s: string): string {
  return s.normalize('NFD').replace(DIACRITICS, '').toLowerCase().trim();
}

function bigrams(s: string): Map<string, number> {
  const m = new Map<string, number>();
  const t = s.replace(/\s+/g, ' ');
  for (let i = 0; i < t.length - 1; i++) {
    const g = t.slice(i, i + 2);
    m.set(g, (m.get(g) ?? 0) + 1);
  }
  return m;
}

// Sørensen–Dice similarity on character bigrams (0..1).
function dice(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const A = bigrams(a);
  const B = bigrams(b);
  let inter = 0;
  let total = 0;
  for (const v of A.values()) total += v;
  for (const v of B.values()) total += v;
  for (const [g, count] of A) {
    const bc = B.get(g);
    if (bc) inter += Math.min(count, bc);
  }
  return (2 * inter) / total;
}

export interface MatchResult<T> {
  item: T;
  score: number; // 0..1 confidence
}

// Best landmark for a spoken query: exact (accent-insensitive) → containment
// (length-weighted) → bigram similarity. Caller decides on the score:
// >= 0.6 confident, 0.4–0.6 ask "did you mean", below → geocode.
export function bestLandmarkMatch<T extends Slugged>(query: string, items: T[]): MatchResult<T> | null {
  const q = normalize(query);
  if (!q) return null;
  let best: T | null = null;
  let bestScore = 0;
  for (const it of items) {
    const n = normalize(it.name ?? '');
    if (!n) continue;
    let score: number;
    if (n === q) score = 1;
    else if (n.includes(q) || q.includes(n)) {
      const ratio = Math.min(n.length, q.length) / Math.max(n.length, q.length);
      score = 0.7 + 0.3 * ratio;
    } else {
      score = dice(q, n);
    }
    if (score > bestScore) {
      bestScore = score;
      best = it;
    }
  }
  return best ? { item: best, score: bestScore } : null;
}
