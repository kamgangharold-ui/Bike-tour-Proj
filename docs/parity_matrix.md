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

## Phase 2 — FIX PACK round 3 (post on-device — voice regression + notifications + UI)

| Item | iOS | Android | Status | Notes |
|---|---|---|---|---|
| TTS audible again (FIX 11) | ✅ | ✅ | **Fixed** | New `audioSession.ts` manager: STT recording flips the session to listen-mode and back to speak-mode (`allowsRecordingIOS:false`) when the last capture ends, so playback leaves the earpiece; `playsInSilentModeIOS:true` so cues play with the ring switch on silent. `speak()` retries once on the default voice if a locale voice is missing. **Never** sets `staysActiveInBackground` (the original crash). Capture-counted so the two mic instances (chat+map) can't corrupt each other. |
| STT hears the selected language (FIX 12) | ✅ | ✅ | **Fixed** | iOS sends the WAV with no declared encoding (Google reads the RIFF header — `LINEAR16` was parsing the header as audio → garbage); dropped English-biasing `alternativeLanguageCodes`; English hint phrases only for the EN locale; boost 15→10. Set FR → speak FR → transcribes FR. |
| Not cut off mid-sentence (FIX 12) | ✅ | ✅ | **Fixed** | Map silence window 1.5→1.9 s + a 900 ms min-utterance guard before auto-stop can fire. |
| System notifications outside the app (FIX 13) | ✅ | ✅ | **Fixed** | `setupNotifications` verifies the grant (Android 13+ silently no-ops otherwise). Ride start posts a sticky "Ride in progress" that persists when backgrounded; ride complete posts a real system notification (`alwaysNotify`). Landmark/safety alerts post from the background geofence task. *Honest limit:* a true persistent foreground-service ongoing notification + background TTS need a dev build; iOS Expo Go can't run the background geofence. |
| BikAI input bar (FIX 14) | ✅ | ✅ | **Fixed** | Text vertically centered identically on Android (`textAlignVertical:'center'` + `includeFontPadding:false`); higher-contrast 44 px pill + matched mic/send buttons. (Prior "looks unchanged" was a stale bundle — a fresh Metro bundle now carries it.) |
| Tap "Rides" → Ride History screen (FIX 15) | ✅ | ✅ | **Fixed** | Profile "Rides" stat card is pressable → dedicated `app/ride-history.tsx` (reuses the AsyncStorage history + row → recap nav; reads live from the store so sign-out can't leak a previous account's rides). |

**Round 3 delivery:** all JS-only (no new native module / permission / app.config change) → OTA / Metro-testable in Expo Go on both platforms; no APK rebuild required for these fixes.

## Phase 2 — ROUND 4 PART 1 (Expo Go / Metro)

| Item | iOS | Android | Status | Notes |
|---|---|---|---|---|
| STT audio format correct (FIX 16) | ✅ | ✅ | **Fixed** | Encoding is **bytes-driven**: detect a `RIFF` header (`base64` starts `UklG`) → omit encoding so Google reads the WAV header; else AMR_WB+16000 (Android) or LINEAR16+16000+1ch (fallback). A `[Voice][STT]` log prints `isWav`/bytes/`languageCode`/config to confirm on-device. **Verified:** iOS already records a headerful WAV (not AAC), so forcing LINEAR16 would re-break it. `languageCode` is the selected locale, never hardcoded. |
| "Get Directions" launches navigation (FIX 17) | ✅ | ✅ | **Fixed** | The pin card button now runs the **same `doNavigate` path as the voice intent** (hoisted to component scope): starts a free ride, draws the route, begins turn-by-turn, speaks the destination, and closes the card. GPS-cold-start safe (route fetches once a fix arrives). |
| Duplicate inline ride history removed (FIX 18) | ✅ | ✅ | **Fixed** | Profile = stats (Rides tappable → Ride History screen) + Upgrade + Sign Out; the inline list is gone. |
| Visited block populated at 100 m (FIX 19) | ✅ | ✅ | **Fixed** | New `VISITED_RADIUS_METRES = 100`. A foreground sweep (with or without an active ride) persists `visited_location_slugs` (arrayUnion + merge) when within 100 m; Profile shows the count **and** a list of visited landmark names. (40 m was too tight → "seen" stayed 0.) |
| BikAI input bar redesigned (FIX 20) | ✅ | ✅ | **Fixed** | One elevated rounded **dock** (mic + growing field + filled green send with a glow), data-driven disabled state, Android text centered. Confirmed chat.tsx is the only rendered bar — prior "unchanged" was a stale bundle (reload Metro with `-c`). |
| TTS fully reliable (FIX 21) | ✅ | ✅ | **Fixed** | `Speech.speak` wrapped so a synchronous throw can't stall the queue, on top of FIX 11's speak-mode-before-speak + default-voice fallback + silent-mode playback. |

**Round 4 PART 1 delivery:** all JS-only → OTA / Metro-testable in Expo Go on both platforms. **PART 2** (Android dev client: foreground-service live nav notification + on-device STT) is native and ships only in the dev build.
