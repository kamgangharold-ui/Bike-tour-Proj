import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../state/app_state.dart';
import '../theme/app_theme.dart';
import '../widgets/landmark_card.dart';

class LandmarkDetailPage extends StatelessWidget {
  const LandmarkDetailPage({super.key});

  @override
  Widget build(BuildContext context) {
    final appState = context.watch<AppState>();

    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
        title: Text(appState.activeLocationName.isEmpty
            ? 'Landmark'
            : appState.activeLocationName),
        backgroundColor: AppTheme.surface,
      ),
      body: appState.activeLocationSlug.isEmpty
          ? const Center(
              child: Text('No active landmark.',
                  style: TextStyle(color: Colors.grey)))
          : _DetailBody(appState: appState),
    );
  }
}

class _DetailBody extends StatelessWidget {
  const _DetailBody({required this.appState});
  final AppState appState;

  @override
  Widget build(BuildContext context) {
    final slug = appState.activeLocationSlug;

    return FutureBuilder<_LandmarkData>(
      future: _fetchData(slug, appState.isSubscribed),
      builder: (context, snap) {
        if (snap.connectionState == ConnectionState.waiting) {
          return const Center(
              child: CircularProgressIndicator(color: AppTheme.accent));
        }
        final data = snap.data ?? const _LandmarkData();

        return SingleChildScrollView(
          child: LandmarkCard(
            landmarkName: appState.activeLocationName,
            description: appState.activeLocationDescription,
            category: appState.activeLocationCategory,
            isRegulatory: appState.activeLocationIsRegulatory,
            regulatoryMessage: appState.activeLocationRegulatoryMessage,
            regulatoryFineEur: appState.activeLocationRegulatoryFineEur,
            audioUrl: appState.activeLocationAudioUrl,
            affiliateUrl: appState.activeLocationAffiliateUrl,
            isSubscribed: appState.isSubscribed,
            isVisited: data.isVisited,
            quizQuestion: data.quizQuestion,
            quizOptions: data.quizOptions,
            quizCorrectIndex: data.quizCorrectIndex,
            quizExplanation: data.quizExplanation,
            quizPoints: data.quizPoints,
            quizAlreadyCompleted: data.quizAlreadyCompleted,
            faqQuestions: data.faqQuestions,
            faqAnswers: data.faqAnswers,
            faqIsPremium: data.faqIsPremium,
          ),
        );
      },
    );
  }

  Future<_LandmarkData> _fetchData(String slug, bool isSubscribed) async {
    final fs = FirebaseFirestore.instance;

    final quizSnap = await fs
        .collection('quizzes')
        .where('location_slug', isEqualTo: slug)
        .where('is_active', isEqualTo: true)
        .limit(1)
        .get();

    final faqSnap = await fs
        .collection('faqs')
        .where('location_slug', isEqualTo: slug)
        .where('is_active', isEqualTo: true)
        .orderBy('sort_order')
        .limit(10)
        .get();

    String quizQuestion = '';
    List<String> quizOptions = [];
    int quizCorrectIndex = -1;
    String quizExplanation = '';
    int quizPoints = 0;
    bool quizAlreadyCompleted = false;

    if (quizSnap.docs.isNotEmpty) {
      final q = quizSnap.docs.first.data();
      quizQuestion = (q['question'] as String?) ?? '';
      quizOptions = List<String>.from((q['options'] as List<dynamic>?) ?? []);
      quizCorrectIndex = (q['correct_option_index'] as int?) ?? -1;
      quizExplanation = (q['explanation'] as String?) ?? '';
      quizPoints = (q['points_reward'] as int?) ?? 0;
    }

    final faqQuestions = <String>[];
    final faqAnswers = <String>[];
    final faqIsPremium = <bool>[];

    for (final doc in faqSnap.docs) {
      final f = doc.data();
      faqQuestions.add((f['question'] as String?) ?? '');
      faqAnswers.add((f['answer'] as String?) ?? '');
      faqIsPremium.add((f['is_premium'] as bool?) ?? false);
    }

    return _LandmarkData(
      quizQuestion: quizQuestion,
      quizOptions: quizOptions,
      quizCorrectIndex: quizCorrectIndex,
      quizExplanation: quizExplanation,
      quizPoints: quizPoints,
      quizAlreadyCompleted: quizAlreadyCompleted,
      faqQuestions: faqQuestions,
      faqAnswers: faqAnswers,
      faqIsPremium: faqIsPremium,
    );
  }
}

class _LandmarkData {
  const _LandmarkData({
    this.isVisited = false,
    this.quizQuestion = '',
    this.quizOptions = const [],
    this.quizCorrectIndex = -1,
    this.quizExplanation = '',
    this.quizPoints = 0,
    this.quizAlreadyCompleted = false,
    this.faqQuestions = const [],
    this.faqAnswers = const [],
    this.faqIsPremium = const [],
  });
  final bool isVisited;
  final String quizQuestion;
  final List<String> quizOptions;
  final int quizCorrectIndex;
  final String quizExplanation;
  final int quizPoints;
  final bool quizAlreadyCompleted;
  final List<String> faqQuestions;
  final List<String> faqAnswers;
  final List<bool> faqIsPremium;
}
