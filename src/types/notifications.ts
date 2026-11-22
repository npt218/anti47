/**
 * Alert & Notification Type Definitions
 *
 * Defines models for local notifications, wearable vibration triggers,
 * and alert throttling cooldowns.
 */

import { AlertLevel } from './rules';

export interface NotificationPayload {
  title: string;
  body: string;
  level: AlertLevel;
  currentSpeedKmh: number;
  speedLimitKmh: number;
  roadName: string;
  timestamp: number;
}

export interface NotificationSettings {
  /** Master toggle for local system notifications */
  enableNotifications: boolean;
  /** Master toggle for phone haptic vibration */
  enableHaptics: boolean;
  /** Continuous pulsing vibration loop on phone while exceeding speed limit */
  enableContinuousVibration: boolean;
  /** Sound alert toggle */
  enableSound: boolean;
  /** Cadence in ms between repeated notifications sent to Xiaomi Band while in warning (default: 4000 ms) */
  warningCooldownMs: number;
  /** Cadence in ms between repeated notifications sent to Xiaomi Band while in critical (default: 3000 ms) */
  criticalCooldownMs: number;
  /** Automatically dismiss/clear lock-screen notifications when speed recovers below limit */
  autoDismissOnRecovery: boolean;
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enableNotifications: true,
  enableHaptics: true,
  enableContinuousVibration: true,
  enableSound: true,
  warningCooldownMs: 4000,
  criticalCooldownMs: 3000,
  autoDismissOnRecovery: true,
};
