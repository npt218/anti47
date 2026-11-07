/**
 * Map Matching Engine
 *
 * Snaps noisy GPS coordinates to the nearest road segment in the offline
 * OpenStreetMap database using orthogonal projection and heading alignment.
 */

import { GPSFix } from '../../types/gps';
import { RoadMatchResult, RoadSegment } from '../../types/osm';
import { IOSMDatabase, OSMDatabaseFactory } from './OSMDatabase';
import {
  calculateHeadingDelta,
  createBoundingBox,
  projectPointOntoSegment,
} from './SpatialMath';

export interface MapMatcherConfig {
  /** Search radius in meters for spatial index query */
  searchRadiusMeters: number;
  /** Maximum orthogonal distance to snap to a road */
  maxSnapDistanceMeters: number;
  /** Minimum confidence score required to accept a match (0.0 - 1.0) */
  minConfidence: number;
  /** Minimum speed in km/h before enforcing strict heading checks */
  minHeadingCheckSpeedKmh: number;
}

export const DEFAULT_MATCHER_CONFIG: MapMatcherConfig = {
  searchRadiusMeters: 50,
  maxSnapDistanceMeters: 35,
  minConfidence: 0.35,
  minHeadingCheckSpeedKmh: 6.0,
};

export class MapMatcher {
  private db: IOSMDatabase | null = null;
  private config: MapMatcherConfig;

  constructor(config: MapMatcherConfig = DEFAULT_MATCHER_CONFIG, db?: IOSMDatabase) {
    this.config = config;
    if (db) {
      this.db = db;
    }
  }

  public async initialize(): Promise<void> {
    if (!this.db) {
      this.db = await OSMDatabaseFactory.getInstance();
    }
  }

  /**
   * Snaps a GPS telemetry fix to the most probable road segment.
   *
   * @param fix Processed GPS fix
   * @returns Match result with road segment, projected coordinate, and confidence
   */
  public async match(fix: GPSFix): Promise<RoadMatchResult> {
    if (!this.db) {
      await this.initialize();
    }

    const center = { latitude: fix.latitude, longitude: fix.longitude };
    const bbox = createBoundingBox(center, this.config.searchRadiusMeters);

    const candidates = await this.db!.queryCandidates(bbox);
    if (candidates.length === 0) {
      return this.emptyResult();
    }

    let bestSegment: RoadSegment | null = null;
    let bestDistance = Infinity;
    let bestProjectedPoint = null;
    let bestHeadingDelta: number | null = null;
    let bestScore = -1;

    for (const segment of candidates) {
      const start = { latitude: segment.startLat, longitude: segment.startLon };
      const end = { latitude: segment.endLat, longitude: segment.endLon };

      const projection = projectPointOntoSegment(center, start, end);

      // Discard candidates outside maximum snapping threshold
      if (projection.distanceMeters > this.config.maxSnapDistanceMeters) {
        continue;
      }

      // Evaluate heading compatibility if rider is moving
      let headingDelta: number | null = null;
      let headingScore = 0.8; // neutral default when stopped or heading unavailable

      if (
        fix.heading !== null &&
        fix.speedKmh >= this.config.minHeadingCheckSpeedKmh
      ) {
        headingDelta = calculateHeadingDelta(
          fix.heading,
          segment.bearingDeg,
          segment.oneway
        );

        // Strict rejection if driving wrong way down a one-way road (> 90 deg off)
        if (segment.oneway && headingDelta > 85) {
          continue;
        }

        // Cosine-based heading alignment score in [0, 1]
        const rad = (headingDelta * Math.PI) / 180;
        headingScore = Math.max(0, Math.cos(rad));
      }

      // Distance score: closer to centerline = higher score
      const distanceScore = Math.max(
        0,
        1 - projection.distanceMeters / this.config.maxSnapDistanceMeters
      );

      // Combined confidence score (60% distance weight, 40% heading weight)
      const totalScore = 0.6 * distanceScore + 0.4 * headingScore;

      if (totalScore > bestScore) {
        bestScore = totalScore;
        bestSegment = segment;
        bestDistance = projection.distanceMeters;
        bestProjectedPoint = projection.projectedPoint;
        bestHeadingDelta = headingDelta;
      }
    }

    if (!bestSegment || bestScore < this.config.minConfidence) {
      return this.emptyResult();
    }

    return {
      matched: true,
      segment: bestSegment,
      distanceMeters: Math.round(bestDistance * 10) / 10,
      projectedPoint: bestProjectedPoint,
      headingDeltaDeg: bestHeadingDelta !== null ? Math.round(bestHeadingDelta) : null,
      confidence: Math.round(bestScore * 100) / 100,
    };
  }

  private emptyResult(): RoadMatchResult {
    return {
      matched: false,
      segment: null,
      distanceMeters: Infinity,
      projectedPoint: null,
      headingDeltaDeg: null,
      confidence: 0,
    };
  }
}

export const mapMatcher = new MapMatcher();
