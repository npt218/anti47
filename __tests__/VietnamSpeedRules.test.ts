/**
 * Unit Tests for Vietnam Speed Limit Rules (Circular 31/2019/TT-BGTVT)
 */

import { describe, it, expect } from '@jest/globals';
import { determineSpeedLimit, isDualOrMultiLaneOneway } from '../src/services/rules/VietnamSpeedRules';
import { RoadSegment } from '../src/types/osm';

describe('VietnamSpeedRules', () => {
  const baseSegment: RoadSegment = {
    id: 1,
    osmWayId: 100,
    name: 'Đường Thử Nghiệm',
    highway: 'primary',
    carriageway: 'dual',
    area: 'urban',
    lanes: 4,
    oneway: true,
    maxspeedExplicit: null,
    startLat: 10.77,
    startLon: 106.69,
    endLat: 10.78,
    endLon: 106.70,
    bearingDeg: 45,
    minLat: 10.77,
    maxLat: 10.78,
    minLon: 106.69,
    maxLon: 106.70,
  };

  describe('Circular 31/2019/TT-BGTVT Statutory Rules', () => {
    it('applies 60 km/h for motorcycles inside built-up areas on divided / dual carriageways', () => {
      const segment: RoadSegment = {
        ...baseSegment,
        area: 'urban',
        carriageway: 'dual',
        maxspeedExplicit: null,
      };

      const result = determineSpeedLimit(segment, 'motorcycle');
      expect(result.limitKmh).toBe(60);
      expect(result.source).toBe('circular_31_statutory');
    });

    it('applies 50 km/h for motorcycles inside built-up areas on undivided single carriageways', () => {
      const segment: RoadSegment = {
        ...baseSegment,
        area: 'urban',
        carriageway: 'single',
        oneway: false,
        maxspeedExplicit: null,
      };

      const result = determineSpeedLimit(segment, 'motorcycle');
      expect(result.limitKmh).toBe(50);
      expect(result.source).toBe('circular_31_statutory');
    });

    it('applies 70 km/h for motorcycles outside built-up areas on divided / dual carriageways', () => {
      const segment: RoadSegment = {
        ...baseSegment,
        area: 'rural',
        carriageway: 'dual',
        maxspeedExplicit: null,
      };

      const result = determineSpeedLimit(segment, 'motorcycle');
      expect(result.limitKmh).toBe(70);
      expect(result.source).toBe('circular_31_statutory');
    });

    it('applies 60 km/h for motorcycles outside built-up areas on undivided single carriageways', () => {
      const segment: RoadSegment = {
        ...baseSegment,
        area: 'rural',
        carriageway: 'single',
        oneway: false,
        maxspeedExplicit: null,
      };

      const result = determineSpeedLimit(segment, 'motorcycle');
      expect(result.limitKmh).toBe(60);
      expect(result.source).toBe('circular_31_statutory');
    });

    it('treats one-way roads with >= 2 lanes as dual carriageway equivalent (60 km/h in urban)', () => {
      const segment: RoadSegment = {
        ...baseSegment,
        area: 'urban',
        carriageway: 'single',
        oneway: true,
        lanes: 3,
        maxspeedExplicit: null,
      };

      expect(isDualOrMultiLaneOneway(segment)).toBe(true);
      const result = determineSpeedLimit(segment, 'motorcycle');
      expect(result.limitKmh).toBe(60);
    });
  });

  describe('Explicit Road Sign Overrides', () => {
    it('prioritizes explicit maxspeed road signs over statutory defaults', () => {
      const segment: RoadSegment = {
        ...baseSegment,
        area: 'urban',
        carriageway: 'dual', // Default would be 60 km/h
        maxspeedExplicit: 80, // Posted sign 80 km/h
      };

      const result = determineSpeedLimit(segment, 'motorcycle');
      expect(result.limitKmh).toBe(80);
      expect(result.source).toBe('explicit_sign');
    });
  });

  describe('Vehicle Type Restrictions', () => {
    it('caps mopeds (xe gắn máy) at 40 km/h under Article 8 even on 60 km/h roads', () => {
      const segment: RoadSegment = {
        ...baseSegment,
        area: 'urban',
        carriageway: 'dual',
        maxspeedExplicit: 60,
      };

      const result = determineSpeedLimit(segment, 'moped');
      expect(result.limitKmh).toBe(40);
      expect(result.source).toBe('circular_31_statutory');
    });
  });

  describe('Unmapped / Off-road Fallback', () => {
    it('provides a safe 50 km/h urban default when road segment is null', () => {
      const result = determineSpeedLimit(null, 'motorcycle');
      expect(result.limitKmh).toBe(50);
      expect(result.source).toBe('default_fallback');
    });
  });
});
