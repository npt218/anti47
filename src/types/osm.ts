/**
 * OpenStreetMap Domain Types & Spatial Models
 */

export type HighwayType =
  | 'motorway'
  | 'trunk'
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'residential'
  | 'unclassified'
  | 'service';

export type CarriagewayType = 'dual' | 'single';

export type AreaType = 'urban' | 'rural';

export interface RoadSegment {
  id: number;
  osmWayId: number;
  name: string;
  highway: HighwayType;
  carriageway: CarriagewayType; // 'dual' = median divider present; 'single' = undivided
  area: AreaType;               // 'urban' = built-up area (đông dân cư); 'rural' = outside
  lanes: number | null;
  oneway: boolean;
  maxspeedExplicit: number | null; // Explicit maxspeed tag from OSM (e.g. 50, 60, 70), if any
  startLat: number;
  startLon: number;
  endLat: number;
  endLon: number;
  bearingDeg: number;           // Azimuth angle of segment in degrees (0 - 359)
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

export interface Point2D {
  latitude: number;
  longitude: number;
}

export interface ProjectionResult {
  distanceMeters: number;
  projectedPoint: Point2D;
  fractionT: number; // 0.0 to 1.0 along the segment
}

export interface RoadMatchResult {
  matched: boolean;
  segment: RoadSegment | null;
  distanceMeters: number;
  projectedPoint: Point2D | null;
  headingDeltaDeg: number | null;
  confidence: number; // 0.0 to 1.0
}
