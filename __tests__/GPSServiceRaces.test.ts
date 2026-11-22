/**
 * Concurrency & Race Condition Verification Tests for GPSService
 *
 * Asserts correct behavior of monotonic session generation tokens in
 * startLiveTracking, stopTracking, and startSimulation.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: any) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('GPSService Concurrency & Session Token Protection', () => {
  let GPSServiceClass: typeof import('../src/services/gps/GPSService').GPSService;
  let mockLocation: any;

  beforeEach(() => {
    jest.resetModules();

    mockLocation = {
      requestForegroundPermissionsAsync: jest.fn(),
      requestBackgroundPermissionsAsync: jest.fn().mockImplementation(() => Promise.resolve({ status: 'granted' })),
      watchPositionAsync: jest.fn(),
      hasStartedLocationUpdatesAsync: jest.fn().mockImplementation(() => Promise.resolve(false)),
      stopLocationUpdatesAsync: jest.fn().mockImplementation(() => Promise.resolve()),
      Accuracy: { BestForNavigation: 6 },
    };

    jest.doMock('expo-location', () => mockLocation);
    const mod = require('../src/services/gps/GPSService');
    GPSServiceClass = mod.GPSService;
  });

  it('Scenario 1: Stop during permission request prevents tracking from starting', async () => {
    const permDeferred = createDeferred<any>();
    mockLocation.requestForegroundPermissionsAsync.mockReturnValue(permDeferred.promise);
    const mockSub = { remove: jest.fn() };
    mockLocation.watchPositionAsync.mockResolvedValue(mockSub);

    const service = new GPSServiceClass();

    // 1. User starts tracking
    const startPromise = service.startLiveTracking();
    expect(service.getStatus()).toBe('requesting_permission');

    // 2. User presses stop while permission is pending
    service.stopTracking();
    expect(service.getStatus()).toBe('idle');

    // 3. Permission dialog completes and user grants permission
    permDeferred.resolve({ status: 'granted' });
    await startPromise;

    // VERIFIED: Session token invalidated the stale request
    expect(service.getStatus()).toBe('idle');
    expect(mockLocation.watchPositionAsync).not.toHaveBeenCalled();
  });

  it('Scenario 2: Stop during watchPositionAsync immediately cleans up resolved subscription', async () => {
    mockLocation.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
    const watchDeferred = createDeferred<any>();
    mockLocation.watchPositionAsync.mockReturnValue(watchDeferred.promise);
    const mockSub = { remove: jest.fn() };

    const service = new GPSServiceClass();

    // 1. User starts tracking
    const startPromise = service.startLiveTracking();
    await Promise.resolve();
    await Promise.resolve();

    expect(service.getStatus()).toBe('searching');

    // 2. User presses stop while watchPositionAsync is still awaiting resolution
    service.stopTracking();
    expect(service.getStatus()).toBe('idle');

    // 3. watchPositionAsync finally resolves
    watchDeferred.resolve(mockSub);
    await startPromise;

    // VERIFIED: Stale subscription was recognized and removed immediately, preventing leak
    expect(mockSub.remove).toHaveBeenCalledTimes(1);
    expect(service.getStatus()).toBe('idle');
  });

  it('Scenario 3: Switching to simulation while startLiveTracking is pending prevents corruption', async () => {
    const permDeferred = createDeferred<any>();
    mockLocation.requestForegroundPermissionsAsync.mockReturnValue(permDeferred.promise);
    const mockSub = { remove: jest.fn() };
    mockLocation.watchPositionAsync.mockResolvedValue(mockSub);

    const service = new GPSServiceClass();

    // 1. Start live tracking
    const startPromise = service.startLiveTracking();
    expect(service.getStatus()).toBe('requesting_permission');

    // 2. User switches to Simulation
    service.startSimulation(10000);
    expect(service.getStatus()).toBe('simulating');

    // 3. Pending permission resolves
    permDeferred.resolve({ status: 'granted' });
    await startPromise;

    // VERIFIED: Live tracking did not proceed or overwrite simulation
    expect(mockLocation.watchPositionAsync).not.toHaveBeenCalled();
    expect(service.getStatus()).toBe('simulating');

    service.stopTracking();
  });

  it('Scenario 4: Rapid multiple startLiveTracking calls removes superseded subscriptions', async () => {
    mockLocation.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
    const watchDeferred1 = createDeferred<any>();
    const watchDeferred2 = createDeferred<any>();
    const mockSub1 = { remove: jest.fn() };
    const mockSub2 = { remove: jest.fn() };

    mockLocation.watchPositionAsync
      .mockReturnValueOnce(watchDeferred1.promise)
      .mockReturnValueOnce(watchDeferred2.promise);

    const service = new GPSServiceClass();

    // 1. First start request reaches watchPositionAsync and awaits resolution
    const p1 = service.startLiveTracking();
    await Promise.resolve();
    await Promise.resolve();
    expect(mockLocation.watchPositionAsync).toHaveBeenCalledTimes(1);

    // 2. Second start request is initiated while watchPositionAsync #1 is still pending
    const p2 = service.startLiveTracking();
    await Promise.resolve();
    await Promise.resolve();
    expect(mockLocation.watchPositionAsync).toHaveBeenCalledTimes(2);

    // 3. Resolve both deferred subscriptions
    watchDeferred1.resolve(mockSub1);
    watchDeferred2.resolve(mockSub2);
    await Promise.all([p1, p2]);

    // Request 1 was superseded, so mockSub1 was cleaned up immediately upon resolution
    expect(mockSub1.remove).toHaveBeenCalledTimes(1);

    // Request 2 is the active session
    expect(service.getStatus()).toBe('searching');

    // Now user stops tracking
    service.stopTracking();

    // Both subscriptions are fully cleaned up (no leak)
    expect(mockSub1.remove).toHaveBeenCalledTimes(1);
    expect(mockSub2.remove).toHaveBeenCalledTimes(1);
    expect(service.getStatus()).toBe('idle');
  });

  it('Scenario 4b: Synchronous rapid double-start aborts superseded request before watchPositionAsync is invoked', async () => {
    const permDeferred = createDeferred<any>();
    mockLocation.requestForegroundPermissionsAsync.mockReturnValue(permDeferred.promise);
    const mockSub = { remove: jest.fn() };
    mockLocation.watchPositionAsync.mockResolvedValue(mockSub);

    const service = new GPSServiceClass();

    // Call start twice synchronously before permissions resolve
    const p1 = service.startLiveTracking();
    const p2 = service.startLiveTracking();

    // Resolve permissions
    permDeferred.resolve({ status: 'granted' });
    await Promise.all([p1, p2]);

    // Request 1 aborted immediately after permissions check; only Request 2 invoked watchPositionAsync
    expect(mockLocation.watchPositionAsync).toHaveBeenCalledTimes(1);
    expect(service.getStatus()).toBe('searching');

    service.stopTracking();
    expect(service.getStatus()).toBe('idle');
  });

  it('Scenario 5: Stale currentFix is reset upon stopTracking and new sessions', () => {
    const service = new GPSServiceClass();

    // Simulate an existing fix
    service.startSimulation();
    expect(service.getCurrentFix()).not.toBeNull();

    // User stops tracking
    service.stopTracking();
    expect(service.getStatus()).toBe('idle');

    // VERIFIED: currentFix is reset to null
    expect(service.getCurrentFix()).toBeNull();

    // New subscriber does NOT receive stale fix
    let subscriberReceivedFix: any = null;
    service.subscribe((fix) => {
      subscriberReceivedFix = fix;
    });
    expect(subscriberReceivedFix).toBeNull();
  });
});
