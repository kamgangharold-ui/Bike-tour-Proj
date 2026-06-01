# FlutterFlow Wiring Guide — Phases B through F
# Copy-paste ready. Execute top to bottom.

---

## PHASE B — Packages

> Radar.io replaced with custom geolocator engine. No external account needed.

### B1. Add Packages in FlutterFlow (YOU DO THIS)
FlutterFlow → Settings ⚙️ → Project Dependencies → Pub Dependencies

Paste exactly:
```
geolocator: ^13.0.2
flutter_local_notifications: ^17.2.2
```
Click Reload. Wait for green confirmation.

---

## PHASE C — Custom Actions (6 files to paste)

In FlutterFlow → Custom Code → Custom Actions → + Add Action

### C1. Action: initializeGeofencing

**Action Name:** `initializeGeofencing`
**Return Value:** None (Future void)
**Parameters:** none

**Code to paste:**
→ Copy entire contents of `flutter/custom_actions/initialize_geofencing.dart`

---

### C2. Action: startGeofencing

**Action Name:** `startGeofencing`
**Return Value:** None (Future void)
**Parameters:** none

**Code to paste** (full file content):
→ Copy entire contents of `flutter/custom_actions/start_geofencing.dart`

---

### C3. Action: showLocalNotification

**Action Name:** `showLocalNotification`
**Return Value:** None (Future void)
**Parameters:** (add these 3 in FlutterFlow before pasting code)

| Parameter Name | Type |
|---|---|
| `title` | String |
| `body` | String |
| `isHighPriority` | Boolean |

**Code to paste:**
→ Copy entire contents of `flutter/custom_actions/show_local_notification.dart`

---

### C4. Action: getCurrentLocation

**Action Name:** `getCurrentLocation`
**Return Value:** `List<double>`
**Parameters:** none

**Code to paste:**
→ Copy entire contents of `flutter/custom_actions/get_current_location.dart`

---

### C5. Action: filterParkingByDistance

**Action Name:** `filterParkingByDistance`
**Return Value:** `String`
**Parameters:** (add these 4 in FlutterFlow before pasting code)

| Parameter Name | Type |
|---|---|
| `stationsJson` | String |
| `userLatitude` | Double |
| `userLongitude` | Double |
| `radiusMetres` | Double |

**Code to paste:**
→ Copy entire contents of `flutter/custom_actions/filter_parking_by_distance.dart`

---

### C6. Custom File: registerGeofencingCallback

This is a Custom File (not a Custom Action).
FlutterFlow → Custom Code → Custom Files → + Add File

**File Name:** `register_geofencing_callback`

**Code to paste:**
→ Copy entire contents of `flutter/custom_actions/register_geofencing_callback.dart`

> Important: Replace the import path on line 2:
> `import 'package:your_app/flutter_flow/flutter_flow_util.dart';`
> FlutterFlow will auto-resolve this — leave it as-is and let FF handle the import.

---

## PHASE D — Custom Widget

FlutterFlow → Custom Code → Custom Widgets → + Add Widget

**Widget Name:** `LandmarkCard`
**Width:** `double.infinity`
**Height:** `400`

**Parameters to add** (add all before pasting code):

| Parameter Name | Type | Default |
|---|---|---|
| `landmarkName` | String | `""` |
| `description` | String | `""` |
| `category` | String | `""` |
| `isRegulatory` | Boolean | `false` |
| `regulatoryMessage` | String | `""` |
| `regulatoryFineEur` | Double | `0` |
| `audioUrl` | String | `""` |
| `affiliateUrl` | String | `""` |
| `isVisited` | Boolean | `false` |
| `isSubscribed` | Boolean | `false` |
| `quizQuestion` | String | `""` |
| `quizOptions` | List (String) | `[]` |
| `quizCorrectIndex` | Integer | `0` |
| `quizExplanation` | String | `""` |
| `quizPoints` | Integer | `10` |
| `quizAlreadyCompleted` | Boolean | `false` |
| `faqQuestions` | List (String) | `[]` |
| `faqAnswers` | List (String) | `[]` |
| `faqIsPremium` | List (Boolean) | `[]` |

**Code to paste:**
→ Copy entire contents of `flutter/custom_widgets/landmark_card.dart`

---

## PHASE E — App State Variables

FlutterFlow → App State → + Add Field

Add each row below:

| Field Name | Type | Persisted | Initial Value |
|---|---|---|---|
| `activeLocationSlug` | String | No | `""` |
| `activeLocationName` | String | No | `""` |
| `activeLocationDescription` | String | No | `""` |
| `activeLocationCategory` | String | No | `""` |
| `activeLocationIsRegulatory` | Boolean | No | `false` |
| `activeLocationRegulatoryMessage` | String | No | `""` |
| `activeLocationRegulatoryFineEur` | Double | No | `0` |
| `activeLocationAffiliateUrl` | String | No | `""` |
| `activeLocationAudioUrl` | String | No | `""` |
| `isSubscribed` | Boolean | No | `false` |
| `biciboxStationsJson` | String | No | `""` |
| `biciparkStationsJson` | String | No | `""` |

**"Persisted: No"** means the value resets when the app closes — correct for live geofence state.

---

## PHASE F — Firestore Collections in FlutterFlow

FlutterFlow → Firestore → + Add Collection

### F1. Collection: locations

**Collection Path:** `locations`

Add these fields:

| Field Name | Type |
|---|---|
| `name` | String |
| `slug` | String |
| `category` | String |
| `coordinates` | LatLng |
| `geofence_radius_metres` | Integer |
| `short_description` | String |
| `long_description` | String |
| `audio_url` | String |
| `image_urls` | List (String) |
| `getyourguide_affiliate_url` | String |
| `regulatory_alert` | Map |
| `tags` | List (String) |
| `is_active` | Boolean |
| `created_at` | Timestamp |
| `updated_at` | Timestamp |

---

### F2. Collection: quizzes

**Collection Path:** `quizzes`

| Field Name | Type |
|---|---|
| `location_slug` | String |
| `question` | String |
| `options` | List (String) |
| `correct_option_index` | Integer |
| `explanation` | String |
| `difficulty` | String |
| `points_reward` | Integer |
| `is_active` | Boolean |
| `created_at` | Timestamp |

---

### F3. Collection: faqs

**Collection Path:** `faqs`

| Field Name | Type |
|---|---|
| `location_slug` | String |
| `question` | String |
| `answer` | String |
| `category` | String |
| `sort_order` | Integer |
| `is_premium` | Boolean |
| `is_active` | Boolean |
| `created_at` | Timestamp |

---

### F4. Collection: logistics

**Collection Path:** `logistics`

| Field Name | Type |
|---|---|
| `type` | String |
| `name` | String |
| `coordinates` | LatLng |
| `address` | String |
| `details` | Map |
| `opening_hours` | String |
| `nearby_location_slugs` | List (String) |
| `is_active` | Boolean |
| `created_at` | Timestamp |
| `updated_at` | Timestamp |

---

### F5. Collection: users

**Collection Path:** `users`

| Field Name | Type |
|---|---|
| `uid` | String |
| `display_name` | String |
| `email` | String |
| `auth_provider` | String |
| `subscription_status` | String |
| `subscription_expires_at` | Timestamp |
| `total_points` | Integer |
| `visited_location_slugs` | List (String) |
| `completed_quiz_ids` | List (String) |
| `preferred_language` | String |
| `push_notifications_enabled` | Boolean |
| `fcm_token` | String |
| `created_at` | Timestamp |
| `last_active_at` | Timestamp |

---

## STARTUP ACTION CHAIN (wires everything together)

In FlutterFlow, on your main/home page → On Page Load action chain:

```
1. initializeGeofencing()
2. [on success] startGeofencing()
3. [on success] registerGeofencingCallback()
```

> No Radar.io dashboard needed. Geofences load automatically from your
> Firestore `locations` collection on every app start.

Set this chain on the page that loads immediately after sign-in.
