import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const CATEGORY_COLORS: Record<string, string> = {
  landmark: '#1565C0',
  dismount_zone: '#B71C1C',
  parking: '#2E7D32',
  hazard: '#E65100',
  viewpoint: '#4A148C',
};

const CATEGORY_LABELS: Record<string, string> = {
  landmark: 'Landmark',
  dismount_zone: 'Dismount Zone',
  parking: 'Parking',
  hazard: 'Hazard',
  viewpoint: 'Viewpoint',
};

interface Props {
  landmarkName: string;
  description: string;
  category: string;
  isRegulatory?: boolean;
  regulatoryMessage?: string;
  regulatoryFineEur?: number;
  affiliateUrl?: string;
  isVisited?: boolean;
  isSubscribed?: boolean;
  quizQuestion?: string;
  quizOptions?: string[];
  quizCorrectIndex?: number;
  quizExplanation?: string;
  quizPoints?: number;
  quizAlreadyCompleted?: boolean;
  faqQuestions?: string[];
  faqAnswers?: string[];
  faqIsPremium?: boolean[];
  destinationLat?: number;
  destinationLng?: number;
  onDismiss?: () => void;
  onQuizCorrect?: (points: number) => void;
  onGetDirections?: () => void;
}

export default function LandmarkCard({
  landmarkName,
  description,
  category,
  isRegulatory = false,
  regulatoryMessage = '',
  regulatoryFineEur = 0,
  affiliateUrl = '',
  isVisited = false,
  isSubscribed = false,
  quizQuestion = '',
  quizOptions = [],
  quizCorrectIndex = -1,
  quizExplanation = '',
  quizPoints = 0,
  quizAlreadyCompleted = false,
  faqQuestions = [],
  faqAnswers = [],
  faqIsPremium = [],
  destinationLat,
  destinationLng,
  onDismiss,
  onQuizCorrect,
  onGetDirections,
}: Props) {
  const [selectedOption, setSelectedOption] = useState(-1);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const answered = selectedOption >= 0;
  const color = CATEGORY_COLORS[category] ?? '#1565C0';
  const label = CATEGORY_LABELS[category] ?? category;

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.chip, { backgroundColor: color + '22', borderColor: color }]}>
            <Text style={[styles.chipText, { color }]}>{label}</Text>
          </View>
          {isVisited && (
            <View style={styles.visitedRow}>
              <Ionicons name="checkmark-circle" size={13} color="#43A047" />
              <Text style={styles.visitedText}> Visited</Text>
            </View>
          )}
        </View>
        <TouchableOpacity
          onPress={onDismiss}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={22} color="#9E9E9E" />
        </TouchableOpacity>
      </View>

      <Text style={styles.title}>{landmarkName}</Text>

      {/* Regulatory banner */}
      {isRegulatory && (
        <View style={styles.regulatoryBanner}>
          <Ionicons name="warning" size={18} color="#C62828" />
          <Text style={styles.regulatoryText}>
            {regulatoryMessage}
            {regulatoryFineEur > 0 ? ` — Fine: €${Math.round(regulatoryFineEur)}` : ''}
          </Text>
        </View>
      )}

      {/* Description */}
      <Text style={styles.description}>{description}</Text>

      {/* Quiz */}
      {quizQuestion.length > 0 && !quizAlreadyCompleted && (
        <View style={styles.quizBox}>
          <View style={styles.quizHeaderRow}>
            <Ionicons name="help-circle-outline" size={15} color="#5C6BC0" />
            <Text style={styles.quizLabel}> Quick Quiz</Text>
            {quizPoints > 0 && (
              <Text style={styles.quizPoints}>+{quizPoints} pts</Text>
            )}
          </View>
          <Text style={styles.quizQuestion}>{quizQuestion}</Text>
          {quizOptions.map((opt, i) => {
            const isSelected = selectedOption === i;
            const isCorrect = i === quizCorrectIndex;
            let bg = '#fff';
            let border = '#D1D5DB';
            if (answered) {
              if (isCorrect) { bg = '#E8F5E9'; border = '#43A047'; }
              else if (isSelected) { bg = '#FFEBEE'; border = '#E53935'; }
            } else if (isSelected) {
              bg = '#E8EAF6'; border = '#5C6BC0';
            }
            return (
              <TouchableOpacity
                key={i}
                style={[styles.option, { backgroundColor: bg, borderColor: border }]}
                onPress={() => {
                  if (answered) return;
                  setSelectedOption(i);
                  if (i === quizCorrectIndex) onQuizCorrect?.(quizPoints);
                }}
                disabled={answered}
              >
                <Text style={styles.optionText}>{opt}</Text>
                {answered && isCorrect && (
                  <Ionicons name="checkmark-circle" size={15} color="#43A047" />
                )}
                {answered && isSelected && !isCorrect && (
                  <Ionicons name="close-circle" size={15} color="#E53935" />
                )}
              </TouchableOpacity>
            );
          })}
          {answered && (
            <Text
              style={[
                styles.feedback,
                { color: selectedOption === quizCorrectIndex ? '#43A047' : '#757575' },
              ]}
            >
              {selectedOption === quizCorrectIndex ? '✓ Correct! ' : '✗ Not quite — '}
              {quizExplanation}
            </Text>
          )}
        </View>
      )}

      {/* FAQs */}
      {faqQuestions.length > 0 && (
        <View style={styles.faqSection}>
          <Text style={styles.faqTitle}>FAQs at this spot</Text>
          {faqQuestions.map((q, i) => {
            const locked = (faqIsPremium[i] ?? false) && !isSubscribed;
            const expanded = expandedFaq === i;
            return (
              <View key={i} style={styles.faqItem}>
                <TouchableOpacity
                  style={styles.faqRow}
                  onPress={() => setExpandedFaq(expanded ? null : i)}
                >
                  <Text style={styles.faqQuestion}>{q}</Text>
                  {locked ? (
                    <Ionicons name="lock-closed-outline" size={14} color="#FFA000" />
                  ) : (
                    <Ionicons
                      name={expanded ? 'chevron-up' : 'chevron-down'}
                      size={14}
                      color="#9E9E9E"
                    />
                  )}
                </TouchableOpacity>
                {expanded && (
                  <Text style={styles.faqAnswer}>
                    {locked
                      ? '⭐ Premium — upgrade to unlock'
                      : (faqAnswers[i] ?? '')}
                  </Text>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* Book a Tour button */}
      {affiliateUrl.length > 0 && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.filledBtn, { flex: 1 }]}
            onPress={() => Linking.openURL(affiliateUrl)}
          >
            <Ionicons name="ticket-outline" size={15} color="#fff" />
            <Text style={styles.filledBtnText}> Book a Tour</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Directions button */}
      {destinationLat !== undefined && destinationLng !== undefined && (
        <TouchableOpacity
          style={styles.directionsBtn}
          onPress={() => onGetDirections?.()}
        >
          <Ionicons name="navigate" size={15} color="#fff" />
          <Text style={styles.directionsBtnText}>Get Directions</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    flex: 1,
    gap: 8,
  },
  chip: {
    borderRadius: 4,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  chipText: { fontSize: 11, fontWeight: '600', letterSpacing: 0.4 },
  visitedRow: { flexDirection: 'row', alignItems: 'center' },
  visitedText: { fontSize: 11, color: '#43A047', fontWeight: '500' },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  regulatoryBanner: {
    flexDirection: 'row',
    backgroundColor: '#FFEBEE',
    borderColor: '#EF9A9A',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    alignItems: 'flex-start',
    gap: 8,
  },
  regulatoryText: {
    color: '#B71C1C',
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
    lineHeight: 18,
  },
  description: {
    fontSize: 14,
    color: '#424242',
    lineHeight: 21,
    marginBottom: 10,
  },
  quizBox: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  quizHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  quizLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#5C6BC0',
    flex: 1,
  },
  quizPoints: { fontSize: 12, fontWeight: '600', color: '#5C6BC0' },
  quizQuestion: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 10,
    lineHeight: 20,
  },
  option: {
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 6,
  },
  optionText: { fontSize: 13, color: '#1A1A1A', flex: 1 },
  feedback: { fontSize: 12, marginTop: 4, lineHeight: 18 },
  faqSection: { marginBottom: 8 },
  faqTitle: { fontSize: 12, fontWeight: '600', color: '#757575', marginBottom: 4 },
  faqItem: { borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  faqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 8,
  },
  faqQuestion: {
    fontSize: 13,
    fontWeight: '500',
    color: '#1A1A1A',
    flex: 1,
  },
  faqAnswer: {
    fontSize: 13,
    color: '#424242',
    lineHeight: 20,
    paddingBottom: 8,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  filledBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1565C0',
    borderRadius: 8,
    paddingVertical: 10,
  },
  filledBtnText: { fontSize: 13, color: '#fff', fontWeight: '500' },
  directionsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1565C0',
    borderRadius: 10,
    paddingVertical: 11,
    gap: 6,
    marginTop: 8,
  },
  directionsBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
