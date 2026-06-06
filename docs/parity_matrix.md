# iOS ↔ Android Parity Matrix — Barcelona CycleGuide

Branch: `feature/voice-mvp-and-parity`. Legend: ✅ works · ⚠️ platform limit (honest) · 🔧 fixed this run.
iOS ships via **Expo Go**; Android via **Expo Go (testing)** and a **standalone APK** (distribution).

| Feature | iOS | Android | Status | Notes |
|---|---|---|---|---|
| Map + landmark pins | ✅ | 🔧 | **Parity** | Android custom-view pins were blank (`tracksViewChanges={false}` at first frame). `TrackedMarker` now captures then stops tracking. |
| Tour pins / numbered / finish | ✅ | 🔧 | **Parity** | Tour + finish pins on `TrackedMarker`; re-capture on visited/target change. |
| Bicing station markers | ✅ | 🔧 | **Parity** | Same `TrackedMarker` fix. |
| Map provider | Apple Maps | Google Maps | **Parity** | `PROVIDER_GOOGLE` on Android (needs `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`), Apple Maps on iOS; falls back to `PROVIDER_DEFAULT` if key absent. |
| Live location / blue dot | ✅ | ✅ | **Parity** | `showsUserLocation`, no platform branch. |
| Auto-center on first GPS fix | 🔧 | 🔧 | **Parity** | New one-time center on real location — works **anywhere**, no Barcelona bounds gate. |
| Foreground geofence (state/active landmark) | ✅ | ✅ | **Parity** | Haversine, runs in Expo Go on both. |
| Background geofence (screen off / app backgrounded) | ⚠️ | ⚠️ | **Platform limit** | Native `startGeofencingAsync` task needs a **dev build** — not Expo Go (both platforms). |
| Geofence local notifications | ✅ | ✅ | **Parity** | Foreground in Expo Go; gated by Settings toggles. |
| Landmark card / quiz / FAQ | ✅ | ✅ | **Parity** | No platform code. |
| BikAI chat (Claude) | ✅ | ✅ | **Parity** | Direct HTTPS to Anthropic; live location context. |
| Voice INPUT (mic → STT → chat) | ✅ | ✅ | **Parity** | `expo-av` + Google STT — runs in **Expo Go on both** (no dev build, no Apple Dev acct). Now auto-sends + speaks the reply (hands-free). Needs the Google key to have **Speech-to-Text** enabled. |
| Voice OUTPUT — chat replies (foreground) | ✅ | ✅ | **Parity** | Routed through the shared voice queue. |
| Voice OUTPUT — ride cues (next-stop/directional, fg) | ✅ | ✅ | **Parity** | `useRideGuidance`, throttled. |
| Voice OUTPUT — geofence arrival/regulatory (fg) | 🔧 | ✅ | **Parity** | iOS now speaks from the foreground geofence (the native task that Android uses can't run in Expo Go); iOS-gated to avoid Android double-speak. Regulatory = `urgent` priority, can't be silenced by a chat reply. |
| Voice OUTPUT — background (screen off) | ❌ Apple Dev acct | ⚠️ dev build | **Platform limit** | iOS background audio needs `UIBackgroundModes:['audio']` + the **Apple Developer account** (we don't have it). Android background audio needs a **dev build**. Foreground TTS works on both in Expo Go. |
| Parking (Bicibox / Bicipark) | ✅ | ✅ | **Parity** | |
| Free ride + chosen destination | ✅ | ✅ | **Parity** | |
| Curated tour + multi-stop route | ✅ | ✅ | **Parity** | |
| Rule-aware routing + no-cycling warnings | ✅ | ✅ | **Parity** | Pure geometry. |
| Recap + Share | 🔧 | 🔧 | **Parity** | **Text-only, identical on both** — removed the image-snapshot path that made Android share a map image while iOS shared text; never shares a location image. |
| Ride history / profile | ✅ | ✅ | **Parity** | AsyncStorage + Firestore. |
| Settings (toggles, cache, sign-out) | ✅ | ✅ | **Parity** | |
| Offline mode + offline banner | ✅ | ✅ | **Parity** | Guarded `expo-network` (no crash on older builds). |
| OTA auto-apply on launch | n/a (Expo Go) | ✅ (APK) | **By design** | iOS receives JS via the Expo Go update link; the Android APK auto-applies OTA on launch. Matches the External Distribution Policy. |
| Native POI label tap | ⚠️ | ✅ | **Platform limit** | Apple Maps does not expose POI-label taps; Android Google Maps does. |
| Audio recording codec (STT) | LINEAR16/WAV | AMR_WB | **Parity (intentional)** | Per-platform encoding; both 16 kHz mono to Google STT. |
| Keyboard avoidance | padding | default | **Parity (intentional)** | Standard RN `Platform.select`. |

**No "works on iOS, broken on Android" rows remain unexplained.** The remaining ⚠️/❌ rows are genuine platform limits (background execution in Expo Go; iOS background audio without an Apple Developer account; Apple Maps POI taps), not bugs.
