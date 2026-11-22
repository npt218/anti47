/**
 * Unit Tests for Alert & Notification Service
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

const mockVibrate = jest.fn();
const mockCancel = jest.fn();
const mockDismissAll = jest.fn().mockImplementation(() => Promise.resolve());
const mockSchedule = jest.fn().mockImplementation(() => Promise.resolve('test-id'));

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  Vibration: {
    vibrate: mockVibrate,
    cancel: mockCancel,
  },
}));

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn().mockImplementation(() => Promise.resolve({})),
  scheduleNotificationAsync: mockSchedule,
  dismissAllNotificationsAsync: mockDismissAll,
  getPermissionsAsync: jest.fn().mockImplementation(() => Promise.resolve({ status: 'granted' })),
  requestPermissionsAsync: jest.fn().mockImplementation(() => Promise.resolve({ status: 'granted' })),
  AndroidImportance: { MAX: 5 },
  AndroidNotificationPriority: { MAX: 'max' },
}));

import {
  shouldTriggerAlert,
  createNotificationPayload,
  NotificationService,
} from '../src/services/notifications/NotificationService';
import { OverspeedState } from '../src/types/rules';
import { DEFAULT_NOTIFICATION_SETTINGS } from '../src/types/notifications';

describe('NotificationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('shouldTriggerAlert', () => {
    it('returns false for normal and caution levels', () => {
      expect(shouldTriggerAlert('normal', 'normal', 10000, 0)).toBe(false);
      expect(shouldTriggerAlert('caution', 'normal', 10000, 0)).toBe(false);
      expect(shouldTriggerAlert('caution', 'caution', 10000, 0)).toBe(false);
    });

    it('triggers immediately on transition from normal/caution to warning', () => {
      const trigger = shouldTriggerAlert('warning', 'normal', 10000, 0);
      expect(trigger).toBe(true);

      const triggerFromCaution = shouldTriggerAlert('warning', 'caution', 10000, 0);
      expect(triggerFromCaution).toBe(true);
    });

    it('triggers immediately when escalating to critical level', () => {
      // Escalating from warning to critical bypasses warning cooldown
      const trigger = shouldTriggerAlert('critical', 'warning', 15000, 10000); // 5s elapsed
      expect(trigger).toBe(true);
    });

    it('enforces warning repeat cadence (4 seconds for Xiaomi Band awareness)', () => {
      // Last alert was at t = 10,000ms
      // At t = 12,000ms (2s elapsed < 4s cadence) -> should be suppressed
      const triggerSuppressed = shouldTriggerAlert('warning', 'warning', 12000, 10000);
      expect(triggerSuppressed).toBe(false);

      // At t = 14,000ms (4s elapsed >= 4s cadence) -> should trigger repeat
      const triggerAllowed = shouldTriggerAlert('warning', 'warning', 14000, 10000);
      expect(triggerAllowed).toBe(true);
    });

    it('enforces critical repeat cadence (3 seconds)', () => {
      // Last critical alert at t = 10,000ms
      // At t = 12,000ms (2s < 3s) -> suppressed
      expect(shouldTriggerAlert('critical', 'critical', 12000, 10000)).toBe(false);

      // At t = 13,000ms (3s >= 3s) -> allowed
      expect(shouldTriggerAlert('critical', 'critical', 13000, 10000)).toBe(true);
    });
  });

  describe('createNotificationPayload', () => {
    it('generates warning payload with road name and speed delta', () => {
      const overspeed: OverspeedState = {
        level: 'warning',
        currentSpeedKmh: 64.2,
        speedLimitKmh: 60,
        deltaKmh: 4.2,
        isOverspeed: true,
        overspeedDurationMs: 2000,
        reason: 'Đô thị, đường đôi',
      };

      const payload = createNotificationPayload(overspeed, 'Cầu Sài Gòn', 50000);
      expect(payload.title).toContain('CẢNH BÁO: 64 / 60 KM/H');
      expect(payload.body).toContain('Cầu Sài Gòn');
      expect(payload.body).toContain('+4.2 km/h');
      expect(payload.level).toBe('warning');
    });

    it('generates critical danger payload for severe overspeed', () => {
      const overspeed: OverspeedState = {
        level: 'critical',
        currentSpeedKmh: 75,
        speedLimitKmh: 60,
        deltaKmh: 15,
        isOverspeed: true,
        overspeedDurationMs: 3000,
        reason: 'Đô thị',
      };

      const payload = createNotificationPayload(overspeed, 'Đại lộ Mai Chí Thọ', 60000);
      expect(payload.title).toContain('NGUY HIỂM: 75 / 60 KM/H');
      expect(payload.body).toContain('Đại lộ Mai Chí Thọ');
      expect(payload.level).toBe('critical');
    });
  });

  describe('Continuous Vibration & Notification Lifecycle', () => {
    let service: NotificationService;

    beforeEach(() => {
      service = new NotificationService({
        ...DEFAULT_NOTIFICATION_SETTINGS,
        warningCooldownMs: 4000,
        criticalCooldownMs: 3000,
      });
    });

    afterEach(() => {
      service.stopContinuousVibration();
    });

    it('starts continuous vibration when entering warning and stops on recovery', async () => {
      const warningState: OverspeedState = {
        level: 'warning',
        currentSpeedKmh: 65,
        speedLimitKmh: 60,
        deltaKmh: 5,
        isOverspeed: true,
        overspeedDurationMs: 2000,
        reason: 'Test',
      };

      // 1. Enter warning -> starts continuous vibration
      await service.handleOverspeedUpdate(warningState, 'Cầu Sài Gòn', 10000);
      expect(mockVibrate).toHaveBeenCalled();

      // 2. Rider slows down below limit -> normal
      const normalState: OverspeedState = {
        level: 'normal',
        currentSpeedKmh: 55,
        speedLimitKmh: 60,
        deltaKmh: -5,
        isOverspeed: false,
        overspeedDurationMs: 0,
        reason: 'Test',
      };

      await service.handleOverspeedUpdate(normalState, 'Cầu Sài Gòn', 15000);

      // Continuous vibration should be canceled immediately!
      expect(mockCancel).toHaveBeenCalled();

      // Delivered notifications should be cleared from lock screen
      expect(mockDismissAll).toHaveBeenCalled();
    });

    it('handles repeated overspeed notifications at rapid 4s cadence for Xiaomi Band', async () => {
      const warningState: OverspeedState = {
        level: 'warning',
        currentSpeedKmh: 65,
        speedLimitKmh: 60,
        deltaKmh: 5,
        isOverspeed: true,
        overspeedDurationMs: 2000,
        reason: 'Test',
      };

      // 1. Initial alert at t = 10,000ms
      const alerted1 = await service.handleOverspeedUpdate(warningState, 'Cầu Sài Gòn', 10000);
      expect(alerted1).toBe(true);

      // 2. 2 seconds later (t = 12,000ms) -> throttled (< 4s)
      const alerted2 = await service.handleOverspeedUpdate(warningState, 'Cầu Sài Gòn', 12000);
      expect(alerted2).toBe(false);

      // 3. 4 seconds later (t = 14,000ms) -> fires repeat notification to buzz band
      const alerted3 = await service.handleOverspeedUpdate(warningState, 'Cầu Sài Gòn', 14000);
      expect(alerted3).toBe(true);
    });

    it('stopAllAlerts cancels vibration and clears notifications', async () => {
      service.startContinuousVibration('warning');
      await service.stopAllAlerts();

      expect(mockCancel).toHaveBeenCalled();
      expect(mockDismissAll).toHaveBeenCalled();
    });
  });
});
