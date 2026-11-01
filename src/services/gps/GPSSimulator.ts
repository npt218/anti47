/**
 * GPS Telemetry Simulator
 *
 * Emulates realistic motorcycle GPS telemetry along a pre-defined route
 * in Ho Chi Minh City (Điện Biên Phủ -> Sài Gòn Bridge -> Mai Chí Thọ).
 *
 * Allows desk/indoor verification of speed calculations, thresholds, and alerts.
 */

import { GPSFix } from '../../types/gps';

interface Waypoint {
  lat: number;
  lon: number;
  speedKmh: number;
  heading: number;
}

// Route along Điện Biên Phủ -> Sài Gòn Bridge -> Mai Chí Thọ (Ho Chi Minh City)
const HCMC_MOTORCYCLE_ROUTE: Waypoint[] = [
  { lat: 10.8016, lon: 106.7118, speedKmh: 0, heading: 110 },   // Hàng Xanh red light
  { lat: 10.8008, lon: 106.7142, speedKmh: 28, heading: 112 },  // Accelerating
  { lat: 10.7995, lon: 106.7180, speedKmh: 42, heading: 115 },  // Cruising on Điện Biên Phủ
  { lat: 10.7985, lon: 106.7215, speedKmh: 48, heading: 115 },  // Approaching Sài Gòn Bridge
  { lat: 10.7972, lon: 106.7265, speedKmh: 56, heading: 118 },  // Climbing bridge (limit 60)
  { lat: 10.7963, lon: 106.7302, speedKmh: 64, heading: 118 },  // OVERSPEED test (64 km/h on 60 km/h road)
  { lat: 10.7955, lon: 106.7340, speedKmh: 67, heading: 120 },  // OVERSPEED sustained (67 km/h)
  { lat: 10.7940, lon: 106.7385, speedKmh: 55, heading: 125 },  // Braking / descending bridge
  { lat: 10.7915, lon: 106.7420, speedKmh: 46, heading: 135 },  // Entering Mai Chí Thọ curve
  { lat: 10.7870, lon: 106.7455, speedKmh: 58, heading: 145 },  // Mai Chí Thọ avenue
  { lat: 10.7820, lon: 106.7465, speedKmh: 65, heading: 160 },  // High-speed cruise
  { lat: 10.7780, lon: 106.7450, speedKmh: 35, heading: 175 },  // Decelerating for junction
  { lat: 10.7750, lon: 106.7420, speedKmh: 0, heading: 175 },   // Red light stop
];

export class GPSSimulator {
  private timer: ReturnType<typeof setInterval> | null = null;
  private currentIndex: number = 0;
  private onFixCallback: ((fix: GPSFix) => void) | null = null;

  public start(onFix: (fix: GPSFix) => void, intervalMs: number = 1000): void {
    this.stop();
    this.onFixCallback = onFix;
    this.currentIndex = 0;

    this.emitNextFix();
    this.timer = setInterval(() => {
      this.emitNextFix();
    }, intervalMs);
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.onFixCallback = null;
  }

  public isRunning(): boolean {
    return this.timer !== null;
  }

  private emitNextFix(): void {
    if (!this.onFixCallback) return;

    const waypoint = HCMC_MOTORCYCLE_ROUTE[this.currentIndex];

    // Add tiny GNSS jitter to coordinates and accuracy (3 - 5 meters)
    const accuracy = 3.5 + Math.random() * 2.0;

    const fix: GPSFix = {
      latitude: waypoint.lat,
      longitude: waypoint.lon,
      speedKmh: waypoint.speedKmh,
      rawSpeedKmh: waypoint.speedKmh,
      accuracy: Math.round(accuracy * 10) / 10,
      heading: waypoint.heading,
      timestamp: Date.now(),
      isSimulated: true,
    };

    this.onFixCallback(fix);

    // Loop continuously along the route
    this.currentIndex = (this.currentIndex + 1) % HCMC_MOTORCYCLE_ROUTE.length;
  }
}
