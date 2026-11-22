/**
 * Alert & Notification Service
 *
 * Coordinates local notifications, continuous vibration patterns, and wearable mirroring
 * to Xiaomi Smart Band 11 via iOS Apple Notification Center Service (ANCS).
 *
 * Implements continuous phone vibration while overspeeding, rapid wearable notification
 * cadence, and automatic dismissal upon speed recovery.
 */

import { Platform, Vibration } from 'react-native';
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

  // Cooldown repeat for sustained critical (rapid repeat for Xiaomi Band wrist alert)
  if (currentLevel === 'critical') {
    return elapsed >= settings.criticalCooldownMs;
  }

  // Cooldown repeat for sustained warning (rapid repeat for Xiaomi Band wrist alert)
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

  private continuousVibrationTimer: ReturnType<typeof setInterval> | null = null;
  private isVibratingContinuously: boolean = false;

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
   * Starts a continuous pulsing vibration pattern that loops indefinitely
   * until explicitly stopped when speed drops below the limit.
   */
  public startContinuousVibration(level: AlertLevel): void {
    if (this.isVibratingContinuously) return;
    this.isVibratingContinuously = true;

    // Initial immediate pulse
    this.triggerHaptics(level);

    if (Platform.OS === 'android') {
      // Android supports native repeating pattern with repeat = true
      const pattern = level === 'critical' ? [0, 500, 200, 500] : [0, 450, 350];
      Vibration.vibrate(pattern, true);
    } else {
      if (this.continuousVibrationTimer) {
        clearInterval(this.continuousVibrationTimer);
      }
      // iOS ignores repeat: true; an interval loop provides continuous pulsing
      const intervalMs = level === 'critical' ? 650 : 850;
      this.continuousVibrationTimer = setInterval(() => {
        if (!this.isVibratingContinuously) return;
        Vibration.vibrate([0, 400]);
      }, intervalMs);
    }
  }

  /**
   * Immediately stops continuous vibration loop and cancels active motor vibrations.
   */
  public stopContinuousVibration(): void {
    this.isVibratingContinuously = false;

    if (this.continuousVibrationTimer) {
      clearInterval(this.continuousVibrationTimer);
      this.continuousVibrationTimer = null;
    }

    try {
      Vibration.cancel();
    } catch {
      // Ignored if unsupported
    }
  }

  /**
   * Dismisses all delivered notifications from the system notification tray/lock screen.
   */
  public async dismissDeliveredNotifications(): Promise<void> {
    try {
      const Notifications = await import('expo-notifications');
      await Notifications.dismissAllNotificationsAsync();
    } catch (err) {
      console.warn('Failed to dismiss notifications:', err);
    }
  }

  /**
   * Evaluates incoming overspeed state:
   * - Starts continuous phone vibration while exceeding limit.
   * - Stops continuous vibration immediately when under limit.
   * - Auto-dismisses old notifications on recovery.
   * - Fires repeated local notifications to pulse the Xiaomi Band.
   */
  public async handleOverspeedUpdate(
    overspeed: OverspeedState,
    roadName: string = 'Đường hiện tại',
    now: number = Date.now()
  ): Promise<boolean> {
    const isOverspeedAlert = overspeed.level === 'warning' || overspeed.level === 'critical';

    // 1. Manage continuous phone vibration loop
    if (isOverspeedAlert) {
      if (this.settings.enableContinuousVibration) {
        this.startContinuousVibration(overspeed.level);
      }
    } else {
      // Speed recovered or under limit: immediately stop phone vibration!
      this.stopContinuousVibration();

      // Automatically clear delivered notifications from lock screen
      if (this.settings.autoDismissOnRecovery && this.previousLevel !== 'normal') {
        await this.dismissDeliveredNotifications();
      }

      this.lastAlertTimestamp = 0;
    }

    const shouldAlert = shouldTriggerAlert(
      overspeed.level,
      this.previousLevel,
      now,
      this.lastAlertTimestamp,
      this.settings
    );

    this.previousLevel = overspeed.level;

    if (!shouldAlert) {
      return false;
    }

    this.lastAlertTimestamp = now;
    const payload = createNotificationPayload(overspeed, roadName, now);

    // Single pulse if continuous vibration disabled
    if (this.settings.enableHaptics && !this.settings.enableContinuousVibration) {
      this.triggerHaptics(overspeed.level);
    }

    // 2. Dispatch local notification (mirrored by iOS ANCS to Xiaomi Smart Band 11)
    if (this.settings.enableNotifications) {
      await this.dispatchLocalNotification(payload);
    }

    return true;
  }

  /**
   * Stops all alerts, continuous vibration, and clears notifications.
   */
  public async stopAllAlerts(): Promise<void> {
    this.stopContinuousVibration();
    this.lastAlertTimestamp = 0;
    this.previousLevel = 'normal';
    if (this.settings.autoDismissOnRecovery) {
      await this.dismissDeliveredNotifications();
    }
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

    // Start continuous vibration for 3 seconds to demonstrate continuous motor pulse
    this.startContinuousVibration('warning');
    setTimeout(() => {
      this.stopContinuousVibration();
    }, 3000);

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
