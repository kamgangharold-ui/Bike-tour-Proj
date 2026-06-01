# Radar.io Setup Guide

## 1. Radar Dashboard — Create an App

1. Sign in at [radar.com](https://radar.com) → **Development** project.
2. Copy the **Publishable Key** (starts with `prj_live_pk_...`).
3. In FlutterFlow: **Settings → Environment Variables → Add** `FF_RADAR_PUBLISHABLE_KEY` = your key.

---

## 2. Create Geofences in Radar (mirrors Firestore `locations`)

Geofences must exist in Radar *before* the SDK can detect them. For each active document in your `locations` Firestore collection, create a matching Radar geofence:

| Radar field | Value from Firestore |
|---|---|
| **Tag** | `locations.slug` (e.g. `sagrada-familia`) |
| **External ID** | same as Tag |
| **Description** | `locations.short_description` (≤ 160 chars — becomes notification body) |
| **Geometry** | Circle centred on `locations.coordinates`, radius = `locations.geofence_radius_metres` (40 m standard, 100 m dismount zones) |
| **Metadata → category** | `locations.category` (drives `isRegulatory` flag in Dart) |

**Option A — Radar Dashboard (manual, good for < 20 locations):**
Radar Dashboard → **Geofences → Import** → upload a CSV with the columns above.

**Option B — Radar REST API (bulk / automated):**
```bash
curl -X POST "https://api.radar.io/v1/geofences" \
  -H "Authorization: YOUR_SECRET_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Sagrada Família",
    "tag": "sagrada-familia",
    "externalId": "sagrada-familia",
    "type": "circle",
    "coordinates": [2.1744, 41.4036],
    "radius": 40,
    "metadata": { "category": "landmark" }
  }'
```
> Note: Radar uses **[longitude, latitude]** order in REST calls (GeoJSON standard), opposite of Firestore.

---

## 3. iOS — Info.plist Strings

Add the following keys inside `<dict>` in `ios/Runner/Info.plist`:

```xml
<!-- Required for foreground location -->
<key>NSLocationWhenInUseUsageDescription</key>
<string>Barcelona Bike Tour uses your location to alert you when you're near a landmark or cycling restriction.</string>

<!-- Required for background / always-on tracking -->
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>Barcelona Bike Tour tracks your location in the background to send you hands-free landmark alerts while you ride.</string>

<!-- Background modes for Radar always-on tracking -->
<key>UIBackgroundModes</key>
<array>
  <string>location</string>
  <string>fetch</string>
  <string>remote-notification</string>
</array>

<!-- flutter_local_notifications: allow full-screen alerts -->
<key>UIUserNotificationSettings</key>
<dict/>
```

---

## 4. Android — AndroidManifest.xml Permissions

Add inside `<manifest>` (above `<application>`):

```xml
<!-- Location -->
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />

<!-- Notifications (Android 13+) -->
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />

<!-- Full-screen intent (regulatory alerts over lock screen) -->
<uses-permission android:name="android.permission.USE_FULL_SCREEN_INTENT" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />
```

Inside `<application>`:

```xml
<!-- Radar foreground service (required for always-on tracking) -->
<service
    android:name="io.radar.sdk.RadarForegroundService"
    android:foregroundServiceType="location"
    android:exported="false" />

<!-- flutter_local_notifications full-screen intent receiver -->
<receiver
    android:name="com.dexterous.flutterlocalnotifications.ScheduledNotificationBootReceiver"
    android:exported="false">
  <intent-filter>
    <action android:name="android.intent.action.BOOT_COMPLETED"/>
    <action android:name="android.intent.action.MY_PACKAGE_REPLACED"/>
  </intent-filter>
</receiver>
```

---

## 5. FlutterFlow — Add Packages

> Radar.io replaced with custom geolocator engine (no account needed).

In FlutterFlow → Settings ⚙️ → **Project Dependencies** → Pub Dependencies:

```yaml
geolocator: ^13.0.2
flutter_local_notifications: ^17.2.2
```

---

## 6. FlutterFlow — Wire Up Actions

| Trigger | Action | Notes |
|---|---|---|
| App launch / `initState` | `initializeRadar` | Runs once; requests location permissions |
| After `initializeRadar` | `startGeofencing` | Registers Radar event listener + starts tracking |
| From any UI button | `showLocalNotification(title, body, isHighPriority)` | Manual trigger for testing |

**Recommended action chain on app start:**
```
initializeRadar → (on success) → startGeofencing
```

---

## 7. Testing Geofences Locally

Use the **Radar Test Toolkit** (dashboard → **Simulate**) to mock a device entering a geofence without physically moving:

1. Dashboard → **Users → [your test user ID]** → **Simulate Event**.
2. Select **Entered Geofence** → pick any geofence tag.
3. The `_onGeofenceEvent` callback in `start_geofencing.dart` should fire and a local notification should appear.
