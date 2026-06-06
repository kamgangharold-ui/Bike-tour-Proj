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

function parseStations(
  json: string,
  type: 'bicibox' | 'bicipark',
  userLat: number,
  userLng: number,
): ParkingStation[] {
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
  const [biciboxRes, biciparkRes] = await Promise.all([fetch(BICIBOX_URL), fetch(BICIPARK_URL)]);
  const [biciboxJson, biciparkJson] = await Promise.all([biciboxRes.text(), biciparkRes.text()]);
  return [
    ...parseStations(biciboxJson, 'bicibox', userLat, userLng),
    ...parseStations(biciparkJson, 'bicipark', userLat, userLng),
  ]
    .filter((s) => s.distanceMetres <= radiusMetres)
    .sort((a, b) => a.distanceMetres - b.distanceMetres);
}
