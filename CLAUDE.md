# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Mission
A location-aware digital tour guide for cyclists in Barcelona. When a rider enters a 40-metre radius of a landmark, the app fires a local notification, surfaces contextual FAQs, quizzes, regulatory warnings (fines, dismount zones), and parking locators — all hands-free.

---

## Tech Stack

| Layer | Tool | Purpose |
|---|---|---|
| Frontend | React Native + Expo (SDK 52) | UI, navigation, native APIs |
| Navigation | Expo Router v4 (file-based) | Stack + Tab routing |
| Backend | Firebase Firestore (NoSQL) | All app data |
| Auth | Firebase Auth (JS SDK v10) | Anonymous + email/password |
| Geofencing | expo-location + expo-task-manager | Background GPS, 40 m geofences |
| Notifications | expo-notifications | Triggered on geofence entry |
| State | Zustand | Global app state |
| Maps | react-native-maps + OSM UrlTile | Free map tiles, no billing |
| Payments | Stripe (web link, placeholder) | Subscription gating |
| Affiliate | GetYourGuide deep-links | Tour upsell revenue |
| Open Data | Open Data BCN CKAN API | Bicibox / Bicipark parking |

---

## Repository Layout

```
/
├── CLAUDE.md                        ← this file
├── firebase/
│   ├── schema/                      ← Firestore collection schemas (JSON)
│   ├── seed/seed_data.json          ← Sample documents for seeding
│   └── firestore.rules              ← Security rules
├── api/open_data_bcn.json           ← CKAN API config reference
├── docs/
│   ├── flutterflow_setup.md
│   └── radar_setup.md
└── expo-app/                        ← React Native app (source of truth)
    ├── app.config.js                ← Dynamic Expo config (reads env vars)
    ├── app.json                     ← Static fallback config
    ├── .env.example                 ← Safe template — copy to .env and fill in
    ├── app/
    │   ├── _layout.tsx              ← Root layout, auth listener, geofence task import
    │   ├── index.tsx                ← Auth gate (→ map or → auth)
    │   ├── auth.tsx                 ← Anonymous + email sign-in/up
    │   └── (tabs)/
    │       ├── _layout.tsx          ← Tab bar (Map / Parking / Profile)
    │       ├── map.tsx              ← MapView + OSM tiles + LandmarkCard sheet
    │       ├── parking.tsx          ← Bicibox / Bicipark nearby list
    │       └── profile.tsx          ← Points, visited count, sign-out
    ├── src/
    │   ├── firebase/config.ts       ← Firebase init (reads EXPO_PUBLIC_* env vars)
    │   ├── store/useAppStore.ts     ← Zustand store (landmark state + parking JSON)
    │   ├── tasks/geofenceTask.ts    ← TaskManager background task (BIKE_TOUR_GEOFENCE)
    │   ├── hooks/useGeofencing.ts   ← Permission requests + startGeofencingAsync
    │   ├── utils/parkingFilter.ts   ← Haversine filter + sort (TypeScript)
    │   └── components/
    │       ├── LandmarkCard.tsx     ← Full card: chip, regulatory banner, quiz, FAQs
    │       └── ParkingCard.tsx      ← Type badge, name, distance, instruction
    └── constants/rules.ts           ← Domain constants (radii, fines, API URLs)
```

---

## Firebase Collections

1. **`locations`** — landmarks, POIs, geofence triggers
   - Key fields: `slug` (string, unique), `name`, `short_description`, `category`, `coordinates` (GeoPoint), `is_active` (bool), `geofence_radius_metres`, `regulatory_alert` (map), `audio_url`, `getyourguide_affiliate_url`
2. **`quizzes`** — per-landmark MCQ: `location_slug`, `question`, `options[]`, `correct_option_index`, `explanation`, `points_reward`, `is_active`
3. **`faqs`** — per-landmark FAQs: `location_slug`, `question`, `answer`, `is_premium`, `sort_order`, `is_active`
4. **`logistics`** — parking/rules reference data
5. **`users`** — `total_points` (int), `visited_location_slugs[]`, `completed_quiz_ids[]`, `subscription_status` ('free'|'active')

Full schemas in `firebase/schema/`.

---

## Key Domain Rules (encode in every feature)

- Geofence radius: **40 metres** (override per-location via `geofence_radius_metres`)
- Sidewalk riding fine: **€500** (high-priority regulatory alert)
- Earphone (both ears) fine: **€100**
- Gothic Quarter: `category = dismount_zone` — notify on entry
- Bicibox: requires PIN lookup via app; Bicipark: open rack
- `regulatory_alert` map on a location → `isRegulatory = true` regardless of category

---

## Environment Variables

All secrets live in `expo-app/.env` (gitignored). Copy `.env.example` to get started:

```
EXPO_PUBLIC_FIREBASE_API_KEY
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN
EXPO_PUBLIC_FIREBASE_PROJECT_ID
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
EXPO_PUBLIC_FIREBASE_APP_ID
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
```

`EXPO_PUBLIC_*` vars are inlined at build time and visible in the bundle — this is acceptable for Firebase client config (access controlled by Firestore Security Rules). Restrict the Maps API key in Google Cloud Console by package name / bundle ID.

---

## Development Commands

```bash
cd expo-app
npm install --legacy-peer-deps   # first time (peer dep conflict with RN 0.76 vs screens 4.x)
npx expo start                   # Metro bundler → scan QR with Expo Go
npx tsc --noEmit                 # type check (must pass before every commit)
```

For a native build:
```bash
npx expo run:android             # needs Android Studio + AVD or connected device
npx expo run:ios                 # needs Xcode (Mac only)
```

---

## External Distribution Policy (fixed — do NOT change or reinvent)

This project ships Android and iOS differently. There is NO Apple Developer account — never attempt an iOS standalone build, signing, or TestFlight.

- **Android** → a standalone **APK** that users install from a **direct download link** (produced by `eas build`, internal distribution). NOT the Play Store.
- **iOS** → **Expo Go**, opened via a **QR code** or the **EAS Update link** from the Expo account. JS updates only.

**How to ship depends on WHAT changed — decide and state it before publishing:**
- **JS / assets / layout only** (no new native module, no permission or app.config native change, no SDK bump): publish over-the-air with `eas update` to the project's existing channel (the one the `android/stable` build and `ios/stable-expo-go` point at). This reaches BOTH the installed Android APK (OTA) and iOS Expo Go (via the QR / update link). No reinstall.
- **Any NATIVE change** (new native dependency, new permission, `UIBackgroundModes`/Info.plist/Android manifest/config-plugin change, Expo SDK bump): OTA is NOT enough and can CRASH the installed Android APK. You MUST run a **new `eas build` for Android** and provide a **new APK link** (users reinstall). iOS Expo Go cannot run native changes at all — note this; those only work in a real build, which we don't do for iOS.

**Before distributing, confirm and state:** "JS-only → OTA" vs "native changed → rebuild Android". Ensure the `eas update` targets the correct channel and a **matching runtimeVersion** (a mismatch means the update is silently ignored and never reaches devices).

**Hand back to the user:**
- **Android:** the APK install link — and say clearly whether it's an OTA update to the existing app or a NEW APK that requires reinstall.
- **iOS:** the **QR code** and/or **Expo Go update link** to open.
- A one-line summary: what was published, to which channel, and the runtimeVersion.

---

## Development Conventions

- Branch for all work: `claude/elegant-shannon-Ybnzo`
- Run `npx tsc --noEmit` before every commit — must report 0 errors
- `TaskManager.defineTask(GEOFENCE_TASK, ...)` must stay at module top-level in `geofenceTask.ts` — moving it inside a function breaks background execution
- Never commit `.env`; never hardcode API keys — use `process.env.EXPO_PUBLIC_*`
- Firebase Security Rules must deny unauthenticated writes everywhere except `users` (own doc only)
- Firestore writes from the client use `set(..., { merge: true })` + `arrayUnion` / `increment` — no Cloud Functions needed for point tallying

---

## How Claude Code Should Operate

- Read this file at the start of every session to reload project context.
- Run `npx tsc --noEmit` after any code change before committing.
- Never invent API keys — read them from `process.env.EXPO_PUBLIC_*`.
- Produce copy-paste-ready deliverables, not explanations of what to do.
