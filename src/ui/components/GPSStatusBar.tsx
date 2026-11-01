import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { GPSStatus } from '../../types/gps';

interface GPSStatusBarProps {
  status: GPSStatus;
  accuracy: number | null;
  isSimulated: boolean;
  onStartLive: () => void;
  onStartSimulation: () => void;
  onStop: () => void;
}

export const GPSStatusBar: React.FC<GPSStatusBarProps> = ({
  status,
  accuracy,
  isSimulated,
  onStartLive,
  onStartSimulation,
  onStop,
}) => {
  const getStatusBadge = () => {
    switch (status) {
      case 'locked':
        return { label: 'GPS LOCKED', bg: '#1F6FEB', color: '#FFFFFF' };
      case 'simulating':
        return { label: 'SIMULATION (HCMC)', bg: '#8957E5', color: '#FFFFFF' };
      case 'searching':
        return { label: 'SEARCHING SATELLITES...', bg: '#D29922', color: '#000000' };
      case 'permission_denied':
        return { label: 'PERMISSION DENIED', bg: '#DA3633', color: '#FFFFFF' };
      case 'error':
        return { label: 'GPS ERROR', bg: '#DA3633', color: '#FFFFFF' };
      case 'requesting_permission':
        return { label: 'REQUESTING PERMISSION', bg: '#D29922', color: '#000000' };
      case 'idle':
      default:
        return { label: 'STANDBY', bg: '#30363D', color: '#8B949E' };
    }
  };

  const badge = getStatusBadge();

  return (
    <View style={styles.container}>
      <View style={styles.statusRow}>
        <View style={[styles.badge, { backgroundColor: badge.bg }]}>
          <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
        </View>

        {accuracy !== null && status !== 'idle' && (
          <View style={styles.accuracyContainer}>
            <Text style={styles.accuracyLabel}>ACCURACY</Text>
            <Text style={styles.accuracyValue}>±{accuracy}m</Text>
          </View>
        )}
      </View>

      <View style={styles.buttonRow}>
        {status === 'idle' || status === 'error' || status === 'permission_denied' ? (
          <>
            <TouchableOpacity
              style={[styles.btn, styles.btnPrimary]}
              onPress={onStartLive}
              activeOpacity={0.8}
            >
              <Text style={styles.btnPrimaryText}>Start Live GPS</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btn, styles.btnSecondary]}
              onPress={onStartSimulation}
              activeOpacity={0.8}
            >
              <Text style={styles.btnSecondaryText}>Simulate HCMC</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={[styles.btn, styles.btnDanger]}
            onPress={onStop}
            activeOpacity={0.8}
          >
            <Text style={styles.btnDangerText}>Stop Tracking</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: 20,
    marginVertical: 10,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  accuracyContainer: {
    alignItems: 'flex-end',
  },
  accuracyLabel: {
    fontSize: 10,
    color: '#8B949E',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  accuracyValue: {
    fontSize: 14,
    color: '#E6EDF3',
    fontWeight: '700',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: {
    backgroundColor: '#238636',
  },
  btnPrimaryText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  btnSecondary: {
    backgroundColor: '#21262D',
    borderWidth: 1,
    borderColor: '#30363D',
  },
  btnSecondaryText: {
    color: '#C9D1D9',
    fontWeight: '700',
    fontSize: 14,
  },
  btnDanger: {
    backgroundColor: '#DA3633',
  },
  btnDangerText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});
