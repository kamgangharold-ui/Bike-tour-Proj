import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

class LandmarkCard extends StatefulWidget {
  const LandmarkCard({
    super.key,
    required this.landmarkName,
    required this.description,
    required this.category,
    this.isRegulatory = false,
    this.regulatoryMessage = '',
    this.regulatoryFineEur = 0,
    this.audioUrl = '',
    this.affiliateUrl = '',
    this.isVisited = false,
    this.isSubscribed = false,
    this.quizQuestion = '',
    this.quizOptions = const [],
    this.quizCorrectIndex = -1,
    this.quizExplanation = '',
    this.quizPoints = 0,
    this.quizAlreadyCompleted = false,
    this.faqQuestions = const [],
    this.faqAnswers = const [],
    this.faqIsPremium = const [],
    this.onAudioPlay,
    this.onQuizCorrect,
    this.onDismiss,
  });

  final String landmarkName;
  final String description;
  final String category;
  final bool isRegulatory;
  final String regulatoryMessage;
  final double regulatoryFineEur;
  final String audioUrl;
  final String affiliateUrl;
  final bool isVisited;
  final bool isSubscribed;
  final String quizQuestion;
  final List<String> quizOptions;
  final int quizCorrectIndex;
  final String quizExplanation;
  final int quizPoints;
  final bool quizAlreadyCompleted;
  final List<String> faqQuestions;
  final List<String> faqAnswers;
  final List<bool> faqIsPremium;
  final VoidCallback? onAudioPlay;
  final void Function(int points)? onQuizCorrect;
  final VoidCallback? onDismiss;

  @override
  State<LandmarkCard> createState() => _LandmarkCardState();
}

class _LandmarkCardState extends State<LandmarkCard> {
  int _selected = -1;
  bool _revealed = false;

  static const _categoryColors = {
    'landmark': Color(0xFF1565C0),
    'dismount_zone': Color(0xFFB71C1C),
    'parking': Color(0xFF2E7D32),
    'hazard': Color(0xFFE65100),
    'viewpoint': Color(0xFF4A148C),
  };
  static const _categoryLabels = {
    'landmark': 'Landmark',
    'dismount_zone': 'Dismount Zone',
    'parking': 'Parking',
    'hazard': 'Hazard',
    'viewpoint': 'Viewpoint',
  };

  Color get _color => _categoryColors[widget.category] ?? const Color(0xFF1565C0);

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
              color: Colors.black.withOpacity(0.15),
              blurRadius: 24,
              offset: const Offset(0, 6))
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildHeader(),
          if (widget.isRegulatory) _buildRegulatoryBanner(),
          _buildDescription(),
          if (widget.quizQuestion.isNotEmpty && !widget.quizAlreadyCompleted)
            _buildQuiz(),
          if (widget.faqQuestions.isNotEmpty) _buildFaqs(),
          _buildActions(),
        ],
      ),
    );
  }

  Widget _buildHeader() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 8, 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(children: [
                  _Chip(
                      label: _categoryLabels[widget.category] ?? widget.category,
                      color: _color),
                  if (widget.isVisited) ...[
                    const SizedBox(width: 8),
                    const Icon(Icons.check_circle, size: 14, color: Color(0xFF43A047)),
                    const SizedBox(width: 3),
                    const Text('Visited',
                        style: TextStyle(
                            fontSize: 11,
                            color: Color(0xFF43A047),
                            fontWeight: FontWeight.w500)),
                  ]
                ]),
                const SizedBox(height: 6),
                Text(widget.landmarkName,
                    style: const TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF1A1A1A))),
              ],
            ),
          ),
          IconButton(
              icon: const Icon(Icons.close, color: Color(0xFF9E9E9E)),
              onPressed: widget.onDismiss),
        ],
      ),
    );
  }

  Widget _buildRegulatoryBanner() {
    final fine = widget.regulatoryFineEur > 0
        ? ' — Fine: €${widget.regulatoryFineEur.toStringAsFixed(0)}'
        : '';
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFFFEBEE),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFFEF9A9A)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.warning_amber_rounded, color: Color(0xFFC62828), size: 20),
          const SizedBox(width: 8),
          Expanded(
            child: Text('${widget.regulatoryMessage}$fine',
                style: const TextStyle(
                    color: Color(0xFFB71C1C),
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                    height: 1.4)),
          ),
        ],
      ),
    );
  }

  Widget _buildDescription() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
      child: Text(widget.description,
          style: const TextStyle(
              fontSize: 14, color: Color(0xFF424242), height: 1.5)),
    );
  }

  Widget _buildQuiz() {
    final answered = _selected >= 0;
    final correct = answered && _selected == widget.quizCorrectIndex;
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 4, 16, 0),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFF3F4F6),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            const Icon(Icons.quiz_outlined, size: 15, color: Color(0xFF5C6BC0)),
            const SizedBox(width: 5),
            const Text('Quick Quiz',
                style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF5C6BC0))),
            if (widget.quizPoints > 0) ...[
              const Spacer(),
              Text('+${widget.quizPoints} pts',
                  style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF5C6BC0)))
            ],
          ]),
          const SizedBox(height: 10),
          Text(widget.quizQuestion,
              style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF1A1A1A),
                  height: 1.4)),
          const SizedBox(height: 10),
          ...List.generate(widget.quizOptions.length, (i) {
            return _QuizOption(
              label: widget.quizOptions[i],
              index: i,
              selectedIndex: _selected,
              correctIndex: widget.quizCorrectIndex,
              hasAnswered: answered,
              onTap: answered
                  ? null
                  : () {
                      setState(() {
                        _selected = i;
                        _revealed = true;
                      });
                      if (i == widget.quizCorrectIndex) {
                        widget.onQuizCorrect?.call(widget.quizPoints);
                      }
                    },
            );
          }),
          if (answered)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Row(children: [
                Icon(correct ? Icons.emoji_events : Icons.info_outline,
                    size: 14,
                    color: correct ? const Color(0xFF43A047) : const Color(0xFF757575)),
                const SizedBox(width: 4),
                Text(correct ? 'Correct!' : 'Not quite —',
                    style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: correct
                            ? const Color(0xFF43A047)
                            : const Color(0xFF757575))),
              ]),
            ),
          if (_revealed && widget.quizExplanation.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(widget.quizExplanation,
                  style: const TextStyle(
                      fontSize: 12,
                      color: Color(0xFF616161),
                      fontStyle: FontStyle.italic,
                      height: 1.4)),
            ),
        ],
      ),
    );
  }

  Widget _buildFaqs() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('FAQs at this spot',
              style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF757575))),
          const SizedBox(height: 4),
          ...List.generate(widget.faqQuestions.length, (i) {
            final locked = i < widget.faqIsPremium.length &&
                widget.faqIsPremium[i] &&
                !widget.isSubscribed;
            return Theme(
              data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
              child: ExpansionTile(
                tilePadding: EdgeInsets.zero,
                childrenPadding: EdgeInsets.zero,
                title: Text(widget.faqQuestions[i],
                    style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                        color: Color(0xFF1A1A1A))),
                trailing: locked
                    ? const Icon(Icons.lock_outline,
                        size: 15, color: Color(0xFFFFA000))
                    : const Icon(Icons.keyboard_arrow_down,
                        color: Color(0xFF9E9E9E)),
                children: [
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: locked
                        ? Row(children: const [
                            Icon(Icons.star, size: 13, color: Color(0xFFFFA000)),
                            SizedBox(width: 4),
                            Text('Premium — upgrade to unlock',
                                style: TextStyle(
                                    fontSize: 12, color: Color(0xFFFFA000))),
                          ])
                        : Text(
                            i < widget.faqAnswers.length
                                ? widget.faqAnswers[i]
                                : '',
                            style: const TextStyle(
                                fontSize: 13,
                                color: Color(0xFF424242),
                                height: 1.5)),
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }

  Widget _buildActions() {
    final hasAudio = widget.audioUrl.isNotEmpty;
    final hasAffiliate = widget.affiliateUrl.isNotEmpty;
    if (!hasAudio && !hasAffiliate) return const SizedBox(height: 16);
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
      child: Row(
        children: [
          if (hasAudio)
            Expanded(
              child: OutlinedButton.icon(
                onPressed: widget.onAudioPlay,
                icon: const Icon(Icons.headphones, size: 15),
                label: const Text('Audio Guide'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: const Color(0xFF1565C0),
                  side: const BorderSide(color: Color(0xFF1565C0)),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8)),
                  padding: const EdgeInsets.symmetric(vertical: 10),
                ),
              ),
            ),
          if (hasAudio && hasAffiliate) const SizedBox(width: 8),
          if (hasAffiliate)
            Expanded(
              child: ElevatedButton.icon(
                onPressed: () async {
                  final uri = Uri.tryParse(widget.affiliateUrl);
                  if (uri != null) await launchUrl(uri);
                },
                icon: const Icon(Icons.confirmation_number_outlined, size: 15),
                label: const Text('Book a Tour'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF1565C0),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8)),
                  padding: const EdgeInsets.symmetric(vertical: 10),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({required this.label, required this.color});
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withOpacity(0.12),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(label,
          style: TextStyle(
              color: color,
              fontSize: 11,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.4)),
    );
  }
}

class _QuizOption extends StatelessWidget {
  const _QuizOption({
    required this.label,
    required this.index,
    required this.selectedIndex,
    required this.correctIndex,
    required this.hasAnswered,
    required this.onTap,
  });
  final String label;
  final int index;
  final int selectedIndex;
  final int correctIndex;
  final bool hasAnswered;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final isSelected = selectedIndex == index;
    final isCorrect = index == correctIndex;
    Color borderColor = const Color(0xFFD1D5DB);
    Color? bgColor;
    Widget? trailing;
    if (hasAnswered) {
      if (isCorrect) {
        bgColor = const Color(0xFFE8F5E9);
        borderColor = const Color(0xFF43A047);
        trailing = const Icon(Icons.check_circle, size: 15, color: Color(0xFF43A047));
      } else if (isSelected) {
        bgColor = const Color(0xFFFFEBEE);
        borderColor = const Color(0xFFE53935);
        trailing = const Icon(Icons.cancel, size: 15, color: Color(0xFFE53935));
      }
    } else if (isSelected) {
      bgColor = const Color(0xFFE8EAF6);
      borderColor = const Color(0xFF5C6BC0);
    }
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 6),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: bgColor ?? Colors.white,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: borderColor),
        ),
        child: Row(
          children: [
            Expanded(
                child: Text(label,
                    style: const TextStyle(fontSize: 13, color: Color(0xFF1A1A1A)))),
            if (trailing != null) trailing,
          ],
        ),
      ),
    );
  }
}
