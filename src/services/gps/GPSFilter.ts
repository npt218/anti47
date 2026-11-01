/**
 * GPS Telemetry Filtering & Noise Rejection
 *
 * Implements pure functional filters to convert noisy raw mobile GNSS fixes
 * into stable, actionable motorcycle speed telemetry.
 */

import { DEFAULT_GPS_FILTER_CONFIG, GPSFilterConfig, GPSFix, RawLocationData } from '../../types/gps';

const EARTH_RADIUS_METERS = 6371000;

/**
 * Calculates great-circle distance between two GPS coordinates using the Haversine formula.
 *
 * @returns Distance in meters
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

/**
 * Fallback speed calculation when the operating system returns null or negative speed.
 * Computes speed = distance_delta / time_delta.
 *
 * @returns Speed in km/h or 0 if time delta is invalid
 */
export function calculateFallbackSpeedKmh(
  prevFix: GPSFix,
  currentLat: number,
  currentLon: number,
  currentTimestamp: number
): number {
  const timeDeltaSec = (currentTimestamp - prevFix.timestamp) / 1000;

  // Ignore unrealistic time intervals (< 200ms or > 10s gap)
  if (timeDeltaSec < 0.2 || timeDeltaSec > 10) {
    return 0;
  }

  const distanceMeters = haversineDistance(
    prevFix.latitude,
    prevFix.longitude,
    currentLat,
    currentLon
  );

  const speedMs = distanceMeters / timeDeltaSec;
  return speedMs * 3.6;
}

/**
 * Applies Exponential Weighted Moving Average (EWMA) to smooth speed fluctuations.
 * Speed_filtered = (alpha * new_speed) + ((1 - alpha) * previous_speed)
 */
export function applyEWMASmoothing(
  prevSpeedKmh: number,
  newSpeedKmh: number,
  alpha: number
): number {
  const clampedAlpha = Math.max(0.01, Math.min(1.0, alpha));
  return clampedAlpha * newSpeedKmh + (1 - clampedAlpha) * prevSpeedKmh;
}

/**
 * Pure processing function: Evaluates a raw GNSS fix against accuracy thresholds,
 * derives stable speed (handling missing OS speed), eliminates stationary jitter,
 * and applies EWMA smoothing.
 *
 * @param raw Raw location event from device GPS
 * @param prevFix Previous valid GPSFix (if any)
 * @param config Filter parameters
 * @returns Processed GPSFix, or null if the fix is discarded due to poor accuracy
 */
export function processRawLocation(
  raw: RawLocationData,
  prevFix: GPSFix | null,
  config: GPSFilterConfig = DEFAULT_GPS_FILTER_CONFIG
): GPSFix | null {
  const { coords, timestamp } = raw;
  const accuracy = coords.accuracy ?? 999;

  // 1. Accuracy Gating: Discard fixes with unacceptable horizontal uncertainty
  if (accuracy > config.maxAccuracyMeters) {
    return null;
  }

  // 2. Derive speed in km/h
  let rawSpeedKmh = 0;

  if (coords.speed !== null && coords.speed >= 0) {
    // OS provided a valid non-negative speed in m/s
    rawSpeedKmh = coords.speed * 3.6;
  } else if (prevFix !== null) {
    // Fallback: derive from displacement and timestamp delta
    rawSpeedKmh = calculateFallbackSpeedKmh(
      prevFix,
      coords.latitude,
      coords.longitude,
      timestamp
    );
  }

  // Discard wild, impossible spikes (e.g. GPS teleporting across cell towers)
  if (rawSpeedKmh > config.maxPlausibleSpeedKmh) {
    rawSpeedKmh = prevFix ? prevFix.speedKmh : 0;
  }

  // 3. Standstill Jitter Clamping
  // When stationary, GPS noise often reports 0.5 - 1.8 km/h wandering drift
  if (rawSpeedKmh < config.standstillSpeedThresholdKmh) {
    rawSpeedKmh = 0;
  }

  // 4. Smoothing Filter
  let filteredSpeedKmh = rawSpeedKmh;
  if (prevFix !== null) {
    filteredSpeedKmh = applyEWMASmoothing(
      prevFix.speedKmh,
      rawSpeedKmh,
      config.smoothingAlpha
    );

    // If both raw and smoothed are below standstill threshold, snap cleanly to 0
    if (filteredSpeedKmh < config.standstillSpeedThresholdKmh) {
      filteredSpeedKmh = 0;
    }
  }

  return {
    latitude: coords.latitude,
    longitude: coords.longitude,
    speedKmh: Math.round(filteredSpeedKmh * 10) / 10,
    rawSpeedKmh: Math.round(rawSpeedKmh * 10) / 10,
    accuracy: Math.round(accuracy * 10) / 10,
    heading: coords.heading !== null && coords.heading !== undefined && coords.heading >= 0
      ? Math.round(coords.heading)
      : null,
    timestamp,
    isSimulated: false,
  };
}
