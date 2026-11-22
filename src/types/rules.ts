/**
 * Vietnam Speed Limit & Overspeed Alert Types
 *
 * Defines models for vehicle categorization, statutory speed regulations,
 * and the hysteresis alert state machine.
 */

export type VehicleType = 'motorcycle' | 'moped';

export type SpeedLimitSource =
  | 'explicit_sign'           // Explicit maxspeed tag from OSM
  | 'circular_31_statutory'  // Vietnam Circular 31/2019/TT-BGTVT statutory rule
  | 'default_fallback';       // Off-road / unknown road safe default

export interface SpeedLimitResult {
  limitKmh: number;
  source: SpeedLimitSource;
  reason: string;
}

export type AlertLevel = 'normal' | 'caution' | 'warning' | 'critical';

export interface OverspeedState {
  level: AlertLevel;
  currentSpeedKmh: number;
  speedLimitKmh: number;
  deltaKmh: number;               // currentSpeedKmh - speedLimitKmh
  isOverspeed: boolean;
  overspeedDurationMs: number;    // Continuous milliseconds spent exceeding limit
  reason: string;
}

export interface FSMConfig {
  /** Speed buffer in km/h above the limit before caution transitions to warning (default: 3 km/h) */
  warningToleranceKmh: number;
  /** Speed delta in km/h above the limit that triggers critical alert (default: 10 km/h) */
  criticalThresholdKmh: number;
  /** Continuous milliseconds exceeding warning threshold before emitting warning alert (default: 1500 ms) */
  warningDebounceMs: number;
  /** Speed margin below the limit that must be reached to clear an active warning (hysteresis recovery, default: 1 km/h below limit) */
  recoveryHysteresisKmh: number;
}

export const DEFAULT_FSM_CONFIG: FSMConfig = {
  warningToleranceKmh: 3.0,
  criticalThresholdKmh: 10.0,
  warningDebounceMs: 1500,
  recoveryHysteresisKmh: 1.0,
};
