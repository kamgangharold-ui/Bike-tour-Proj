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

---

## Phase 2 — Drop 1 (map voice command & control + turn-by-turn)

| Feature | iOS | Android | Status | Notes |
|---|---|---|---|---|
| Shared STT pipeline (`useVoiceChat`) | ✅ | ✅ | **Parity** | One hook for chat + map; per-platform codec (AMR_WB/LINEAR16) preserved. |
| Map tap-to-talk (MicButton) | ✅ | ✅ | **Parity** | Big rideActive-gated button; pulse + barge-in; `Vibration` start cue + on mute (iOS ignores the duration arg — still buzzes). |
| Silence auto-stop (~1.5 s) + 8 s cap | ✅ | ✅ (fixed) | **Parity** | Android metering uses a natural-log scale — normalized to dBFS so the threshold matches iOS. Tune on-device if needed; 8 s cap is the backstop. |
| Hybrid command router | ✅ | ✅ | **Parity** | Per-locale keyword fast-path (word-boundary matched), else Claude `{intent,params,spoken_reply}`. Commands are network-free; only Q&A/ambiguous calls Claude. |
| Intents: navigate / reroute / skip / parking / status / repeat / mute / slower / louder / end | ✅ | ✅ | **Parity** | Reuse the route pipeline, store actions, `parkingService`. navigate = ranked landmark match → geocode fallback. |
| Turn-by-turn maneuvers (spoken) | ✅ | ✅ | **Parity** | OSRM `steps=true`; cue once at ~150 m + a turn banner. **Maneuver phrasing is English in Drop 1** (locale-ready); the conversational layer (STT + answers + confirmations) is fully localized. |
| Off-route → reroute | ✅ | ✅ | **Parity** | Recalculates after 3 off-route readings. |
| Multilingual STT + TTS (EN/ES/CA/FR/DE/IT) | ✅ | ✅ | **Parity** | Device-locale default + Settings picker (BCP-47). Catalan TTS falls back to Spanish when no voice is installed. |
| Voice-language Settings picker | ✅ | ✅ | **Parity** | Chips in Settings → Voice & guidance. |
| Wake word | ⚠️ | ⚠️ | **Deferred** | `startListening()` entry exposed; engine (Picovoice) is a dev-build follow-up. |

**Known Drop-1 scope note:** turn-by-turn *maneuver* phrasing ("Turn left onto…") is English regardless of locale (the instruction builder accepts a locale for a later pass); everything conversational is in the selected language.

---

## Phase 2 — Drop 1 FIX PACK (post-iPhone-test)

| Item | iOS | Android | Status | Notes |
|---|---|---|---|---|
| Mic always available (no ride needed) | ✅ | ✅ | **Fixed** | Bottom-right, above the two map controls (tracks their position); never over the logos. navigate auto-starts a free ride. |
| Duplicate landmarks (list + markers) | ✅ | ✅ | **Fixed** | Client dedupes by slug before list + markers; ride list keys by doc.id (kills `.$barceloneta`). Data: idempotent seed + `dedupe-locations.js` (run once). |
| Correct destination + spoken confirm | ✅ | ✅ | **Fixed** | Accent-insensitive similarity match; ≥0.6 routes, 0.4–0.6 asks "Did you mean X?" (auto-arms mic for the yes/no), else region-biased geocode. Always speaks "Heading to X, 1.2 km". |
| Works outside Barcelona; never silent | ✅ | ✅ | **Fixed** | Location watcher: 8 s timeout + last-known fallback + spoken error; no city gate. Prompt: assistant always has GPS. Dev lat/lng override (DEV-only, not persisted). |
| Chat → navigation handoff | ✅ | ✅ | **Fixed** | "guide me to X" in BikAI starts real turn-by-turn on the map (deferred until landmarks load). |
| Active-tour navigate guard | ✅ | ✅ | **By design** | Saying "take me to X" during a curated tour asks you to finish the tour first (no silent hijack / invisible route). |
| Tactile cues (mic start / mute) | ✅ | ✅ | **Fixed** | Android `VIBRATE` permission now declared (native → APK rebuild at deploy). |
| Dev location override leak guard | ✅ | ✅ | **Fixed** | `__DEV__`-only + not persisted — cannot ship an override. |

## Phase 2 — Drop 1 FIX PACK round 2 (post on-device)

| Item | iOS | Android | Status | Notes |
|---|---|---|---|---|
| Route clears on End; no inheritance | ✅ | ✅ | **Fixed** | Ride/nav end clears route geometry + maneuver steps + next-turn + destination + polyline (single source of truth); tour route auto-clears. A → End → B shows only B. |
| "Where am I" answers anywhere | ✅ | ✅ | **Fixed** | Split `where_am_i` from route `status`: reverse-geocodes live GPS ("You're at …"), coordinate fallback if unnamed, no route or city needed. Route questions with no route → graceful "say take me to…". |
| Reply in the user's language | ✅ | ✅ | **Fixed** | Typed → Claude replies in the message's language; TTS voice from the reply. Voice → Settings language drives STT + reply + TTS. No English lock anywhere. |
| BikAI "Near {landmark}" chip | removed | removed | **Fixed** | Header context pill removed. |
| BikAI input bar polish | ✅ | ✅ | **Fixed** | Aligned 42px mic + rounded field + send, even padding, hairline borders, "Message BikAI…" placeholder. |
