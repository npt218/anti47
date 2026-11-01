import React, { useEffect, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { gpsService } from './src/services/gps/GPSService';
import { GPSFix, GPSStatus } from './src/types/gps';
import { GPSStatusBar } from './src/ui/components/GPSStatusBar';
import { SpeedGauge } from './src/ui/components/SpeedGauge';
import { TelemetryInfo } from './src/ui/components/TelemetryInfo';

export default function App() {
  const [fix, setFix] = useState<GPSFix | null>(null);
  const [status, setStatus] = useState<GPSStatus>('idle');

  useEffect(() => {
    // Subscribe to GPS telemetry fixes
    const unsubscribeFix = gpsService.subscribe((newFix) => {
      setFix(newFix);
    });

    // Subscribe to GPS hardware/service status
    const unsubscribeStatus = gpsService.subscribeStatus((newStatus) => {
      setStatus(newStatus);
    });

    return () => {
      unsubscribeFix();
      unsubscribeStatus();
      gpsService.stopTracking();
    };
  }, []);

  const handleStartLive = () => {
    gpsService.startLiveTracking();
  };

  const handleStartSimulation = () => {
    gpsService.startSimulation(1000);
  };

  const handleStop = () => {
    gpsService.stopTracking();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.appTitle}>MOTO ALERT</Text>
          <Text style={styles.appSubtitle}>VIETNAM SPEED TELEMETRY</Text>
        </View>

        <SpeedGauge speedKmh={fix ? fix.speedKmh : 0} />

        <GPSStatusBar
          status={status}
          accuracy={fix ? fix.accuracy : null}
          isSimulated={fix?.isSimulated ?? false}
          onStartLive={handleStartLive}
          onStartSimulation={handleStartSimulation}
          onStop={handleStop}
        />

        <TelemetryInfo fix={fix} />

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Safety assistance only. Always obey physical traffic signs and Vietnam road regulations.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0D1117',
  },
  container: {
    flex: 1,
    backgroundColor: '#0D1117',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  header: {
    alignItems: 'center',
    marginTop: 8,
  },
  appTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#F0F6FC',
    letterSpacing: 3,
  },
  appSubtitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#8B949E',
    letterSpacing: 2,
    marginTop: 2,
  },
  footer: {
    paddingHorizontal: 24,
    marginBottom: 8,
  },
  footerText: {
    fontSize: 11,
    color: '#484F58',
    textAlign: 'center',
    lineHeight: 16,
  },
});
