import { useCallback, useEffect, useState } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Text,
  RefreshControl,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { filterParkingByDistance } from '../../src/utils/parkingFilter';
import ParkingCard from '../../src/components/ParkingCard';
import { BICIBOX_URL, BICIPARK_URL } from '../../constants/rules';

interface Station {
  EQUIPAMENT?: string;
  EQUIPAMENT_ID?: string;
  LATITUD?: string;
  LONGITUD?: string;
  distanceMetres: number;
  _type: 'bicibox' | 'bicipark';
  [key: string]: unknown;
}

export default function ParkingScreen() {
  const { t } = useTranslation();
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError(t('parking.locationPermissionRequired'));
        return;
      }

      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = pos.coords;

      const [biciboxRes, biciparkRes] = await Promise.all([
        fetch(BICIBOX_URL),
        fetch(BICIPARK_URL),
      ]);

      const [biciboxJson, biciparkJson] = await Promise.all([
        biciboxRes.text(),
        biciparkRes.text(),
      ]);

      const biciboxFiltered: Station[] = JSON.parse(
        filterParkingByDistance(biciboxJson, latitude, longitude, 1000),
      ).map((s: Record<string, unknown>) => ({ ...s, _type: 'bicibox' as const }));

      const biciparkFiltered: Station[] = JSON.parse(
        filterParkingByDistance(biciparkJson, latitude, longitude, 1000),
      ).map((s: Record<string, unknown>) => ({ ...s, _type: 'bicipark' as const }));

      setStations([...biciboxFiltered, ...biciparkFiltered]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('parking.failedToLoad'));
    }
  }, [t]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#00C853" size="large" />
        <Text style={styles.loadingText}>{t('parking.findingNearby')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {error.length > 0 && (
        <Text style={styles.error}>{error}</Text>
      )}
      {!error && stations.length === 0 && (
        <View style={styles.centered}>
          <Ionicons name="bicycle-outline" size={52} color="#444" />
          <Text style={styles.emptyText}>{t('parking.emptyTitle')}</Text>
          <Text style={styles.emptySubText}>
            {t('parking.emptySubtitle')}
          </Text>
        </View>
      )}
      <FlatList
        data={stations}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item }) => (
          <ParkingCard
            type={item._type}
            name={(item['EQUIPAMENT'] as string) ?? (item['NOM'] as string) ?? t('parking.defaultName')}
            distanceMetres={item.distanceMetres}
          />
        )}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#00C853"
          />
        }
        ListHeaderComponent={
          stations.length > 0 ? (
            <Text style={styles.header}>
              {t('parking.spotsWithin', { count: stations.length })}
            </Text>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: { color: '#aaa', fontSize: 14 },
  emptyText: {
    color: '#BDBDBD',
    fontSize: 17,
    fontWeight: 'bold' as const,
    textAlign: 'center' as const,
    marginTop: 12,
  },
  emptySubText: {
    color: '#555',
    fontSize: 13,
    textAlign: 'center' as const,
    paddingHorizontal: 36,
    marginTop: 6,
  },
  error: {
    color: '#EF5350',
    fontSize: 13,
    textAlign: 'center',
    margin: 16,
  },
  list: { paddingTop: 8, paddingBottom: 32 },
  header: {
    color: '#666',
    fontSize: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
});
