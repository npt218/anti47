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
  /** Sound alert toggle */
  enableSound: boolean;
  /** Minimum milliseconds between repeated warning notifications (default: 15,000 ms) */
  warningCooldownMs: number;
  /** Minimum milliseconds between repeated critical notifications (default: 8,000 ms) */
  criticalCooldownMs: number;
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enableNotifications: true,
  enableHaptics: true,
  enableSound: true,
  warningCooldownMs: 15000,
  criticalCooldownMs: 8000,
};
