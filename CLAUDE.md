# Barcelona Bike Tour — Digital Guide App

## Project Mission
A location-aware digital tour guide for cyclists in Barcelona. When a rider enters a 40-metre radius of a landmark, the app fires a local notification, surfaces contextual FAQs, quizzes, regulatory warnings (fines, dismount zones), and parking locators — all hands-free.

---

## Tech Stack

| Layer | Tool | Purpose |
|---|---|---|
| Frontend | FlutterFlow (native compile) | UI, page routing, state management |
| Backend | Firebase Firestore (NoSQL) | All app data |
| Auth | Firebase Authentication | Anonymous + email sign-in |
| Geofencing | Radar.io SDK | Always-On background GPS, 40 m geofences |
| Notifications | Flutter Local Notifications | Triggered on geofence breach |
| Payments | Stripe (web-to-app) | Subscription gating |
| Affiliate | GetYourGuide deep-links | Tour upsell revenue |
| Open Data | Open Data BCN CKAN API | Bike lanes, architecture data |

---

## Project Phases (execute one at a time, stop for approval)

| # | Task | Status |
|---|---|---|
| 1 | Firebase Firestore schema | ✅ Done |
| 2 | Radar.io geofencing + Dart custom actions | ✅ Done |
| 3 | FlutterFlow state management + conditional UI | ✅ Done |
| 4 | Open Data BCN API configuration | ✅ Done |
| 5 | Regulatory alerts geofence logic | ✅ Done |

---

## Repository Layout

```
/
├── CLAUDE.md                   ← this file (Claude reads it every session)
├── firebase/
│   ├── schema/
│   │   ├── locations.json      ← Firestore collection schema
│   │   ├── quizzes.json
│   │   ├── faqs.json
│   │   ├── logistics.json
│   │   └── users.json
│   ├── seed/
│   │   └── seed_data.json      ← Sample documents for local testing
│   └── firestore.rules         ← Security rules
├── flutter/
│   ├── custom_actions/
│   │   ├── initialize_radar.dart
│   │   ├── start_geofencing.dart
│   │   └── show_local_notification.dart
│   └── custom_widgets/
│       └── landmark_card.dart
├── api/
│   └── open_data_bcn.json      ← FlutterFlow API call config
└── docs/
    ├── flutterflow_setup.md    ← Step-by-step FF config instructions
    └── radar_setup.md          ← Radar dashboard + plist/manifest strings
```

---

## Firebase Collections (Task 1 — Completed)

### Core Rules
- All `GeoPoint` fields use Firestore native `GeoPoint` type (lat/lng pair).
- All `Timestamp` fields use Firestore native `Timestamp`.
- Arrays of maps are stored as `Array<Map>`.
- Document IDs are auto-generated unless stated otherwise.

### Collections
1. **`locations`** — landmarks, POIs, geofence triggers
2. **`quizzes`** — per-landmark quiz questions
3. **`faqs`** — predictive FAQ cards shown near a landmark
4. **`logistics`** — parking spots (Bicibox/Bicipark), rules, fine schedules
5. **`users`** — rider profiles, progress, subscription status

Full schemas live in `firebase/schema/`.

---

## Key Domain Rules (encode in every feature)

- Geofence radius: **40 metres** (Radar.io `RadarTrackingOptions`)
- Sidewalk riding fine: **€500** (show as high-priority alert)
- Earphone (both ears) fine: **€100**
- Gothic Quarter: **dismount zone** — push notification on entry
- Parking: Bicibox requires app PIN code lookup; Bicipark is open-rack

---

## Development Conventions

- All Dart custom actions go in `flutter/custom_actions/` before pasting into FlutterFlow.
- Every Dart file must compile standalone (`dart analyze` passes).
- Firebase Security Rules must deny unauthenticated writes everywhere except `users` (own doc only).
- API calls use `https` only; no plain-text keys in source files — use FlutterFlow Environment Variables.
- Branch for all work: `claude/elegant-shannon-Ybnzo`

---

## How Claude Code Should Operate

- Read this file at the start of every session to reload project context.
- Execute **one numbered task** at a time, then stop and ask for approval.
- Produce **copy-paste-ready deliverables**: JSON schemas, Dart code, XML snippets, API configs — not explanations of what to do.
- When writing Dart for FlutterFlow Custom Actions, wrap the core logic in a `Future<void>` named exactly as the action name in camelCase (e.g., `initializeRadar`).
- Never invent API keys — leave placeholders like `YOUR_RADAR_PUBLISHABLE_KEY`.
