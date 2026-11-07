import React, { useEffect, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { gpsService } from './src/services/gps/GPSService';
import { mapMatcher } from './src/services/osm/MapMatcher';
import { GPSFix, GPSStatus } from './src/types/gps';
import { RoadMatchResult } from './src/types/osm';
import { GPSStatusBar } from './src/ui/components/GPSStatusBar';
import { RoadMatchCard } from './src/ui/components/RoadMatchCard';
import { SpeedGauge } from './src/ui/components/SpeedGauge';
import { TelemetryInfo } from './src/ui/components/TelemetryInfo';

export default function App() {
  const [fix, setFix] = useState<GPSFix | null>(null);
  const [status, setStatus] = useState<GPSStatus>('idle');
  const [roadMatch, setRoadMatch] = useState<RoadMatchResult | null>(null);

  useEffect(() => {
    // Warm up the offline SQLite OSM database
    mapMatcher.initialize().catch((err) => {
      console.warn('Failed to pre-warm OSM database:', err);
    });

    // Subscribe to GPS telemetry fixes
    const unsubscribeFix = gpsService.subscribe(async (newFix) => {
      setFix(newFix);

      // Perform local offline map matching against SQLite road database
      try {
        const matchResult = await mapMatcher.match(newFix);
        setRoadMatch(matchResult);
      } catch (err) {
        console.warn('Map matching error:', err);
      }
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
    setRoadMatch(null);
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

        <View style={styles.cardContainer}>
          <RoadMatchCard match={roadMatch} />
        </View>

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
  cardContainer: {
    width: '100%',
    paddingHorizontal: 20,
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
