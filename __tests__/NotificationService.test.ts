/**
 * Unit Tests for Alert & Notification Service
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

jest.mock('react-native', () => ({
  Vibration: {
    vibrate: jest.fn(),
  },
}));

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn().mockImplementation(() => Promise.resolve({})),
  scheduleNotificationAsync: jest.fn().mockImplementation(() => Promise.resolve('test-id')),
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

    it('suppresses repeated warnings within warning cooldown (15 seconds)', () => {
      // Last alert was at t = 10,000ms
      // At t = 18,000ms (8s elapsed < 15s cooldown) -> should be suppressed
      const triggerSuppressed = shouldTriggerAlert('warning', 'warning', 18000, 10000);
      expect(triggerSuppressed).toBe(false);

      // At t = 25,000ms (15s elapsed >= 15s cooldown) -> should trigger repeat
      const triggerAllowed = shouldTriggerAlert('warning', 'warning', 25000, 10000);
      expect(triggerAllowed).toBe(true);
    });

    it('enforces critical cooldown (8 seconds)', () => {
      // Last critical alert at t = 10,000ms
      // At t = 15,000ms (5s < 8s) -> suppressed
      expect(shouldTriggerAlert('critical', 'critical', 15000, 10000)).toBe(false);

      // At t = 18,000ms (8s >= 8s) -> allowed
      expect(shouldTriggerAlert('critical', 'critical', 18000, 10000)).toBe(true);
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

  describe('NotificationService lifecycle', () => {
    let service: NotificationService;

    beforeEach(() => {
      service = new NotificationService({
        ...DEFAULT_NOTIFICATION_SETTINGS,
        warningCooldownMs: 15000,
      });
    });

    it('handles overspeed progression and cooldowns correctly', async () => {
      const warningState: OverspeedState = {
        level: 'warning',
        currentSpeedKmh: 65,
        speedLimitKmh: 60,
        deltaKmh: 5,
        isOverspeed: true,
        overspeedDurationMs: 2000,
        reason: 'Test',
      };

      // 1. Initial trigger at t = 10,000ms -> should alert
      const alerted1 = await service.handleOverspeedUpdate(warningState, 'Cầu Sài Gòn', 10000);
      expect(alerted1).toBe(true);

      // 2. Immediate next fix at t = 11,000ms -> should be throttled
      const alerted2 = await service.handleOverspeedUpdate(warningState, 'Cầu Sài Gòn', 11000);
      expect(alerted2).toBe(false);

      // 3. Fix after cooldown (t = 26,000ms, 16s later) -> should alert
      const alerted3 = await service.handleOverspeedUpdate(warningState, 'Cầu Sài Gòn', 26000);
      expect(alerted3).toBe(true);

      // 4. Rider slows down to normal -> resets cooldown
      const normalState: OverspeedState = {
        level: 'normal',
        currentSpeedKmh: 55,
        speedLimitKmh: 60,
        deltaKmh: -5,
        isOverspeed: false,
        overspeedDurationMs: 0,
        reason: 'Test',
      };
      await service.handleOverspeedUpdate(normalState, 'Cầu Sài Gòn', 28000);

      // 5. Fresh warning shortly after (t = 30,000ms) -> triggers immediately because history was reset!
      const alerted4 = await service.handleOverspeedUpdate(warningState, 'Cầu Sài Gòn', 30000);
      expect(alerted4).toBe(true);
    });
  });
});
