/**
 * Unit Tests for Background Location Tracking & Screen-Off Execution
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { BACKGROUND_LOCATION_TASK, RawLocationData } from '../src/types/gps';

describe('Background Location Tracking (Milestone 5)', () => {
  let GPSServiceClass: typeof import('../src/services/gps/GPSService').GPSService;
  let mockLocation: any;
  let mockTaskManager: any;

  beforeEach(() => {
    jest.resetModules();

    mockLocation = {
      requestForegroundPermissionsAsync: jest.fn().mockImplementation(() => Promise.resolve({ status: 'granted' })),
      requestBackgroundPermissionsAsync: jest.fn().mockImplementation(() => Promise.resolve({ status: 'granted' })),
      startLocationUpdatesAsync: jest.fn().mockImplementation(() => Promise.resolve()),
      stopLocationUpdatesAsync: jest.fn().mockImplementation(() => Promise.resolve()),
      hasStartedLocationUpdatesAsync: jest.fn().mockImplementation(() => Promise.resolve(false)),
      Accuracy: { BestForNavigation: 6 },
      ActivityType: { AutomotiveNavigation: 3 },
    };

    mockTaskManager = {
      defineTask: jest.fn(),
      isTaskRegisteredAsync: jest.fn().mockImplementation(() => Promise.resolve(true)),
    };

    jest.doMock('expo-location', () => mockLocation);
    jest.doMock('expo-task-manager', () => mockTaskManager);

    const mod = require('../src/services/gps/GPSService');
    GPSServiceClass = mod.GPSService;
  });

  it('processes incoming headless background GNSS fixes correctly', () => {
    const service = new GPSServiceClass();
    let subscriberFix: any = null;
    service.subscribe((fix) => {
      subscriberFix = fix;
    });

    const raw: RawLocationData = {
      coords: {
        latitude: 10.7963,
        longitude: 106.7302,
        accuracy: 4,
        speed: 16.67, // ~60 km/h
        heading: 118,
      },
      timestamp: 10000,
    };

    const fix = service.handleBackgroundLocationFix(raw);

    expect(fix).not.toBeNull();
    expect(fix?.speedKmh).toBe(60);
    expect(service.getStatus()).toBe('locked');
    expect(subscriberFix).not.toBeNull();
    expect(subscriberFix?.latitude).toBe(10.7963);
  });

  it('starts native background location with automotive navigation options', async () => {
    const service = new GPSServiceClass();

    const started = await service.startBackgroundTracking();

    expect(started).toBe(true);
    expect(mockLocation.requestBackgroundPermissionsAsync).toHaveBeenCalled();
    expect(mockLocation.startLocationUpdatesAsync).toHaveBeenCalledWith(
      BACKGROUND_LOCATION_TASK,
      expect.objectContaining({
        showsBackgroundLocationIndicator: true,
        pausesUpdatesAutomatically: false,
        activityType: mockLocation.ActivityType.AutomotiveNavigation,
      })
    );
  });

  it('stops background location updates when stopBackgroundTracking is called', async () => {
    mockLocation.hasStartedLocationUpdatesAsync.mockImplementation(() => Promise.resolve(true));
    const service = new GPSServiceClass();

    await service.stopBackgroundTracking();

    expect(mockLocation.stopLocationUpdatesAsync).toHaveBeenCalledWith(BACKGROUND_LOCATION_TASK);
  });

  it('automatically tears down background location tracking when stopTracking is called', async () => {
    mockLocation.hasStartedLocationUpdatesAsync.mockImplementation(() => Promise.resolve(true));
    const service = new GPSServiceClass();

    service.stopTracking();

    // Flush async teardown
    await Promise.resolve();
    expect(mockLocation.stopLocationUpdatesAsync).toHaveBeenCalledWith(BACKGROUND_LOCATION_TASK);
    expect(service.getStatus()).toBe('idle');
  });
});
