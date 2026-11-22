/**
 * Alert & Notification Service
 *
 * Coordinates local notifications, vibration patterns, and wearable mirroring
 * to Xiaomi Smart Band 11 via iOS Apple Notification Center Service (ANCS).
 *
 * Implements alarm throttling/cooldowns to prevent notification spam.
 */

import { Vibration } from 'react-native';
import { AlertLevel, OverspeedState } from '../../types/rules';
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  NotificationPayload,
  NotificationSettings,
} from '../../types/notifications';

/**
 * Pure decision function: Determines whether an overspeed alert should be emitted
 * based on level transitions and cooldown timers.
 */
export function shouldTriggerAlert(
  currentLevel: AlertLevel,
  previousLevel: AlertLevel,
  currentTimeMs: number,
  lastAlertTimeMs: number,
  settings: NotificationSettings = DEFAULT_NOTIFICATION_SETTINGS
): boolean {
  if (currentLevel === 'normal' || currentLevel === 'caution') {
    return false;
  }

  const elapsed = currentTimeMs - lastAlertTimeMs;

  // Escalation: Transitioning from a lower level to critical always triggers immediately
  if (currentLevel === 'critical' && previousLevel !== 'critical') {
    return true;
  }

  // Initial trigger: Entering warning from normal/caution
  if (currentLevel === 'warning' && (previousLevel === 'normal' || previousLevel === 'caution')) {
    return true;
  }

  // Cooldown repeat for sustained critical
  if (currentLevel === 'critical') {
    return elapsed >= settings.criticalCooldownMs;
  }

  // Cooldown repeat for sustained warning
  if (currentLevel === 'warning') {
    return elapsed >= settings.warningCooldownMs;
  }

  return false;
}

/**
 * Formats user-friendly bilingual notification payload for motorcycle HUD and wearable display.
 */
export function createNotificationPayload(
  overspeed: OverspeedState,
  roadName: string = 'Đoạn đường hiện tại',
  timestamp: number = Date.now()
): NotificationPayload {
  const isCritical = overspeed.level === 'critical';
  const title = isCritical
    ? `🚨 NGUY HIỂM: ${Math.round(overspeed.currentSpeedKmh)} / ${overspeed.speedLimitKmh} KM/H`
    : `⚠️ CẢNH BÁO: ${Math.round(overspeed.currentSpeedKmh)} / ${overspeed.speedLimitKmh} KM/H`;

  const body = `${roadName} (Tối đa ${overspeed.speedLimitKmh} km/h). Vượt quá +${overspeed.deltaKmh} km/h! Hãy giảm tốc độ.`;

  return {
    title,
    body,
    level: overspeed.level,
    currentSpeedKmh: overspeed.currentSpeedKmh,
    speedLimitKmh: overspeed.speedLimitKmh,
    roadName,
    timestamp,
  };
}

export class NotificationService {
  private settings: NotificationSettings;
  private lastAlertTimestamp: number = 0;
  private previousLevel: AlertLevel = 'normal';
  private isConfigured: boolean = false;

  constructor(settings: NotificationSettings = DEFAULT_NOTIFICATION_SETTINGS) {
    this.settings = settings;
  }

  public async initialize(): Promise<void> {
    if (this.isConfigured) return;

    try {
      const Notifications = await import('expo-notifications');

      // Configure foreground notification presentation
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: this.settings.enableSound,
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });

      // Configure Android High-Importance Channel
      await Notifications.setNotificationChannelAsync('overspeed_channel', {
        name: 'Cảnh báo tốc độ xe máy',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 500, 250, 500],
        lightColor: '#FF1744',
        sound: 'default',
        enableVibrate: true,
      });

      this.isConfigured = true;
    } catch (err) {
      // Graceful fallback in environments without native notification modules (e.g. tests)
      console.warn('Notification initialization fallback:', err);
    }
  }

  public async requestPermissions(): Promise<boolean> {
    try {
      const Notifications = await import('expo-notifications');
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      return finalStatus === 'granted';
    } catch {
      return false;
    }
  }

  /**
   * Evaluates incoming overspeed state and fires notification + vibration
   * if threshold and cooldown conditions are satisfied.
   */
  public async handleOverspeedUpdate(
    overspeed: OverspeedState,
    roadName: string = 'Đường hiện tại',
    now: number = Date.now()
  ): Promise<boolean> {
    const shouldAlert = shouldTriggerAlert(
      overspeed.level,
      this.previousLevel,
      now,
      this.lastAlertTimestamp,
      this.settings
    );

    if (overspeed.level === 'normal') {
      // Reset cooldown history upon recovery
      this.lastAlertTimestamp = 0;
    }

    this.previousLevel = overspeed.level;

    if (!shouldAlert) {
      return false;
    }

    this.lastAlertTimestamp = now;
    const payload = createNotificationPayload(overspeed, roadName, now);

    // 1. Trigger haptic vibration pattern on phone
    if (this.settings.enableHaptics) {
      this.triggerHaptics(overspeed.level);
    }

    // 2. Dispatch local notification (mirrored by iOS ANCS to Xiaomi Smart Band 11)
    if (this.settings.enableNotifications) {
      await this.dispatchLocalNotification(payload);
    }

    return true;
  }

  public async triggerTestAlert(): Promise<void> {
    const testState: OverspeedState = {
      level: 'warning',
      currentSpeedKmh: 65,
      speedLimitKmh: 60,
      deltaKmh: 5,
      isOverspeed: true,
      overspeedDurationMs: 2000,
      reason: 'Kiểm tra rung Xiaomi Band & chuông',
    };

    const payload = createNotificationPayload(testState, 'Cầu Sài Gòn (Thử nghiệm)');
    this.triggerHaptics('warning');
    await this.dispatchLocalNotification(payload);
  }

  private triggerHaptics(level: AlertLevel): void {
    try {
      if (level === 'critical') {
        // Double intense pulse for critical
        Vibration.vibrate([0, 500, 200, 500]);
      } else {
        // Single medium pulse for warning
        Vibration.vibrate([0, 400]);
      }
    } catch {
      // Ignored if vibration hardware unsupported
    }
  }

  private async dispatchLocalNotification(payload: NotificationPayload): Promise<void> {
    try {
      const Notifications = await import('expo-notifications');
      await Notifications.scheduleNotificationAsync({
        content: {
          title: payload.title,
          body: payload.body,
          sound: this.settings.enableSound ? 'default' : undefined,
          priority: Notifications.AndroidNotificationPriority.MAX,
          categoryIdentifier: 'MOTO_OVERSPEED',
          data: {
            level: payload.level,
            speedKmh: payload.currentSpeedKmh,
            limitKmh: payload.speedLimitKmh,
          },
        },
        trigger: null, // immediate delivery
      });
    } catch (err) {
      console.warn('Failed to schedule local notification:', err);
    }
  }
}

export const notificationService = new NotificationService();
