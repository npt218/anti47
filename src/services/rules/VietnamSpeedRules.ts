/**
 * Vietnam Speed Limit Rule Engine
 *
 * Implements statutory speed limits according to Vietnam Ministry of Transport
 * regulations (Circular 31/2019/TT-BGTVT) with road sign precedence.
 */

import { RoadSegment } from '../../types/osm';
import { SpeedLimitResult, VehicleType } from '../../types/rules';

/**
 * Determines whether a road qualifies as a divided / dual carriageway
 * under Circular 31/2019/TT-BGTVT.
 *
 * A road qualifies if:
 * 1. It is explicitly tagged with `carriageway === 'dual'` (median divider present), OR
 * 2. It is a one-way road with 2 or more motor lanes (`oneway === true` and `lanes >= 2`).
 */
export function isDualOrMultiLaneOneway(segment: RoadSegment): boolean {
  if (segment.carriageway === 'dual') {
    return true;
  }
  if (segment.oneway && segment.lanes !== null && segment.lanes >= 2) {
    return true;
  }
  return false;
}

/**
 * Evaluates the legal motorcycle speed limit for a given road segment.
 *
 * Precedence:
 * 1. Moped statutory cap (Article 8: maximum 40 km/h everywhere)
 * 2. Explicit road sign tag (e.g. maxspeed:motorcycle / maxspeed)
 * 3. Circular 31/2019/TT-BGTVT statutory rules based on area & carriageway
 * 4. Default safe fallback (50 km/h) if off-road or unclassified
 *
 * @param segment Matched RoadSegment, or null if off-road / unmatched
 * @param vehicleType Vehicle category ('motorcycle' or 'moped')
 * @returns SpeedLimitResult with speed in km/h, source, and legal citation
 */
export function determineSpeedLimit(
  segment: RoadSegment | null,
  vehicleType: VehicleType = 'motorcycle'
): SpeedLimitResult {
  // Article 8: Xe gắn máy (mopeds / electric scooters <= 4kW) are capped at 40 km/h everywhere
  if (vehicleType === 'moped') {
    if (segment && segment.maxspeedExplicit && segment.maxspeedExplicit < 40) {
      return {
        limitKmh: segment.maxspeedExplicit,
        source: 'explicit_sign',
        reason: `Biển báo tốc độ: ${segment.maxspeedExplicit} km/h`,
      };
    }
    return {
      limitKmh: 40,
      source: 'circular_31_statutory',
      reason: 'Thông tư 31/2019 - Điều 8 (Xe gắn máy tối đa 40 km/h)',
    };
  }

  // Fallback if rider is off-road or in an unmapped alley
  if (!segment) {
    return {
      limitKmh: 50,
      source: 'default_fallback',
      reason: 'Mặc định an toàn (Đô thị chưa định danh)',
    };
  }

  // 1. Explicit Road Sign Overrides
  if (segment.maxspeedExplicit && segment.maxspeedExplicit > 0) {
    return {
      limitKmh: segment.maxspeedExplicit,
      source: 'explicit_sign',
      reason: `Biển báo hiệu: ${segment.maxspeedExplicit} km/h`,
    };
  }

  // 2. Statutory Circular 31/2019 Rules
  const isDivided = isDualOrMultiLaneOneway(segment);

  if (segment.area === 'urban') {
    // Article 6: Trong khu vực đông dân cư
    if (isDivided) {
      return {
        limitKmh: 60,
        source: 'circular_31_statutory',
        reason: 'Thông tư 31/2019 - Điều 6 (Đô thị, đường đôi / 1 chiều ≥2 làn)',
      };
    } else {
      return {
        limitKmh: 50,
        source: 'circular_31_statutory',
        reason: 'Thông tư 31/2019 - Điều 6 (Đô thị, đường 2 chiều không dải phân cách)',
      };
    }
  } else {
    // Article 7: Ngoài khu vực đông dân cư
    if (isDivided) {
      return {
        limitKmh: 70,
        source: 'circular_31_statutory',
        reason: 'Thông tư 31/2019 - Điều 7 (Ngoài đô thị, đường đôi / 1 chiều ≥2 làn)',
      };
    } else {
      return {
        limitKmh: 60,
        source: 'circular_31_statutory',
        reason: 'Thông tư 31/2019 - Điều 7 (Ngoài đô thị, đường 2 chiều không dải phân cách)',
      };
    }
  }
}
