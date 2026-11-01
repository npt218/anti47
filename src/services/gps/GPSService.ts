/**
 * GPS Telemetry Service
 *
 * Coordinates live location tracking via `expo-location` and simulated routes.
 * Maintains telemetry state, passes raw fixes through `GPSFilter`, and
 * broadcasts clean updates to UI and downstream engines (Erlang Pub/Sub model).
 */

import * as Location from 'expo-location';
import {
  DEFAULT_GPS_FILTER_CONFIG,
  GPSFilterConfig,
  GPSFix,
  GPSStatus,
  RawLocationData,
} from '../../types/gps';
import { processRawLocation } from './GPSFilter';
import { GPSSimulator } from './GPSSimulator';

export class GPSService {
  private status: GPSStatus = 'idle';
  private currentFix: GPSFix | null = null;
  private filterConfig: GPSFilterConfig;
  private simulator: GPSSimulator;
  private locationSubscription: Location.LocationSubscription | null = null;

  private fixSubscribers = new Set<(fix: GPSFix) => void>();
  private statusSubscribers = new Set<(status: GPSStatus) => void>();

  constructor(config: GPSFilterConfig = DEFAULT_GPS_FILTER_CONFIG) {
    this.filterConfig = config;
    this.simulator = new GPSSimulator();
  }

  public getStatus(): GPSStatus {
    return this.status;
  }

  public getCurrentFix(): GPSFix | null {
    return this.currentFix;
  }

  public subscribe(callback: (fix: GPSFix) => void): () => void {
    this.fixSubscribers.add(callback);
    if (this.currentFix) {
      callback(this.currentFix);
    }
    return () => {
      this.fixSubscribers.delete(callback);
    };
  }

  public subscribeStatus(callback: (status: GPSStatus) => void): () => void {
    this.statusSubscribers.add(callback);
    callback(this.status);
    return () => {
      this.statusSubscribers.delete(callback);
    };
  }

  public async requestPermissions(): Promise<boolean> {
    this.setStatus('requesting_permission');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        this.setStatus('permission_denied');
        return false;
      }
      return true;
    } catch {
      this.setStatus('error');
      return false;
    }
  }

  public async startLiveTracking(): Promise<void> {
    this.stopTracking();

    const hasPermission = await this.requestPermissions();
    if (!hasPermission) {
      return;
    }

    this.setStatus('searching');

    try {
      this.locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1000,
          distanceInterval: 1, // update every 1 meter
        },
        (location) => {
          this.handleRawLocationUpdate({
            coords: {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              altitude: location.coords.altitude,
              accuracy: location.coords.accuracy,
              altitudeAccuracy: location.coords.altitudeAccuracy,
              heading: location.coords.heading,
              speed: location.coords.speed,
            },
            timestamp: location.timestamp,
          });
        }
      );
    } catch {
      this.setStatus('error');
    }
  }

  public startSimulation(intervalMs: number = 1000): void {
    this.stopTracking();
    this.setStatus('simulating');

    this.simulator.start((simFix) => {
      this.currentFix = simFix;
      this.notifyFix(simFix);
    }, intervalMs);
  }

  public stopTracking(): void {
    if (this.locationSubscription) {
      this.locationSubscription.remove();
      this.locationSubscription = null;
    }

    if (this.simulator.isRunning()) {
      this.simulator.stop();
    }

    this.setStatus('idle');
  }

  private handleRawLocationUpdate(raw: RawLocationData): void {
    const processed = processRawLocation(raw, this.currentFix, this.filterConfig);
    if (processed) {
      this.currentFix = processed;
      if (this.status !== 'locked') {
        this.setStatus('locked');
      }
      this.notifyFix(processed);
    }
  }

  private setStatus(newStatus: GPSStatus): void {
    if (this.status !== newStatus) {
      this.status = newStatus;
      for (const subscriber of this.statusSubscribers) {
        subscriber(newStatus);
      }
    }
  }

  private notifyFix(fix: GPSFix): void {
    for (const subscriber of this.fixSubscribers) {
      subscriber(fix);
    }
  }
}

// Global singleton instance for shared usage
export const gpsService = new GPSService();
