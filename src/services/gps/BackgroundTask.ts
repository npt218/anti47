/**
 * Background Location Task Definition
 *
 * Implements headless background execution using `expo-task-manager` and `expo-location`.
 * Allows continuous GPS tracking, OSM map matching, and overspeed alerts when the phone
 * screen is locked or the application is minimized.
 */

import * as TaskManager from 'expo-task-manager';
import { BACKGROUND_LOCATION_TASK } from '../../types/gps';
import { gpsService } from './GPSService';
import { mapMatcher } from '../osm/MapMatcher';
import { determineSpeedLimit } from '../rules/VietnamSpeedRules';
import { overspeedFSM } from '../rules/OverspeedFSM';
import { notificationService } from '../notifications/NotificationService';

// Register the headless background task at the module level
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.warn('Background location task error:', error);
    return;
  }

  if (!data) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { locations } = data as { locations: any[] };
  if (!locations || locations.length === 0) return;

  // Process the most recent GNSS fix
  const latestLocation = locations[locations.length - 1];

  try {
    // 1. Process fix through GPS telemetry filter & pub/sub pipeline
    const processedFix = gpsService.handleBackgroundLocationFix({
      coords: {
        latitude: latestLocation.coords.latitude,
        longitude: latestLocation.coords.longitude,
        altitude: latestLocation.coords.altitude,
        accuracy: latestLocation.coords.accuracy,
        altitudeAccuracy: latestLocation.coords.altitudeAccuracy,
        heading: latestLocation.coords.heading,
        speed: latestLocation.coords.speed,
      },
      timestamp: latestLocation.timestamp,
    });

    if (!processedFix) return;

    // 2. Perform offline road matching
    const matchResult = await mapMatcher.match(processedFix);

    // 3. Determine legal motorcycle speed limit
    const limitResult = determineSpeedLimit(
      matchResult.matched ? matchResult.segment : null,
      'motorcycle'
    );

    // 4. Update overspeed state machine
    const alertState = overspeedFSM.update(
      processedFix.speedKmh,
      limitResult,
      processedFix.timestamp
    );

    // 5. Trigger vibration & system notification (relayed by iOS ANCS to Xiaomi Smart Band 11)
    const roadName = matchResult.matched && matchResult.segment
      ? matchResult.segment.name
      : 'Đoạn đường hiện tại';

    await notificationService.handleOverspeedUpdate(
      alertState,
      roadName,
      processedFix.timestamp
    );
  } catch (err) {
    console.warn('Error processing background location fix:', err);
  }
});
