import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface SpeedLimitSignProps {
  limitKmh: number | null;
  isOverspeed?: boolean;
}

/**
 * Authentic Vietnam Traffic Sign P.127: "Tốc độ tối đa cho phép"
 * Circular sign with bold red border, white circular background, and black numbers.
 */
export const SpeedLimitSign: React.FC<SpeedLimitSignProps> = ({
  limitKmh,
  isOverspeed = false,
}) => {
  return (
    <View style={styles.container}>
      <View
        style={[
          styles.outerCircle,
          isOverspeed && styles.overspeedOuterCircle,
        ]}
      >
        <View style={styles.innerCircle}>
          <Text style={styles.limitText}>
            {limitKmh !== null && limitKmh > 0 ? limitKmh : '--'}
          </Text>
        </View>
      </View>
      <Text style={styles.signLabel}>GIỚI HẠN</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  outerCircle: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: '#D32F2F', // Vietnam traffic sign red
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 5,
  },
  overspeedOuterCircle: {
    backgroundColor: '#FF1744',
    transform: [{ scale: 1.05 }],
  },
  innerCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  limitText: {
    fontSize: 28,
    fontWeight: '900',
    color: '#111111',
    letterSpacing: -1,
  },
  signLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#8B949E',
    letterSpacing: 1,
    marginTop: 4,
  },
});
