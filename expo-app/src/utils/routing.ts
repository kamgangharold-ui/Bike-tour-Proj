// ─── Turn-by-turn helpers ─────────────────────────────────────────────────────
// Parses OSRM maneuver `steps` into spoken instructions and finds the next turn
// from the live position. The map already fetches OSRM routes; we just add
// `?steps=true` and feed the legs[].steps[] here. Instruction phrasing is English
// for now (locale-ready: pass a locale and extend INSTR); the conversational layer
// (STT + Claude replies + command confirmations) is already multilingual.

import { haversineMetres } from './haversine';
import type { AppLocale } from './locale';

export interface ManeuverStep {
  instruction: string;
  location: { latitude: number; longitude: number };
  maneuverType: string;       // OSRM maneuver.type (turn / continue / roundabout / arrive…)
  modifier?: string;          // OSRM maneuver.modifier (left / right / uturn / straight…)
}

// A Unicode directional arrow for a maneuver — shown in the in-app turn banner and
// the live nav notification, so the rider can glance at the direction.
export function maneuverArrow(type: string, modifier?: string): string {
  if (type === 'arrive') return '🏁';
  if (type === 'roundabout' || type === 'rotary' || type === 'roundabout turn') return '⟳';
  switch (modifier) {
    case 'left': return '←';
    case 'right': return '→';
    case 'slight left': return '↖';
    case 'slight right': return '↗';
    case 'sharp left': return '↰';
    case 'sharp right': return '↱';
    case 'uturn': return '⤵';
    case 'straight': return '↑';
    default: return '↑';
  }
}

interface OsrmStep {
  distance: number;
  name?: string;
  maneuver: { location: [number, number]; type: string; modifier?: string };
}
export interface OsrmRoute {
  legs?: { steps?: OsrmStep[] }[];
  geometry: { coordinates: [number, number][] };
  distance: number;
  duration: number;
}

const DIR: Record<string, string> = {
  left: 'left',
  right: 'right',
  'slight left': 'slightly left',
  'slight right': 'slightly right',
  'sharp left': 'sharp left',
  'sharp right': 'sharp right',
  straight: 'straight',
  uturn: 'around',
};

// Build a readable instruction from an OSRM maneuver. `locale` is accepted for
// forward-compat; only English is implemented today (returns English otherwise).
export function buildInstruction(
  type: string,
  modifier: string | undefined,
  name: string | undefined,
  _locale: AppLocale = 'en',
): string {
  const road = name ? ` onto ${name}` : '';
  const dir = modifier ? DIR[modifier] ?? modifier : '';
  switch (type) {
    case 'arrive':
      return 'You have arrived';
    case 'turn':
    case 'end of road':
      return `Turn ${dir || 'ahead'}${road}`;
    case 'new name':
    case 'continue':
      return `Continue${dir && dir !== 'straight' ? ' ' + dir : ''}${road}`;
    case 'merge':
      return `Merge${dir ? ' ' + dir : ''}${road}`;
    case 'on ramp':
      return `Take the ramp${road}`;
    case 'off ramp':
      return `Take the exit${road}`;
    case 'fork':
      return `Keep ${dir || 'straight'}${road}`;
    case 'roundabout':
    case 'rotary':
      return `Take the roundabout${road}`;
    case 'roundabout turn':
      return `At the roundabout, turn ${dir}${road}`;
    default:
      return dir ? `Turn ${dir}${road}` : `Continue${road}`;
  }
}

// Flatten an OSRM route's legs/steps into spoken maneuvers (skips the 'depart'
// start step). Each step's maneuver.location is the point the action happens at.
export function parseOsrmSteps(route: OsrmRoute, locale: AppLocale = 'en'): ManeuverStep[] {
  const out: ManeuverStep[] = [];
  for (const leg of route.legs ?? []) {
    for (const s of leg.steps ?? []) {
      if (s.maneuver.type === 'depart') continue;
      const [lng, lat] = s.maneuver.location;
      out.push({
        instruction: buildInstruction(s.maneuver.type, s.maneuver.modifier, s.name, locale),
        location: { latitude: lat, longitude: lng },
        maneuverType: s.maneuver.type,
        modifier: s.maneuver.modifier,
      });
    }
  }
  return out;
}

// Given the live position and the maneuver list, advance past any maneuvers
// already reached and return the next one + straight-line distance to it. Pure;
// the caller owns the running index (a ref) and announcement de-dup.
export interface NextTurn {
  index: number;
  step: ManeuverStep;
  distanceM: number;
}
const REACHED_M = 25; // within this, the maneuver is considered passed

export function nextManeuver(
  position: { latitude: number; longitude: number },
  steps: ManeuverStep[],
  fromIndex: number,
): NextTurn | null {
  let idx = fromIndex;
  while (idx < steps.length) {
    const d = haversineMetres(
      position.latitude,
      position.longitude,
      steps[idx].location.latitude,
      steps[idx].location.longitude,
    );
    if (d < REACHED_M) {
      idx++;
      continue;
    }
    return { index: idx, step: steps[idx], distanceM: d };
  }
  return null;
}

// Minimum distance from a point to a polyline (for off-route detection).
export function distanceToPolyline(
  p: { latitude: number; longitude: number },
  line: { latitude: number; longitude: number }[],
): number {
  if (line.length === 0) return Infinity;
  if (line.length === 1) {
    return haversineMetres(p.latitude, p.longitude, line[0].latitude, line[0].longitude);
  }
  let min = Infinity;
  for (let i = 0; i < line.length - 1; i++) {
    min = Math.min(min, pointToSegmentM(p, line[i], line[i + 1]));
  }
  return min;
}

// Equirectangular projection around the point → planar point-segment distance.
function pointToSegmentM(
  p: { latitude: number; longitude: number },
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const R = 6371000;
  const rad = Math.PI / 180;
  const cosLat = Math.cos(p.latitude * rad);
  const px = p.longitude * rad * cosLat * R;
  const py = p.latitude * rad * R;
  const ax = a.longitude * rad * cosLat * R;
  const ay = a.latitude * rad * R;
  const bx = b.longitude * rad * cosLat * R;
  const by = b.latitude * rad * R;
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}
