import 'package:flutter/foundation.dart';

class AppState extends ChangeNotifier {
  String activeLocationSlug = '';
  String activeLocationName = '';
  String activeLocationDescription = '';
  String activeLocationCategory = '';
  bool activeLocationIsRegulatory = false;
  String activeLocationRegulatoryMessage = '';
  double activeLocationRegulatoryFineEur = 0.0;
  String activeLocationAffiliateUrl = '';
  String activeLocationAudioUrl = '';
  bool isSubscribed = false;
  String biciboxStationsJson = '';
  String biciparkStationsJson = '';

  bool get hasActiveLandmark => activeLocationSlug.isNotEmpty;

  void onLandmarkEntered({
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
    activeLocationSlug = slug;
    activeLocationName = name;
    activeLocationDescription = description;
    activeLocationCategory = category;
    activeLocationIsRegulatory = isRegulatory;
    activeLocationRegulatoryMessage = regulatoryMessage;
    activeLocationRegulatoryFineEur = regulatoryFineEur;
    activeLocationAffiliateUrl = affiliateUrl;
    activeLocationAudioUrl = audioUrl;
    notifyListeners();
  }

  void onLandmarkExited({required String slug}) {
    if (activeLocationSlug == slug) {
      activeLocationSlug = '';
      activeLocationName = '';
      activeLocationDescription = '';
      activeLocationCategory = '';
      activeLocationIsRegulatory = false;
      activeLocationRegulatoryMessage = '';
      activeLocationRegulatoryFineEur = 0.0;
      activeLocationAffiliateUrl = '';
      activeLocationAudioUrl = '';
      notifyListeners();
    }
  }

  void dismissActiveLandmark() => onLandmarkExited(slug: activeLocationSlug);

  void setSubscribed(bool value) {
    isSubscribed = value;
    notifyListeners();
  }

  void setBiciboxStations(String json) {
    biciboxStationsJson = json;
    notifyListeners();
  }

  void setBiciparkStations(String json) {
    biciparkStationsJson = json;
    notifyListeners();
  }
}
