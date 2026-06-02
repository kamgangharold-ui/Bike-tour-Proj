function haversineMetres(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function filterParkingByDistance(
  json: string,
  userLat: number,
  userLng: number,
  radiusMetres: number,
): string {
  let stations: Record<string, unknown>[];
  try {
    const parsed = JSON.parse(json) as unknown;
    const asAny = parsed as Record<string, unknown>;
    const records = (asAny?.result as Record<string, unknown>)?.records;
    stations = Array.isArray(records)
      ? (records as Record<string, unknown>[])
      : Array.isArray(parsed)
        ? (parsed as Record<string, unknown>[])
        : [];
  } catch {
    return '[]';
  }

  const withDistance = stations
    .map((s) => {
      const lat = parseFloat(String(s['LATITUD'] ?? s['latitud'] ?? ''));
      const lng = parseFloat(String(s['LONGITUD'] ?? s['longitud'] ?? ''));
      if (isNaN(lat) || isNaN(lng)) return null;
      const distanceMetres = Math.round(haversineMetres(userLat, userLng, lat, lng));
      return { ...s, distanceMetres };
    })
    .filter(
      (s): s is NonNullable<typeof s> =>
        s !== null && s.distanceMetres <= radiusMetres,
    );

  withDistance.sort((a, b) => a.distanceMetres - b.distanceMetres);
  return JSON.stringify(withDistance);
}
