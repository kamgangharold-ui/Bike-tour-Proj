// ─── Parking service ──────────────────────────────────────────────────────────
// Object-I/O fetch+filter of Bicibox / Bicipark stations, reusing the SAME
// endpoints as the Parking tab. The Parking screen keeps its string-based
// filter; this is the reusable path for the voice "find_parking" intent.

import { BICIBOX_URL, BICIPARK_URL } from '../../constants/rules';
import { haversineMetres } from './haversine';

export interface ParkingStation {
  name: string;
  type: 'bicibox' | 'bicipark';
  latitude: number;
  longitude: number;
  distanceMetres: number;
}

// Request JSON explicitly; some Open Data endpoints return an HTML block/redirect
// page without it. Matches the map's Bicing fetch options.
const FETCH_OPTS = { headers: { Accept: 'application/json', 'User-Agent': 'BikeTourGuide/1.0' } };

function parseStations(
  json: string,
  type: 'bicibox' | 'bicipark',
  userLat: number,
  userLng: number,
): ParkingStation[] {
  // Guard: an HTML response (block page / redirect) is not JSON — degrade to empty
  // rather than throwing, so find_parking just reports "none nearby".
  const head = json.trimStart().slice(0, 1);
  if (head === '<') {
    console.warn(`[Parking] ${type} endpoint returned HTML, not JSON — skipping`);
    return [];
  }
  let rows: Record<string, unknown>[];
  try {
    const parsed = JSON.parse(json) as unknown;
    const records = (parsed as Record<string, unknown>)?.['result'] as Record<string, unknown> | undefined;
    const recArr = records?.['records'];
    rows = Array.isArray(recArr)
      ? (recArr as Record<string, unknown>[])
      : Array.isArray(parsed)
        ? (parsed as Record<string, unknown>[])
        : [];
  } catch {
    return [];
  }
  return rows
    .map((s): ParkingStation | null => {
      const lat = parseFloat(String(s['LATITUD'] ?? s['latitud'] ?? '').replace(',', '.'));
      const lng = parseFloat(String(s['LONGITUD'] ?? s['longitud'] ?? '').replace(',', '.'));
      if (isNaN(lat) || isNaN(lng)) return null;
      const name = String(s['EQUIPAMENT'] ?? s['NOM'] ?? s['nom'] ?? 'Bike parking');
      return {
        name,
        type,
        latitude: lat,
        longitude: lng,
        distanceMetres: Math.round(haversineMetres(userLat, userLng, lat, lng)),
      };
    })
    .filter((s): s is ParkingStation => s !== null);
}

// Nearest bike-parking stations within `radiusMetres`, closest first.
export async function fetchNearestParking(
  userLat: number,
  userLng: number,
  radiusMetres = 1500,
): Promise<ParkingStation[]> {
  let biciboxJson = '';
  let biciparkJson = '';
  try {
    const [biciboxRes, biciparkRes] = await Promise.all([
      fetch(BICIBOX_URL, FETCH_OPTS),
      fetch(BICIPARK_URL, FETCH_OPTS),
    ]);
    [biciboxJson, biciparkJson] = await Promise.all([biciboxRes.text(), biciparkRes.text()]);
  } catch (e) {
    console.warn('[Parking] fetch failed', e);
    return []; // network error → caller reports "no parking nearby" gracefully
  }
  return [
    ...parseStations(biciboxJson, 'bicibox', userLat, userLng),
    ...parseStations(biciparkJson, 'bicipark', userLat, userLng),
  ]
    .filter((s) => s.distanceMetres <= radiusMetres)
    .sort((a, b) => a.distanceMetres - b.distanceMetres);
}
