/**
 * Unit Tests for Spatial Mathematics & Geodesic Projection
 */

import { describe, it, expect } from '@jest/globals';
import {
  calculateBearing,
  projectPointOntoSegment,
  calculateHeadingDelta,
  createBoundingBox,
} from '../src/services/osm/SpatialMath';

describe('SpatialMath', () => {
  describe('calculateBearing', () => {
    it('calculates cardinal bearings correctly', () => {
      // Due North
      const north = calculateBearing(10.0, 106.0, 10.01, 106.0);
      expect(north).toBeCloseTo(0, 0);

      // Due East
      const east = calculateBearing(10.0, 106.0, 10.0, 106.01);
      expect(east).toBeCloseTo(90, 0);

      // Due South
      const south = calculateBearing(10.01, 106.0, 10.0, 106.0);
      expect(south).toBeCloseTo(180, 0);

      // Due West
      const west = calculateBearing(10.0, 106.01, 10.0, 106.0);
      expect(west).toBeCloseTo(270, 0);
    });
  });

  describe('projectPointOntoSegment', () => {
    const start = { latitude: 10.797, longitude: 106.726 }; // Sài Gòn Bridge West
    const end = { latitude: 10.795, longitude: 106.734 };   // Sài Gòn Bridge East

    it('projects a point directly on the segment with near zero distance', () => {
      // Midpoint
      const mid = {
        latitude: (start.latitude + end.latitude) / 2,
        longitude: (start.longitude + end.longitude) / 2,
      };

      const result = projectPointOntoSegment(mid, start, end);
      expect(result.distanceMeters).toBeLessThan(0.5);
      expect(result.fractionT).toBeCloseTo(0.5, 2);
    });

    it('measures perpendicular distance accurately for off-road point', () => {
      const mid = {
        latitude: (start.latitude + end.latitude) / 2,
        longitude: (start.longitude + end.longitude) / 2,
      };

      // Offset slightly in latitude (~22 meters)
      // 1 deg lat ~= 111139 meters => 0.0002 deg ~= 22.2 meters
      const offsetPoint = {
        latitude: mid.latitude + 0.0002,
        longitude: mid.longitude,
      };

      const result = projectPointOntoSegment(offsetPoint, start, end);
      expect(result.distanceMeters).toBeGreaterThan(15);
      expect(result.distanceMeters).toBeLessThan(25);
    });

    it('clamps to start (fractionT = 0) when point is before the start', () => {
      const beforeStart = { latitude: 10.800, longitude: 106.720 };
      const result = projectPointOntoSegment(beforeStart, start, end);
      expect(result.fractionT).toBe(0);
      expect(result.projectedPoint.latitude).toBeCloseTo(start.latitude, 5);
      expect(result.projectedPoint.longitude).toBeCloseTo(start.longitude, 5);
    });

    it('clamps to end (fractionT = 1) when point is past the end', () => {
      const pastEnd = { latitude: 10.790, longitude: 106.740 };
      const result = projectPointOntoSegment(pastEnd, start, end);
      expect(result.fractionT).toBe(1);
      expect(result.projectedPoint.latitude).toBeCloseTo(end.latitude, 5);
      expect(result.projectedPoint.longitude).toBeCloseTo(end.longitude, 5);
    });
  });

  describe('calculateHeadingDelta', () => {
    it('returns 0 when heading matches segment bearing', () => {
      const delta = calculateHeadingDelta(115, 115, true);
      expect(delta).toBe(0);
    });

    it('recognizes reverse travel on two-way roads as aligned (0 deg delta)', () => {
      // Road bearing 90 (East), Rider traveling 270 (West)
      const deltaTwoWay = calculateHeadingDelta(270, 90, false);
      expect(deltaTwoWay).toBe(0);
    });

    it('penalizes reverse travel on one-way roads (180 deg delta)', () => {
      // One-way road heading East (90), Rider heading West (270) = wrong way!
      const deltaOneWay = calculateHeadingDelta(270, 90, true);
      expect(deltaOneWay).toBe(180);
    });

    it('calculates acute angle difference correctly', () => {
      // Rider heading 120, Road 90 -> 30 deg difference
      const delta = calculateHeadingDelta(120, 90, true);
      expect(delta).toBe(30);
    });
  });

  describe('createBoundingBox', () => {
    it('creates bounding box enclosing search radius', () => {
      const center = { latitude: 10.8, longitude: 106.7 };
      const bbox = createBoundingBox(center, 50);

      expect(bbox.minLat).toBeLessThan(center.latitude);
      expect(bbox.maxLat).toBeGreaterThan(center.latitude);
      expect(bbox.minLon).toBeLessThan(center.longitude);
      expect(bbox.maxLon).toBeGreaterThan(center.longitude);
    });
  });
});
