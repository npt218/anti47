import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { OverspeedState } from '../../types/rules';

interface OverspeedBannerProps {
  state: OverspeedState;
}

export const OverspeedBanner: React.FC<OverspeedBannerProps> = ({ state }) => {
  const getBannerTheme = () => {
    switch (state.level) {
      case 'critical':
        return {
          bg: '#DA3633',
          border: '#F85149',
          titleColor: '#FFFFFF',
          bodyColor: '#FFFFFF',
          badgeText: 'CRITICAL OVERSPEED',
          message: `+${state.deltaKmh} KM/H OVER LIMIT! SLOW DOWN!`,
        };
      case 'warning':
        return {
          bg: '#3D1418',
          border: '#FF4D4F',
          titleColor: '#FF4D4F',
          bodyColor: '#FFA39E',
          badgeText: 'SPEED WARNING',
          message: `+${state.deltaKmh} KM/H (SUSTAINED)`,
        };
      case 'caution':
        return {
          bg: '#272005',
          border: '#D29922',
          titleColor: '#FAAD14',
          bodyColor: '#FFE58F',
          badgeText: 'CAUTION',
          message: `+${state.deltaKmh} KM/H NEAR LIMIT`,
        };
      case 'normal':
      default:
        return {
          bg: '#0F2D1A',
          border: '#238636',
          titleColor: '#52C41A',
          bodyColor: '#8B949E',
          badgeText: 'SPEED OK',
          message: state.deltaKmh <= 0
            ? `${Math.abs(state.deltaKmh)} km/h below limit`
            : `Within tolerance`,
        };
    }
  };

  const theme = getBannerTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.bg, borderColor: theme.border }]}>
      <View style={styles.topRow}>
        <Text style={[styles.badgeText, { color: theme.titleColor }]}>
          {theme.badgeText}
        </Text>
        <Text style={[styles.deltaText, { color: theme.titleColor }]}>
          {theme.message}
        </Text>
      </View>
      <Text style={styles.reasonText} numberOfLines={1}>
        {state.reason}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1.5,
    marginVertical: 6,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  deltaText: {
    fontSize: 13,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  reasonText: {
    fontSize: 10,
    color: '#8B949E',
    fontWeight: '600',
  },
});
