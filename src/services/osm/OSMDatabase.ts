/**
 * Offline OpenStreetMap Database & Spatial Storage
 *
 * Implements local persistence and bounding-box spatial queries for road segments.
 * Uses `expo-sqlite` on mobile devices with an automated in-memory fallback for
 * deterministic unit testing in Jest/Node environments.
 */

import { RoadSegment } from '../../types/osm';
import { generateHcmcRoadSegments } from './hcmcRoadsData';

export interface BoundingBoxQuery {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

export interface IOSMDatabase {
  initialize(): Promise<void>;
  queryCandidates(bbox: BoundingBoxQuery): Promise<RoadSegment[]>;
  getSegmentCount(): Promise<number>;
}

/**
 * In-Memory Spatial Database (used in unit tests and web previews)
 */
export class InMemoryOSMDatabase implements IOSMDatabase {
  private segments: RoadSegment[] = [];

  public async initialize(): Promise<void> {
    if (this.segments.length === 0) {
      this.segments = generateHcmcRoadSegments();
    }
  }

  public async queryCandidates(bbox: BoundingBoxQuery): Promise<RoadSegment[]> {
    return this.segments.filter((s) => {
      return (
        s.maxLat >= bbox.minLat &&
        s.minLat <= bbox.maxLat &&
        s.maxLon >= bbox.minLon &&
        s.minLon <= bbox.maxLon
      );
    });
  }

  public async getSegmentCount(): Promise<number> {
    return this.segments.length;
  }
}

/**
 * Mobile SQLite Spatial Database using `expo-sqlite`
 */
export class SQLiteOSMDatabase implements IOSMDatabase {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private db: any = null;
  private isInitialized = false;

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Dynamic import to allow graceful execution in environments without native expo-sqlite
      const SQLite = await import('expo-sqlite');
      this.db = await SQLite.openDatabaseAsync('moto_alert_roads.db');

      await this.db.execAsync(`
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;

        CREATE TABLE IF NOT EXISTS road_segments (
          id INTEGER PRIMARY KEY,
          osm_way_id INTEGER,
          name TEXT,
          highway TEXT,
          carriageway TEXT,
          area TEXT,
          lanes INTEGER,
          oneway INTEGER,
          maxspeed_explicit INTEGER,
          start_lat REAL,
          start_lon REAL,
          end_lat REAL,
          end_lon REAL,
          bearing_deg REAL,
          min_lat REAL,
          max_lat REAL,
          min_lon REAL,
          max_lon REAL
        );

        CREATE INDEX IF NOT EXISTS idx_roads_spatial
        ON road_segments (min_lat, max_lat, min_lon, max_lon);
      `);

      // Check if table is already seeded
      const countResult = await this.db.getFirstAsync(
        'SELECT COUNT(*) as count FROM road_segments;'
      );

      if (!countResult || (countResult as { count: number }).count === 0) {
        await this.seedInitialData();
      }

      this.isInitialized = true;
    } catch (err) {
      console.warn('Native SQLite unavailable, falling back to in-memory store:', err);
      throw err;
    }
  }

  private async seedInitialData(): Promise<void> {
    const seedSegments = generateHcmcRoadSegments();

    await this.db.withTransactionAsync(async () => {
      for (const s of seedSegments) {
        await this.db.runAsync(
          `INSERT OR REPLACE INTO road_segments (
            id, osm_way_id, name, highway, carriageway, area, lanes, oneway,
            maxspeed_explicit, start_lat, start_lon, end_lat, end_lon,
            bearing_deg, min_lat, max_lat, min_lon, max_lon
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            s.id,
            s.osmWayId,
            s.name,
            s.highway,
            s.carriageway,
            s.area,
            s.lanes,
            s.oneway ? 1 : 0,
            s.maxspeedExplicit,
            s.startLat,
            s.startLon,
            s.endLat,
            s.endLon,
            s.bearingDeg,
            s.minLat,
            s.maxLat,
            s.minLon,
            s.maxLon,
          ]
        );
      }
    });
  }

  public async queryCandidates(bbox: BoundingBoxQuery): Promise<RoadSegment[]> {
    if (!this.db) {
      return [];
    }

    const rows = await this.db.getAllAsync(
      `SELECT * FROM road_segments
       WHERE max_lat >= ? AND min_lat <= ?
         AND max_lon >= ? AND min_lon <= ?;`,
      [bbox.minLat, bbox.maxLat, bbox.minLon, bbox.maxLon]
    );

    // Map SQLite rows back to RoadSegment model
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return rows.map((r: any) => ({
      id: r.id,
      osmWayId: r.osm_way_id,
      name: r.name,
      highway: r.highway,
      carriageway: r.carriageway,
      area: r.area,
      lanes: r.lanes,
      oneway: r.oneway === 1,
      maxspeedExplicit: r.maxspeed_explicit,
      startLat: r.start_lat,
      startLon: r.start_lon,
      endLat: r.end_lat,
      endLon: r.end_lon,
      bearingDeg: r.bearing_deg,
      minLat: r.min_lat,
      maxLat: r.max_lat,
      minLon: r.min_lon,
      maxLon: r.max_lon,
    }));
  }

  public async getSegmentCount(): Promise<number> {
    if (!this.db) return 0;
    const res = await this.db.getFirstAsync('SELECT COUNT(*) as count FROM road_segments;');
    return res ? (res as { count: number }).count : 0;
  }
}

/**
 * Factory creating the active database instance with automated fallback
 */
export class OSMDatabaseFactory {
  private static instance: IOSMDatabase | null = null;

  public static async getInstance(): Promise<IOSMDatabase> {
    if (this.instance) {
      return this.instance;
    }

    // Attempt to use native SQLite
    const sqliteDb = new SQLiteOSMDatabase();
    try {
      await sqliteDb.initialize();
      this.instance = sqliteDb;
      return sqliteDb;
    } catch {
      // If native SQLite is unavailable (e.g. running in Jest or Web preview), use InMemory
      const inMemory = new InMemoryOSMDatabase();
      await inMemory.initialize();
      this.instance = inMemory;
      return inMemory;
    }
  }

  /**
   * Reset instance (useful for unit tests)
   */
  public static reset(instance?: IOSMDatabase): void {
    this.instance = instance ?? null;
  }
}
