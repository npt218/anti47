import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface SpeedGaugeProps {
  speedKmh: number;
}

export const SpeedGauge: React.FC<SpeedGaugeProps> = ({ speedKmh }) => {
  // Speed color indicator (green/amber/red levels)
  const getSpeedColor = () => {
    if (speedKmh > 70) return '#FF4D4F'; // High speed
    if (speedKmh > 50) return '#FAAD14'; // Moderate / caution
    return '#52C41A'; // Safe / normal
  };

  return (
    <View style={styles.container}>
      <View style={[styles.gaugeCircle, { borderColor: getSpeedColor() }]}>
        <Text style={[styles.speedText, { color: getSpeedColor() }]}>
          {Math.round(speedKmh)}
        </Text>
        <Text style={styles.unitText}>KM/H</Text>
      </View>
      <Text style={styles.stateLabel}>
        {speedKmh === 0 ? 'STOPPED' : 'CRUISING'}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
  },
  gaugeCircle: {
    width: 230,
    height: 230,
    borderRadius: 115,
    borderWidth: 6,
    backgroundColor: '#161B22',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  speedText: {
    fontSize: 92,
    fontWeight: '900',
    letterSpacing: -2,
    fontVariant: ['tabular-nums'],
  },
  unitText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#8B949E',
    letterSpacing: 2,
    marginTop: -8,
  },
  stateLabel: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: '600',
    color: '#8B949E',
    letterSpacing: 1.5,
  },
});
