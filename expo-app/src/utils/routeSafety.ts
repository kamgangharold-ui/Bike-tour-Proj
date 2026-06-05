import { haversineMetres } from './haversine';

export interface LatLng {
  latitude: number;
  longitude: number;
}

// A prohibited area modeled as a circle (centre + radius) — e.g. a dismount zone
// or a "no cycling" landmark. Radius reuses each location's geofence_radius_metres.
export interface RouteZone {
  slug: string;
  name: string;
  coordinates: LatLng;
  radiusMetres: number;
  fineEur: number;
  message: string;
}

export interface ZoneConflict {
  slug: string;
  name: string;
  fineEur: number;
  message: string;
}

export interface RouteSafetyResult {
  conflicts: ZoneConflict[];
  // Contiguous runs of route coordinates inside a prohibited zone, each ready to
  // render as its own red Polyline overlay on top of the green route.
  redSegments: LatLng[][];
}

// Shortest distance (metres) from circle centre `c` to the segment a→b, via a
// local equirectangular projection (accurate at city scale). Catches a small
// zone crossed mid-segment, which vertex-only sampling would miss.
function metresPointToSegment(c: LatLng, a: LatLng, b: LatLng): number {
  const mPerDegLat = 110_574;
  const mPerDegLng = 111_320 * Math.cos((c.latitude * Math.PI) / 180);
  const ax = (a.longitude - c.longitude) * mPerDegLng;
  const ay = (a.latitude - c.latitude) * mPerDegLat;
  const bx = (b.longitude - c.longitude) * mPerDegLng;
  const by = (b.latitude - c.latitude) * mPerDegLat;
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : -(ax * dx + ay * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const px = ax + t * dx;
  const py = ay + t * dy;
  return Math.sqrt(px * px + py * py);
}

// Test a computed route against prohibited zones. Returns the zones the route
// enters and the contiguous coordinate runs inside them (for red rendering).
export function checkRouteAgainstZones(
  route: LatLng[],
  zones: RouteZone[],
): RouteSafetyResult {
  if (route.length === 0 || zones.length === 0) {
    return { conflicts: [], redSegments: [] };
  }

  const inZone = new Array<boolean>(route.length).fill(false);
  const hit = new Map<string, RouteZone>();

  // Vertex test: any route point that lands inside a zone circle.
  for (let i = 0; i < route.length; i++) {
    const p = route[i];
    for (const z of zones) {
      const d = haversineMetres(
        p.latitude,
        p.longitude,
        z.coordinates.latitude,
        z.coordinates.longitude,
      );
      if (d <= z.radiusMetres) {
        inZone[i] = true;
        hit.set(z.slug, z);
      }
    }
  }

  // Segment test: a zone crossed between two vertices marks both endpoints.
  for (let i = 0; i < route.length - 1; i++) {
    for (const z of zones) {
      if (metresPointToSegment(z.coordinates, route[i], route[i + 1]) <= z.radiusMetres) {
        inZone[i] = true;
        inZone[i + 1] = true;
        hit.set(z.slug, z);
      }
    }
  }

  // Group consecutive in-zone points into runs, bridging one point into the
  // adjacent green so the red overlay visually connects to the rest of the route.
  const redSegments: LatLng[][] = [];
  let run: LatLng[] = [];
  for (let i = 0; i < route.length; i++) {
    if (inZone[i]) {
      if (run.length === 0 && i > 0) run.push(route[i - 1]);
      run.push(route[i]);
    } else if (run.length > 0) {
      run.push(route[i]);
      redSegments.push(run);
      run = [];
    }
  }
  if (run.length > 0) redSegments.push(run);

  // Stable display order: highest fine first, then by name.
  const conflicts: ZoneConflict[] = Array.from(hit.values())
    .sort((a, b) => b.fineEur - a.fineEur || a.name.localeCompare(b.name))
    .map((z) => ({
      slug: z.slug,
      name: z.name,
      fineEur: z.fineEur,
      message: z.message,
    }));

  return { conflicts, redSegments };
}
