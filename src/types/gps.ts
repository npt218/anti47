/**
 * GPS Telemetry Type Definitions
 * 
 * Provides types for GPS fixes, telemetry status, and filter configurations.
 */

export interface RawCoordinates {
  latitude: number;
  longitude: number;
  altitude?: number | null;
  accuracy: number | null;
  altitudeAccuracy?: number | null;
  heading?: number | null;
  speed: number | null; // meters per second from OS (can be negative or null when stationary/unsupported)
}

export interface RawLocationData {
  coords: RawCoordinates;
  timestamp: number; // epoch ms
}

export interface GPSFix {
  latitude: number;
  longitude: number;
  speedKmh: number;        // Filtered and smoothed speed in km/h
  rawSpeedKmh: number;     // Unfiltered speed in km/h (0 if unavailable)
  accuracy: number;        // Horizontal accuracy in meters
  heading: number | null;  // Bearing in degrees (0-360)
  timestamp: number;       // Milliseconds epoch
  isSimulated: boolean;
}

export type GPSStatus =
  | 'idle'
  | 'requesting_permission'
  | 'permission_denied'
  | 'searching'
  | 'locked'
  | 'simulating'
  | 'error';

export interface GPSFilterConfig {
  /** Maximum acceptable horizontal accuracy in meters (fixes with worse accuracy are discarded or marked stale) */
  maxAccuracyMeters: number;
  /** Speeds below this threshold in km/h are clamped to 0 to prevent stationary GPS drift/jitter */
  standstillSpeedThresholdKmh: number;
  /** Exponential Weighted Moving Average (EWMA) smoothing factor alpha (0 < alpha <= 1). Closer to 1 = more responsive, closer to 0 = smoother */
  smoothingAlpha: number;
  /** Maximum plausible motorcycle speed in km/h to reject crazy GPS jumps (e.g. 180 km/h) */
  maxPlausibleSpeedKmh: number;
}

export const DEFAULT_GPS_FILTER_CONFIG: GPSFilterConfig = {
  maxAccuracyMeters: 25,
  standstillSpeedThresholdKmh: 2.0,
  smoothingAlpha: 0.45,
  maxPlausibleSpeedKmh: 160,
};
