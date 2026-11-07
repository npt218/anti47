/**
 * Ho Chi Minh City Seed Road Dataset
 *
 * Pre-extracted OpenStreetMap road network segments covering key motorcycle
 * transit corridors in Ho Chi Minh City:
 * - Điện Biên Phủ (Bình Thạnh)
 * - Cầu Sài Gòn (Saigon River Bridge)
 * - Xa Lộ Hà Nội / Võ Nguyên Giáp (Thủ Đức)
 * - Đại Lộ Mai Chí Thọ (Thủ Thiêm)
 * - Nguyễn Thị Minh Khai & Hai Bà Trưng (District 1 / 3)
 * - Trần Não (Thảo Điền / An Phú)
 */

import { RoadSegment } from '../../types/osm';
import { calculateBearing } from './SpatialMath';

interface RawRoadInput {
  osmWayId: number;
  name: string;
  highway: RoadSegment['highway'];
  carriageway: RoadSegment['carriageway'];
  area: RoadSegment['area'];
  lanes: number | null;
  oneway: boolean;
  maxspeedExplicit: number | null;
  coords: [number, number][]; // Array of [lat, lon] polyline vertices
}

const RAW_HCMC_ROADS: RawRoadInput[] = [
  // 1. Điện Biên Phủ (Heading towards Sài Gòn Bridge) - Dual Carriageway
  {
    osmWayId: 1001,
    name: 'Đường Điện Biên Phủ',
    highway: 'trunk',
    carriageway: 'dual',
    area: 'urban',
    lanes: 4,
    oneway: true,
    maxspeedExplicit: 60,
    coords: [
      [10.8020, 106.7110],
      [10.8016, 106.7118],
      [10.8008, 106.7142],
      [10.7995, 106.7180],
      [10.7985, 106.7215],
      [10.7978, 106.7245],
    ],
  },

  // 2. Cầu Sài Gòn (Saigon River crossing) - Dual Carriageway Bridge
  {
    osmWayId: 1002,
    name: 'Cầu Sài Gòn',
    highway: 'trunk',
    carriageway: 'dual',
    area: 'urban',
    lanes: 4,
    oneway: true,
    maxspeedExplicit: 60,
    coords: [
      [10.7978, 106.7245],
      [10.7972, 106.7265],
      [10.7963, 106.7302],
      [10.7955, 106.7340],
      [10.7946, 106.7370],
    ],
  },

  // 3. Xa Lộ Hà Nội / Võ Nguyên Giáp (Approaching Mai Chí Thọ junction)
  {
    osmWayId: 1003,
    name: 'Xa Lộ Hà Nội',
    highway: 'trunk',
    carriageway: 'dual',
    area: 'urban',
    lanes: 4,
    oneway: true,
    maxspeedExplicit: 60,
    coords: [
      [10.7946, 106.7370],
      [10.7940, 106.7385],
      [10.7932, 106.7405],
      [10.7925, 106.7420],
      [10.7915, 106.7440],
    ],
  },

  // 4. Đại Lộ Mai Chí Thọ (Major arterial heading south toward Thủ Thiêm) - Dual Carriageway
  {
    osmWayId: 1004,
    name: 'Đại lộ Mai Chí Thọ',
    highway: 'trunk',
    carriageway: 'dual',
    area: 'urban',
    lanes: 4,
    oneway: true,
    maxspeedExplicit: 60,
    coords: [
      [10.7915, 106.7440],
      [10.7890, 106.7450],
      [10.7870, 106.7455],
      [10.7845, 106.7460],
      [10.7820, 106.7465],
      [10.7780, 106.7450],
      [10.7750, 106.7420],
      [10.7720, 106.7370],
    ],
  },

  // 5. Đường Trần Não (Undivided Single Carriageway connecting Mai Chí Thọ to Thảo Điền)
  // According to Circular 31/2019: Undivided road inside built-up area has speed limit 50 km/h
  {
    osmWayId: 1005,
    name: 'Đường Trần Não',
    highway: 'secondary',
    carriageway: 'single',
    area: 'urban',
    lanes: 2,
    oneway: false,
    maxspeedExplicit: 50,
    coords: [
      [10.7915, 106.7440],
      [10.7945, 106.7410],
      [10.7980, 106.7380],
      [10.8010, 106.7360],
    ],
  },

  // 6. Đường Nguyễn Thị Minh Khai (District 1 / 3 arterial)
  {
    osmWayId: 1006,
    name: 'Đường Nguyễn Thị Minh Khai',
    highway: 'primary',
    carriageway: 'dual',
    area: 'urban',
    lanes: 3,
    oneway: true,
    maxspeedExplicit: 60,
    coords: [
      [10.7875, 106.7025],
      [10.7840, 106.6980],
      [10.7800, 106.6935],
      [10.7760, 106.6890],
    ],
  },

  // 7. Đường Lê Lợi (District 1 central boulevard)
  {
    osmWayId: 1007,
    name: 'Đường Lê Lợi',
    highway: 'primary',
    carriageway: 'dual',
    area: 'urban',
    lanes: 3,
    oneway: false,
    maxspeedExplicit: 60,
    coords: [
      [10.7745, 106.7015],
      [10.7730, 106.6995],
      [10.7718, 106.6980],
    ],
  },

  // 8. Khu dân cư Thảo Điền (Residential 2-way street, single carriageway: 50 km/h)
  {
    osmWayId: 1008,
    name: 'Đường Thảo Điền',
    highway: 'residential',
    carriageway: 'single',
    area: 'urban',
    lanes: 2,
    oneway: false,
    maxspeedExplicit: 50,
    coords: [
      [10.8030, 106.7350],
      [10.8055, 106.7365],
      [10.8080, 106.7380],
    ],
  },
];

/**
 * Expands polyline inputs into discrete 2-point RoadSegment edges,
 * computing azimuth angles and spatial bounding boxes for each segment.
 */
export function generateHcmcRoadSegments(): RoadSegment[] {
  const segments: RoadSegment[] = [];
  let idCounter = 1;

  for (const raw of RAW_HCMC_ROADS) {
    for (let i = 0; i < raw.coords.length - 1; i++) {
      const [startLat, startLon] = raw.coords[i];
      const [endLat, endLon] = raw.coords[i + 1];

      const bearingDeg = Math.round(calculateBearing(startLat, startLon, endLat, endLon));

      segments.push({
        id: idCounter++,
        osmWayId: raw.osmWayId,
        name: raw.name,
        highway: raw.highway,
        carriageway: raw.carriageway,
        area: raw.area,
        lanes: raw.lanes,
        oneway: raw.oneway,
        maxspeedExplicit: raw.maxspeedExplicit,
        startLat,
        startLon,
        endLat,
        endLon,
        bearingDeg,
        minLat: Math.min(startLat, endLat),
        maxLat: Math.max(startLat, endLat),
        minLon: Math.min(startLon, endLon),
        maxLon: Math.max(startLon, endLon),
      });
    }
  }

  return segments;
}
