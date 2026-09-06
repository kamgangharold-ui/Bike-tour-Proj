# Barcelona CycleGuide — Working Session History (Chat Log)

**Date:** 6 June 2026
**Author / Owner:** Harold Kamgang
**AI partner:** Claude Code (Anthropic)
**Purpose of this file:** A durable backup of this working session so the history is never lost if the conversation is deleted or the account changes. It records the requests, decisions, prompts, bugs, fixes, current state, and deliverables.

---

## 0 · How this session worked (the workflow)

Development happens through a **"prompt-to-terminal" workflow**:
- **Web Claude (this chat)** drafts precise prompts, reasons about architecture/bugs, and produces deliverables.
- **Harold** pastes those prompts into a **local terminal Claude Code** (PowerShell on Windows, path `C:\Users\OEM\bike-tour-proj\expo-app`) which holds the real codebase and does the implementation.
- Harold tests on real **iPhone + Android** over a **Metro tunnel (Expo Go)** and reports back with screenshots.

> Note: the web session's clone of the repo is empty/detached, so this file is committed locally in the web session and sent to Harold for safekeeping; it should also be added to the real repo from the terminal.

---

## 1 · Project snapshot

- **App:** Barcelona CycleGuide — a location-aware, voice-first cycling tour guide for Barcelona.
- **Stack:** React Native 0.81 · Expo SDK 54 · Expo Router v6 · Zustand · Firebase Firestore + Auth · react-native-maps (Google Maps on Android, Apple Maps on iOS).
- **Cloud services:** Anthropic Claude (BikAI + voice command router, via direct REST `fetch`), Expo Location, OSRM routing (cycling), Barcelona Open Data (Bicing/Bicibox parking), Google Speech-to-Text, expo-speech (TTS), EAS Build/Update.
- **App ID:** com.biketourguide.app
- **Repo:** kamgangharold-ui/bike-tour-proj
- **Branches seen this session:** `claude/elegant-shannon-Ybnzo` (GitHub default / source-of-truth), `feature/safe-routing-recap-offline-settings` (recent dev line), `feature/voice-mvp-and-parity` (the voice work), `claude/gracious-mendel-LAgIe` (web-session branch).

---

## 2 · Locked decisions (from this session)

| Decision | Choice |
|---|---|
| Mic activation | **Both** — big tap-to-talk button now (Expo Go), wake word later (dev build) |
| Voice scope | **Full command & control** (navigate / reroute / parking / end-ride + Q&A) |
| Intent routing | **Hybrid** — fast local keyword match for commands, Claude for the rest |
| Language model | **Auto device locale + manual picker** (6 languages), proper BCP-47 codes |
| Delivery | **Stage A then B** (Drop 1 voice, validate, then Drop 2 notifications) |
| Mic on map | **Always visible** (not gated to an active ride), bottom-right above the 2 map buttons |
| Visited rule | A landmark counts as "visited" within **100 m** |
| CEO doc — hours | **Journey written by AI, hours filled in by Harold** (no fabricated numbers) |
| CEO doc — recipient | **Falk Siegel / Pink Ducks** |
| CEO doc — framing | **Pink Ducks companion product** |

---

## 3 · Chronological log of this session

1. **Voice MVP defined as the centrepiece.** Built a dedicated branch off the up-to-date dev line (not the stale voice branch). Feature A = voice command & control + turn-by-turn; Feature B = real-time notifications.
2. **Drop 1 built** (Groups E/F/G): shared voice pipeline extracted (`anthropic.ts`, `systemPrompt.ts`, `useVoiceChat.ts`), OSRM turn-by-turn steps + spoken cues, map tap-to-talk + hybrid command router, app-locale + language picker.
3. **Drop 1 Fix Pack (round 1, FIX 1–5):** mic always-on + reposition; dedupe landmarks (client + Firestore) — 17 dupes removed, quizzes 71→31, faqs 90→51, upsert-by-slug; accurate destination resolve + spoken confirm; works-everywhere (no Barcelona gate) + never silent; chat↔nav handoff.
4. **Fix Pack round 2 (FIX 6–10):** clear route on End / new ride; "where am I" works with no route; reply in the user's language (kill English lock); remove "Near {landmark}" chip; redesign BikAI input bar.
5. **Branch reconciliation + SHIP & SYNC:** found two competing "source-of-truth" branches; added the **SHIP & SYNC** standing rule to CLAUDE.md (commit → push → publish both platforms from the same commit → release manifest), and the rule to never let GitHub drift behind the deployed app.
6. **Fix Pack round 3 (FIX 11–15):** restore TTS (audio-session/silent-mode fix); multilingual + accurate STT; system/background notifications; professional input bar; tapping "Rides" opens ride-history screen.
7. **Fix Pack round 4 (FIX 16–21) + dev-build split:** Google STT audio-format fix; "Get directions" launches a ride; remove duplicate inline ride history; populate "Visited" (100 m rule); really redesign input bar; reliable TTS. Decided background features → **Android dev client**.
8. **The STT debugging saga** (see section 4) — resolved iteratively via an on-screen VoiceDebug overlay.
9. **App localization** confirmed working (218 translation keys at parity across 6 languages, one control drives UI + voice).
10. **Documentation deliverables** produced (CEO handover + updated personal doc) in the Pink Ducks template format.
11. **Final fix pack + ship prompt** drafted (STT `auto`→LINEAR16, turn-by-turn in notifications + arrows, background voice, lightweight how-to guide, conclude & ship, output final links) + an **all-in-one WhatsApp install message**.

---

## 4 · The voice / STT debugging saga (the hard one)

The voice MVP went through several failure→fix cycles. Captured here because it cost the most time:

1. **Original crash:** `Audio.setAudioModeAsync({ staysActiveInBackground: true })` at startup crashed Expo Go (needs native entitlements absent in Expo Go). The whole voice layer was ripped out, then re-added **guarded** so background-audio is only enabled in a dev build (`Constants.appOwnership !== 'expo'`).
2. **TTS silent:** after recording, iOS routed audio to the quiet earpiece, and silent-mode muted speech. Fix: switch the audio session between **listen** and **speak** modes and set `playsInSilentModeIOS: true`.
3. **expo-av deprecated on SDK 54** (Metro warning). Plan: migrate the audio layer to **expo-audio**.
4. **STT `bad encoding` — phase 1:** the request used an invalid `encoding` (e.g. `"WAV"`). Google has no "WAV" encoding; PCM is `LINEAR16`.
5. **STT `bad encoding` — phase 2:** the recording was **not actually LINEAR16 PCM** — `dur:0ms` with bytes present = an invalid/mislabelled file. Fix: explicit iOS RecordingOptions (LINEAR PCM, 16 kHz, mono, 16-bit), verified by the **RIFF/WAVE** file-header check.
6. **STT `bad encoding` — phase 3 (final root cause):** recording became genuine (`file head "RIFF…WAVE"`, rate 16000, ch 1, bits 16, `dur:4946ms`), but the request logged `STT → en-US auto@?` → the header parser read `fmt:0` (should be 1=PCM) and fell back to **`encoding: 'auto'`**, which is **not a valid Google STT enum** → "bad encoding".
   **Fix (pending validation):** never send `'auto'`; send `encoding: 'LINEAR16'`, `sampleRateHertz: 16000`, `audioChannelCount: 1` explicitly (don't trust the parsed `fmt`); most robust — strip the WAV header and send raw PCM.

**Diagnostic tool that cracked it:** an on-screen **VoiceDebug overlay** with Speak/Record test buttons, logging each step (permission → audio session → record → file head → STT request → result), because Metro showed no error (silent failures).

---

## 5 · Bugs found & fixed this session

| Area | Problem | Fix |
|---|---|---|
| Voice | Crash on background-audio in Expo Go | Guard `staysActiveInBackground` to dev build only |
| Voice/TTS | No sound after recording / on silent | Listen↔speak audio mode + `playsInSilentModeIOS` |
| Voice/STT | "bad encoding" (3 phases) | LINEAR16/16000/mono explicit; valid RIFF WAV; drop `'auto'` |
| Mic | Hidden until a ride started | Always visible on the map |
| Mic | Wrong placement | Bottom-right, above the 2 map buttons |
| Nav | Wrong destination | Fuzzy match + region-biased geocode + spoken confirm |
| Nav | Route line persisted after End | Clear route state on End and on new ride |
| Location | Broke outside Barcelona / "no route active" for "where am I" | Live GPS everywhere; decouple location from route |
| Data | Duplicate landmarks (triple pins) | Client dedupe + Firestore cleanup (17 removed) + upsert-by-slug |
| AI | Locked to English | Reply in the user's language |
| UI | "Near {landmark}" chip, plain input bar | Removed chip; redesigned input bar |
| Profile | Inline ride history | Move to its own screen via the "Rides" stat; remove inline list |
| Notifications | Only in-app; duplicate "Ride complete"; deprecated API | System notifications need dev build; keep one (white) notification; `shouldShowBanner`/`shouldShowList` |
| Parking | Bicing API blocked (HTML) | Degrade gracefully ("none nearby") |
| Misc | Debug "insect" icon | Removed (became a subtle STT chip) |

---

## 6 · Features added this session

- **Guided Ride + turn-by-turn navigation** (OSRM cycling, spoken maneuvers, off-route reroute, regulatory warnings e.g. Gothic Quarter €500).
- **Voice MVP:** tap-to-talk on the map, voice OUTPUT (TTS) + voice INPUT (STT), **hybrid command router** (local keywords + Claude JSON intent), command-and-control (navigate / reroute / skip-stop / find-parking / status / repeat / mute / louder-slower / end-ride / answer), barge-in, multilingual.
- **Full app localization** — 6 languages (EN/ES/CA/FR/DE/IT), one setting drives UI + voice + AI replies.
- **Real-time notifications** — event taxonomy (ride start/approach/turn/off-route/complete), in-app + system, de-duplicated.
- **Daily AI location generator** — scheduled GitHub Actions job proposes validated new landmarks (Barcelona-bounds checked, upsert-by-slug, human review by default).
- **Distribution discipline** — SHIP & SYNC rule; Expo-Go-vs-dev-build separation; parity matrix.

---

## 7 · Current state (as of 6 Jun 2026)

**Working (tested on device):** map + landmark pins, geofencing, landmark cards, quiz, FAQ, BikAI multilingual chat, guided ride + turn-by-turn with regulatory warnings, parking, gamification, full app localization, TTS voice output, valid voice recording, in-app + transient notifications, data dedupe.

**Pending:**
- STT final fix (`auto`→`LINEAR16`) — confirm a transcript on both phones.
- Turn-by-turn shown in the phone notification + directional arrows.
- Background voice (continue with screen off) — **dev build**.
- Permanent live ride notification — **dev build** (Android foreground service).
- On-device speech recognition — **dev build**.
- Lightweight in-app "How to use" guide.
- Conclude Drop 2 + Track 2; run SHIP & SYNC; output final install links.
- Subscription/Stripe (placeholder), static landmark content translation, App Store / Play Store.

**Platform reality:** Android gets the full experience via a standalone build (free). iPhone gets foreground voice + transient notifications in Expo Go; **full background voice + permanent lock-screen notification on iPhone need an Apple Developer account ($99/yr)**.

---

## 8 · Distribution & SHIP & SYNC policy

- **Android** = standalone APK (direct install link). **iOS** = Expo Go via QR (until Apple Dev).
- **JS-only change** → `eas update` (OTA) reaches both. **Native change** → rebuild Android APK; iOS gets OTA.
- Never OTA a bundle importing native modules the installed app lacks; **runtimeVersion** must match.
- **SHIP & SYNC (standing rule in CLAUDE.md):** after every validated drop → commit → push to source-of-truth → publish both platforms **from the same commit** → print a release manifest (commit, update id, runtimeVersion, APK link, iOS OTA status). GitHub must never lag behind the deployed app.

---

## 9 · Deliverables produced this session

- **BarcelonaCycleGuide_CEO_Handover.docx** — new handover for Falk Siegel (Pink Ducks framing); 7 parts, live TOC, honest limitations, journey + hours table, glossary. Pink Ducks template formatting (Tw Cen MT, navy title, blue headings, pink dividers, callout boxes).
- **BarcelonaCycleGuide_Documentation_UPDATED.docx** — the personal technical doc, restyled to Pink Ducks + a new **PART TEN** (Chapters 15–22: Guided Ride, Voice MVP, localization, notifications v2, daily generator, distribution discipline, extended journey + testing log, updated limitations/roadmap).
- **WhatsApp install message** — all-in-one Android + iPhone install steps + how-to, with link placeholders.
- **This file** — the session history backup.

---

## 10 · Appendix — the final pending prompt (for the terminal)

> Run after confirming the STT transcript appears on both phones.

- **STT:** never send `encoding:'auto'`; send `LINEAR16` + `sampleRateHertz:16000` + `audioChannelCount:1` explicitly (don't trust parsed `fmt:0`); best — strip the WAV header and send raw PCM. languageCode = selected locale.
- **Turn-by-turn in notifications:** show the live instruction in the phone notification (Google-Maps style), updating per maneuver, with a directional arrow (←/↑/→/↰/↱/U-turn) in both the in-app banner and the notification.
- **Background voice:** keep speaking when backgrounded/screen-off (guarded to dev build).
- **How-to guide:** lightweight first-launch onboarding (map alerts, start a ride, tap-to-talk, change language) + a "How to use" entry in Profile; localized.
- **Conclude & ship:** finish Drop 2 + Track 2; build a **standalone Android APK** (preview, with native config) for distribution; iPhone via Expo Go; run SHIP & SYNC; output the final links (APK URL, iOS Expo Go link + QR, EAS Update channel + runtimeVersion).

---

*End of session history — 6 June 2026.*
