/**
 * Unit Tests for Map Matching Engine
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { MapMatcher } from '../src/services/osm/MapMatcher';
import { InMemoryOSMDatabase } from '../src/services/osm/OSMDatabase';
import { GPSFix } from '../src/types/gps';

describe('MapMatcher', () => {
  let matcher: MapMatcher;
  let inMemoryDb: InMemoryOSMDatabase;

  beforeEach(async () => {
    inMemoryDb = new InMemoryOSMDatabase();
    await inMemoryDb.initialize();
    matcher = new MapMatcher(undefined, inMemoryDb);
    await matcher.initialize();
  });

  it('snaps GPS coordinates on Cầu Sài Gòn correctly', async () => {
    // Coordinate on Cầu Sài Gòn: Lat 10.7963, Lon 106.7302, Heading 118
    const fix: GPSFix = {
      latitude: 10.7963,
      longitude: 106.7302,
      speedKmh: 55,
      rawSpeedKmh: 55,
      accuracy: 4,
      heading: 118,
      timestamp: Date.now(),
      isSimulated: false,
    };

    const match = await matcher.match(fix);

    expect(match.matched).toBe(true);
    expect(match.segment).not.toBeNull();
    expect(match.segment?.name).toBe('Cầu Sài Gòn');
    expect(match.segment?.carriageway).toBe('dual');
    expect(match.distanceMeters).toBeLessThan(10);
    expect(match.confidence).toBeGreaterThan(0.7);
  });

  it('rejects coordinates when rider is off-road (e.g. in river > 100m away)', async () => {
    const fix: GPSFix = {
      latitude: 10.7880,
      longitude: 106.7200, // River coordinate far from any road
      speedKmh: 30,
      rawSpeedKmh: 30,
      accuracy: 5,
      heading: 90,
      timestamp: Date.now(),
      isSimulated: false,
    };

    const match = await matcher.match(fix);

    expect(match.matched).toBe(false);
    expect(match.segment).toBeNull();
  });

  it('snaps accurately on Điện Biên Phủ with high confidence', async () => {
    const fix: GPSFix = {
      latitude: 10.8008,
      longitude: 106.7142,
      speedKmh: 40,
      rawSpeedKmh: 40,
      accuracy: 3.5,
      heading: 112,
      timestamp: Date.now(),
      isSimulated: false,
    };

    const match = await matcher.match(fix);

    expect(match.matched).toBe(true);
    expect(match.segment?.name).toBe('Đường Điện Biên Phủ');
    expect(match.distanceMeters).toBeLessThan(5);
  });

  it('correctly matches residential street in Thảo Điền', async () => {
    const fix: GPSFix = {
      latitude: 10.8055,
      longitude: 106.7365,
      speedKmh: 30,
      rawSpeedKmh: 30,
      accuracy: 4,
      heading: 45,
      timestamp: Date.now(),
      isSimulated: false,
    };

    const match = await matcher.match(fix);

    expect(match.matched).toBe(true);
    expect(match.segment?.name).toBe('Đường Thảo Điền');
    expect(match.segment?.highway).toBe('residential');
    expect(match.segment?.carriageway).toBe('single');
  });
});
