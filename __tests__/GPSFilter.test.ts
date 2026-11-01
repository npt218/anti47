/**
 * Unit Tests for GPS Telemetry Filtering
 */

import { describe, it, expect } from '@jest/globals';
import {
  haversineDistance,
  calculateFallbackSpeedKmh,
  applyEWMASmoothing,
  processRawLocation,
} from '../src/services/gps/GPSFilter';
import { DEFAULT_GPS_FILTER_CONFIG, GPSFix, RawLocationData } from '../src/types/gps';

describe('GPSFilter', () => {
  describe('haversineDistance', () => {
    it('calculates 0 distance between identical coordinates', () => {
      const dist = haversineDistance(10.7725, 106.698, 10.7725, 106.698);
      expect(dist).toBe(0);
    });

    it('calculates approximately correct distance between Ben Thanh Market and Bitexco Tower in HCMC (~750m)', () => {
      // Ben Thanh Market: 10.7725, 106.6980
      // Bitexco Tower: 10.7716, 106.7044
      const dist = haversineDistance(10.7725, 106.698, 10.7716, 106.7044);
      expect(dist).toBeGreaterThan(680);
      expect(dist).toBeLessThan(750);
    });
  });

  describe('calculateFallbackSpeedKmh', () => {
    it('computes speed accurately from distance and time delta', () => {
      // 100 meters in 10 seconds = 10 m/s = 36 km/h
      // Latitude 0.0009 degrees is approx 100 meters
      const prevFix: GPSFix = {
        latitude: 10.772,
        longitude: 106.698,
        speedKmh: 36,
        rawSpeedKmh: 36,
        accuracy: 5,
        heading: 0,
        timestamp: 1000,
        isSimulated: false,
      };

      // Move approx 100 meters north in 10 seconds
      // 1 deg lat ~= 111,139 meters => 100m ~= 0.0008997 degrees
      const speed = calculateFallbackSpeedKmh(prevFix, 10.7728997, 106.698, 11000);
      expect(speed).toBeCloseTo(36.0, 0);
    });

    it('returns 0 when time delta is too small (< 200ms)', () => {
      const prevFix: GPSFix = {
        latitude: 10.772,
        longitude: 106.698,
        speedKmh: 30,
        rawSpeedKmh: 30,
        accuracy: 5,
        heading: null,
        timestamp: 1000,
        isSimulated: false,
      };

      const speed = calculateFallbackSpeedKmh(prevFix, 10.773, 106.698, 1100);
      expect(speed).toBe(0);
    });
  });

  describe('applyEWMASmoothing', () => {
    it('smooths values according to alpha', () => {
      // alpha = 0.5: new = (0.5 * 60) + (0.5 * 40) = 50
      const smoothed = applyEWMASmoothing(40, 60, 0.5);
      expect(smoothed).toBe(50);
    });
  });

  describe('processRawLocation', () => {
    it('discards fixes with horizontal accuracy worse than threshold', () => {
      const raw: RawLocationData = {
        coords: {
          latitude: 10.772,
          longitude: 106.698,
          accuracy: 50, // 50m > 25m limit
          speed: 10,
        },
        timestamp: 1000,
      };

      const fix = processRawLocation(raw, null, DEFAULT_GPS_FILTER_CONFIG);
      expect(fix).toBeNull();
    });

    it('clamps standstill speeds (< 2.0 km/h) to 0 km/h to eliminate stationary GPS jitter', () => {
      const raw: RawLocationData = {
        coords: {
          latitude: 10.772,
          longitude: 106.698,
          accuracy: 5,
          speed: 0.3, // 0.3 m/s = 1.08 km/h < 2.0 km/h
        },
        timestamp: 1000,
      };

      const fix = processRawLocation(raw, null, DEFAULT_GPS_FILTER_CONFIG);
      expect(fix).not.toBeNull();
      expect(fix?.speedKmh).toBe(0);
      expect(fix?.rawSpeedKmh).toBe(0);
    });

    it('converts valid m/s speed to km/h correctly', () => {
      const raw: RawLocationData = {
        coords: {
          latitude: 10.772,
          longitude: 106.698,
          accuracy: 4,
          speed: 15, // 15 m/s = 54 km/h
          heading: 90,
        },
        timestamp: 1000,
      };

      const fix = processRawLocation(raw, null, DEFAULT_GPS_FILTER_CONFIG);
      expect(fix).not.toBeNull();
      expect(fix?.speedKmh).toBe(54);
      expect(fix?.rawSpeedKmh).toBe(54);
      expect(fix?.heading).toBe(90);
    });

    it('uses fallback speed calculation when coords.speed is null', () => {
      const prevFix: GPSFix = {
        latitude: 10.772,
        longitude: 106.698,
        speedKmh: 40,
        rawSpeedKmh: 40,
        accuracy: 4,
        heading: 0,
        timestamp: 1000,
        isSimulated: false,
      };

      const raw: RawLocationData = {
        coords: {
          latitude: 10.7728997, // approx 100m displacement in 10s => ~36 km/h
          longitude: 106.698,
          accuracy: 4,
          speed: null, // OS speed missing
        },
        timestamp: 11000,
      };

      const fix = processRawLocation(raw, prevFix, DEFAULT_GPS_FILTER_CONFIG);
      expect(fix).not.toBeNull();
      expect(fix?.rawSpeedKmh).toBeCloseTo(36.0, 0);
    });
  });
});
