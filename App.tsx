import React, { useEffect, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { gpsService } from './src/services/gps/GPSService';
import { mapMatcher } from './src/services/osm/MapMatcher';
import { overspeedFSM } from './src/services/rules/OverspeedFSM';
import { determineSpeedLimit } from './src/services/rules/VietnamSpeedRules';
import { notificationService } from './src/services/notifications/NotificationService';
import { GPSFix, GPSStatus } from './src/types/gps';
import { RoadMatchResult } from './src/types/osm';
import { OverspeedState, SpeedLimitResult } from './src/types/rules';
import { GPSStatusBar } from './src/ui/components/GPSStatusBar';
import { OverspeedBanner } from './src/ui/components/OverspeedBanner';
import { RoadMatchCard } from './src/ui/components/RoadMatchCard';
import { SpeedGauge } from './src/ui/components/SpeedGauge';
import { SpeedLimitSign } from './src/ui/components/SpeedLimitSign';
import { TelemetryInfo } from './src/ui/components/TelemetryInfo';

export default function App() {
  const [fix, setFix] = useState<GPSFix | null>(null);
  const [status, setStatus] = useState<GPSStatus>('idle');
  const [roadMatch, setRoadMatch] = useState<RoadMatchResult | null>(null);
  const [speedLimit, setSpeedLimit] = useState<SpeedLimitResult | null>(null);
  const [overspeed, setOverspeed] = useState<OverspeedState>(overspeedFSM.getState());

  useEffect(() => {
    // Warm up offline SQLite OSM database and notifications
    mapMatcher.initialize().catch((err) => {
      console.warn('Failed to pre-warm OSM database:', err);
    });

    notificationService.initialize().then(() => {
      notificationService.requestPermissions().catch(() => {});
    });

    // Subscribe to GPS telemetry fixes
    const unsubscribeFix = gpsService.subscribe(async (newFix) => {
      setFix(newFix);

      // 1. Perform local offline map matching against SQLite road database
      try {
        const matchResult = await mapMatcher.match(newFix);
        setRoadMatch(matchResult);

        // 2. Evaluate statutory speed limits (Circular 31/2019/TT-BGTVT + road signs)
        const limitResult = determineSpeedLimit(
          matchResult.matched ? matchResult.segment : null,
          'motorcycle'
        );
        setSpeedLimit(limitResult);

        // 3. Update Overspeed Hysteresis State Machine
        const alertState = overspeedFSM.update(
          newFix.speedKmh,
          limitResult,
          newFix.timestamp
        );
        setOverspeed(alertState);

        // 4. Trigger local notification & haptic alerts (mirrored to Xiaomi Band via ANCS)
        const roadName = matchResult.matched && matchResult.segment
          ? matchResult.segment.name
          : 'Đoạn đường hiện tại';

        notificationService.handleOverspeedUpdate(
          alertState,
          roadName,
          newFix.timestamp
        ).catch(() => {});
      } catch (err) {
        console.warn('Map matching or speed rule error:', err);
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
      notificationService.stopAllAlerts();
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
    overspeedFSM.reset();
    notificationService.stopAllAlerts();
    setRoadMatch(null);
    setSpeedLimit(null);
    setOverspeed(overspeedFSM.getState());
  };

  const handleTestAlert = () => {
    notificationService.triggerTestAlert();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.appTitle}>MOTO ALERT</Text>
          <Text style={styles.appSubtitle}>VIETNAM SPEED TELEMETRY</Text>
        </View>

        <View style={styles.gaugeContainer}>
          <SpeedGauge
            speedKmh={fix ? fix.speedKmh : 0}
            alertLevel={overspeed.level}
          />
          <View style={styles.signFloatingBadge}>
            <SpeedLimitSign
              limitKmh={speedLimit ? speedLimit.limitKmh : null}
              isOverspeed={overspeed.isOverspeed}
            />
          </View>
        </View>

        <View style={styles.cardContainer}>
          <OverspeedBanner state={overspeed} />
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

        <TouchableOpacity
          style={styles.testAlertBtn}
          onPress={handleTestAlert}
          activeOpacity={0.8}
        >
          <Text style={styles.testAlertBtnText}>🔔 TEST BAND VIBRATION (ANCS)</Text>
        </TouchableOpacity>

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
    paddingVertical: 8,
  },
  header: {
    alignItems: 'center',
    marginTop: 4,
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
  gaugeContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  signFloatingBadge: {
    position: 'absolute',
    right: 24,
    top: 20,
  },
  cardContainer: {
    width: '100%',
    paddingHorizontal: 20,
  },
  testAlertBtn: {
    backgroundColor: '#21262D',
    borderWidth: 1,
    borderColor: '#30363D',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
    marginVertical: 4,
  },
  testAlertBtnText: {
    color: '#58A6FF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  footer: {
    paddingHorizontal: 24,
    marginBottom: 4,
  },
  footerText: {
    fontSize: 10,
    color: '#484F58',
    textAlign: 'center',
    lineHeight: 14,
  },
});
