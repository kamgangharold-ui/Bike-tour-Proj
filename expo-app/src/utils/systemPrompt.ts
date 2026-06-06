// ─── BikAI system prompt ──────────────────────────────────────────────────────
// Builds the live-context system prompt fresh on every send. Reads the SAME store
// the map/geofence write to (live GPS + confirmed active landmark) via getState(),
// so it stays stateless from the caller's view and both chat and the voice command
// router get identical grounding. Pass the loaded landmarks for the nearby list.

import { useAppStore } from '../store/useAppStore';
import { haversineMetres } from './haversine';

export interface LandmarkInfo {
  name: string;
  slug?: string;
  short_description?: string;
  category?: string;
  coordinates?: { latitude: number; longitude: number };
  geofence_radius_metres?: number;
  regulatory_alert?: { message?: string; fine_eur?: number };
}

export function buildBikAISystemPrompt(landmarks: LandmarkInfo[]): string {
  const s = useAppStore.getState();
  const { userLat, userLng, activeSlug, activeName, activeCategory, activeDescription } = s;
  const hasPos = userLat !== null && userLng !== null;
  const lat = userLat ?? 0;
  const lng = userLng ?? 0;

  // Distance-sorted nearby landmarks, excluding the confirmed current one.
  let nearbyStr = 'GPS position not available yet.';
  if (hasPos) {
    const nearby = landmarks
      .map((loc) => {
        const c = loc.coordinates;
        if (!c || loc.slug === activeSlug) return null;
        const dist = Math.round(haversineMetres(lat, lng, c.latitude, c.longitude));
        const regNote = loc.regulatory_alert?.message ? ` ⚠️ ${loc.regulatory_alert.message}` : '';
        return { name: loc.name, dist, desc: loc.short_description ?? '', regNote };
      })
      .filter((l): l is NonNullable<typeof l> => l !== null && l.dist <= 500)
      .sort((a, b) => a.dist - b.dist)
      .map((l) => `- ${l.name} (${l.dist} m)${l.regNote}: ${l.desc}`);
    nearbyStr = nearby.length > 0 ? nearby.join('\n') : 'None within 500 m';
  }

  // GROUND TRUTH first: the geofence's confirmed current landmark.
  let current: string;
  if (activeSlug) {
    const active = landmarks.find((l) => l.slug === activeSlug);
    const radius = active?.geofence_radius_metres ?? 40;
    current =
      `CURRENT LOCATION — CONFIRMED by the app's GPS geofencing: the user is RIGHT NOW at ` +
      `"${activeName}" [${activeCategory}], inside its ${radius} m geofence. ` +
      `Treat this as their exact location — do NOT contradict it or claim they are somewhere else.\n` +
      `About it: ${activeDescription}\n` +
      (s.activeIsRegulatory
        ? `⚠️ Regulatory alert here: €${s.activeRegulatoryFineEur} fine — ${s.activeRegulatoryMessage}\n`
        : '');
  } else if (hasPos) {
    current =
      `CURRENT LOCATION: no geofence is active — the user is NOT confirmed at any landmark. ` +
      `Their GPS position is [${lat.toFixed(5)}, ${lng.toFixed(5)}]. Use the nearest landmarks below for context.\n`;
  } else {
    current = `CURRENT LOCATION: GPS position is not available yet.\n`;
  }

  return (
    `You are BikAI, a cycling guide assistant for bike tourists in Barcelona.\n` +
    current +
    `\nNearby landmarks within 500 m (distance-sorted):\n${nearbyStr}\n\n` +
    `Cycling regulations: sidewalk riding = €500 fine, both earphones = €100 fine, ` +
    `Gothic Quarter = mandatory dismount zone.\n` +
    `Answer concisely and helpfully. If unsure, say so honestly. ` +
    `Respond in the same language the user writes in. ` +
    `Use plain text only — no markdown (no **, no ##, no ---, no > blocks). Emojis are fine.`
  );
}
