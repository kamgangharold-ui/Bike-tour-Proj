// FlutterFlow Custom Action: registerGeofencingCallback
// Call this from MyApp initState AFTER initializeRadar() and startGeofencing().
// In FlutterFlow: Custom Code > Custom Files > paste this entire file.
//
// What this does:
//   • Wires the Radar geofence ENTRY event → FFAppState (updates the UI)
//   • Wires the Radar geofence EXIT event  → FFAppState (clears the UI)

import 'package:your_app/flutter_flow/flutter_flow_util.dart';
import 'start_geofencing.dart';

void registerGeofencingCallback() {
  // ── ENTRY: rider enters a 40 m (or 100 m) geofence ────────────────────────
  GeofencingActions.onLandmarkEntered = ({
    required String slug,
    required String name,
    required String description,
    required String category,
    required bool isRegulatory,
    required String regulatoryMessage,
    required double regulatoryFineEur,
    required String affiliateUrl,
    required String audioUrl,
  }) {
    FFAppState().update(() {
      FFAppState().activeLocationSlug = slug;
      FFAppState().activeLocationName = name;
      FFAppState().activeLocationDescription = description;
      FFAppState().activeLocationCategory = category;
      FFAppState().activeLocationIsRegulatory = isRegulatory;
      FFAppState().activeLocationRegulatoryMessage = regulatoryMessage;
      FFAppState().activeLocationRegulatoryFineEur = regulatoryFineEur;
      FFAppState().activeLocationAffiliateUrl = affiliateUrl;
      FFAppState().activeLocationAudioUrl = audioUrl;
    });
  };

  // ── EXIT: rider leaves the geofence zone ───────────────────────────────────
  // Only clears state if the slug that was exited is the one currently shown.
  // This prevents a race condition when two geofences overlap.
  GeofencingActions.onLandmarkExited = ({required String slug}) {
    if (FFAppState().activeLocationSlug == slug) {
      FFAppState().update(() {
        FFAppState().activeLocationSlug = '';
        FFAppState().activeLocationName = '';
        FFAppState().activeLocationDescription = '';
        FFAppState().activeLocationCategory = '';
        FFAppState().activeLocationIsRegulatory = false;
        FFAppState().activeLocationRegulatoryMessage = '';
        FFAppState().activeLocationRegulatoryFineEur = 0;
        FFAppState().activeLocationAffiliateUrl = '';
        FFAppState().activeLocationAudioUrl = '';
      });
    }
  };
}
