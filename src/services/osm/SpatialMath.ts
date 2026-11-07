/**
 * Spatial Mathematics & Geodesic Calculations
 *
 * Provides pure functions for vector projections, geodesic bearings,
 * and point-to-segment orthogonal distance.
 */

import { Point2D, ProjectionResult } from '../../types/osm';

const METERS_PER_DEGREE_LAT = 111139;

/**
 * Calculates initial bearing (azimuth) from point A to point B in degrees (0 - 359).
 * 0 = North, 90 = East, 180 = South, 270 = West.
 */
export function calculateBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;

  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δλ = toRad(lon2 - lon1);

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

  const θ = Math.atan2(y, x);
  return (toDeg(θ) + 360) % 360;
}

/**
 * Orthogonally projects a GPS coordinate P onto a straight road segment AB.
 * Clamps to the segment endpoints (t in [0, 1]).
 *
 * Uses equirectangular flat-Earth projection centered at segment mid-latitude.
 * Extremely fast (< 1 microsecond) and accurate to within centimeters for distances < 1 km.
 *
 * @param point GPS coordinate P (latitude, longitude)
 * @param start Segment start point A
 * @param end Segment end point B
 * @returns Distance in meters, projected Point2D, and fraction t
 */
export function projectPointOntoSegment(
  point: Point2D,
  start: Point2D,
  end: Point2D
): ProjectionResult {
  const midLatRad = ((start.latitude + end.latitude) / 2 * Math.PI) / 180;
  const kx = METERS_PER_DEGREE_LAT * Math.cos(midLatRad);
  const ky = METERS_PER_DEGREE_LAT;

  // Local Cartesian vectors in meters relative to start A
  const bx = (end.longitude - start.longitude) * kx;
  const by = (end.latitude - start.latitude) * ky;

  const px = (point.longitude - start.longitude) * kx;
  const py = (point.latitude - start.latitude) * ky;

  const segmentLengthSq = bx * bx + by * by;

  let t = 0;
  if (segmentLengthSq > 0.000001) {
    t = (px * bx + py * by) / segmentLengthSq;
    // Clamp to segment bounds
    t = Math.max(0, Math.min(1, t));
  }

  // Nearest point C on segment in Cartesian meters
  const cx = t * bx;
  const cy = t * by;

  // Distance from P to C
  const dx = px - cx;
  const dy = py - cy;
  const distanceMeters = Math.sqrt(dx * dx + dy * dy);

  // Convert C back to GPS coordinates
  const projectedPoint: Point2D = {
    latitude: start.latitude + cy / ky,
    longitude: start.longitude + cx / kx,
  };

  return {
    distanceMeters,
    projectedPoint,
    fractionT: t,
  };
}

/**
 * Calculates the angular difference between GPS heading and road segment direction.
 * For two-way roads (oneway = false), accounts for both forward and reverse travel.
 *
 * @param gpsHeading Rider's bearing in degrees (0 - 360)
 * @param roadBearing Road segment azimuth (0 - 360)
 * @param oneway Whether the road is strictly one-way
 * @returns Difference in degrees (0 to 180)
 */
export function calculateHeadingDelta(
  gpsHeading: number,
  roadBearing: number,
  oneway: boolean
): number {
  const angleDiff = (h1: number, h2: number) => {
    return Math.abs(((h1 - h2 + 540) % 360) - 180);
  };

  const forwardDiff = angleDiff(gpsHeading, roadBearing);
  if (oneway) {
    return forwardDiff;
  }

  const reverseDiff = angleDiff(gpsHeading, (roadBearing + 180) % 360);
  return Math.min(forwardDiff, reverseDiff);
}

/**
 * Calculates a bounding box around a GPS coordinate for spatial index filtering.
 *
 * @param center Center coordinate
 * @param radiusMeters Search radius in meters
 */
export function createBoundingBox(center: Point2D, radiusMeters: number) {
  const deltaLat = radiusMeters / METERS_PER_DEGREE_LAT;
  const midLatRad = (center.latitude * Math.PI) / 180;
  const deltaLon = radiusMeters / (METERS_PER_DEGREE_LAT * Math.cos(midLatRad));

  return {
    minLat: center.latitude - deltaLat,
    maxLat: center.latitude + deltaLat,
    minLon: center.longitude - deltaLon,
    maxLon: center.longitude + deltaLon,
  };
}
