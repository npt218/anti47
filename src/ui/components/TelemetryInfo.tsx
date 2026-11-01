import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GPSFix } from '../../types/gps';

interface TelemetryInfoProps {
  fix: GPSFix | null;
}

export const TelemetryInfo: React.FC<TelemetryInfoProps> = ({ fix }) => {
  const getCardinalDirection = (deg: number | null): string => {
    if (deg === null) return '--';
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(deg / 45) % 8;
    return `${directions[index]} (${Math.round(deg)}°)`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.grid}>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>LATITUDE</Text>
          <Text style={styles.cardValue}>
            {fix ? fix.latitude.toFixed(5) : '--'}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>LONGITUDE</Text>
          <Text style={styles.cardValue}>
            {fix ? fix.longitude.toFixed(5) : '--'}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>HEADING</Text>
          <Text style={styles.cardValue}>
            {getCardinalDirection(fix?.heading ?? null)}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>RAW SPEED</Text>
          <Text style={styles.cardValue}>
            {fix ? `${fix.rawSpeedKmh} km/h` : '--'}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: 20,
    marginTop: 10,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
  card: {
    width: '48%',
    backgroundColor: '#161B22',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#30363D',
  },
  cardLabel: {
    fontSize: 10,
    color: '#8B949E',
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 4,
  },
  cardValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#E6EDF3',
    fontVariant: ['tabular-nums'],
  },
});
