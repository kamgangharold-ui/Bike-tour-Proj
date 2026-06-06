import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

interface Props {
  type: 'bicibox' | 'bicipark';
  name: string;
  distanceMetres: number;
}

export default function ParkingCard({ type, name, distanceMetres }: Props) {
  const { t } = useTranslation();
  const isBicibox = type === 'bicibox';
  const color = isBicibox ? '#1565C0' : '#2E7D32';
  // Bicibox / Bicipark are brand names → kept literal; only the instruction localizes.
  const instruction = isBicibox
    ? t('parking.instructionBicibox')
    : t('parking.instructionBicipark');

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={[styles.badge, { backgroundColor: color + '22', borderColor: color }]}>
          <Text style={[styles.badgeText, { color }]}>
            {isBicibox ? 'Bicibox' : 'Bicipark'}
          </Text>
        </View>
        <View style={styles.distanceRow}>
          <Ionicons name="navigate-outline" size={12} color="#9E9E9E" />
          <Text style={styles.distanceText}> {distanceMetres}m</Text>
        </View>
      </View>
      <Text style={styles.name} numberOfLines={2}>{name}</Text>
      <Text style={styles.instruction}>{instruction}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  badge: {
    borderRadius: 4,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: { fontSize: 11, fontWeight: '600' },
  distanceRow: { flexDirection: 'row', alignItems: 'center' },
  distanceText: { fontSize: 12, color: '#9E9E9E' },
  name: { fontSize: 14, fontWeight: '600', color: '#fff', marginBottom: 4 },
  instruction: { fontSize: 12, color: '#9E9E9E', lineHeight: 17 },
});
