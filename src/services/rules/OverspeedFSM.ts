/**
 * Overspeed Finite State Machine (FSM) with Hysteresis
 *
 * Implements alarm flap dampening and hysteresis buffering to prevent
 * annoying transient alerts when the rider's speed hovers near the threshold.
 */

import { DEFAULT_FSM_CONFIG, FSMConfig, OverspeedState, SpeedLimitResult } from '../../types/rules';

export class OverspeedFSM {
  private config: FSMConfig;
  private currentState: OverspeedState;
  private overspeedStartTime: number | null = null;

  constructor(config: FSMConfig = DEFAULT_FSM_CONFIG) {
    this.config = config;
    this.currentState = {
      level: 'normal',
      currentSpeedKmh: 0,
      speedLimitKmh: 50,
      deltaKmh: -50,
      isOverspeed: false,
      overspeedDurationMs: 0,
      reason: 'Khởi tạo',
    };
  }

  public getState(): OverspeedState {
    return this.currentState;
  }

  public reset(): void {
    this.overspeedStartTime = null;
    this.currentState = {
      level: 'normal',
      currentSpeedKmh: 0,
      speedLimitKmh: 50,
      deltaKmh: -50,
      isOverspeed: false,
      overspeedDurationMs: 0,
      reason: 'Đặt lại trạng thái',
    };
  }

  /**
   * Updates FSM state based on the latest speed telemetry and legal limit.
   *
   * @param currentSpeedKmh Vehicle speed in km/h
   * @param limitResult Applicable speed limit
   * @param timestamp Optional epoch milliseconds (defaults to Date.now())
   * @returns Updated OverspeedState
   */
  public update(
    currentSpeedKmh: number,
    limitResult: SpeedLimitResult,
    timestamp: number = Date.now()
  ): OverspeedState {
    const limit = limitResult.limitKmh;
    const delta = Math.round((currentSpeedKmh - limit) * 10) / 10;
    const isOver = currentSpeedKmh > limit;

    // Track overspeed duration
    if (isOver) {
      if (this.overspeedStartTime === null) {
        this.overspeedStartTime = timestamp;
      }
    } else if (currentSpeedKmh <= limit - this.config.recoveryHysteresisKmh) {
      // Clean recovery below hysteresis floor
      this.overspeedStartTime = null;
    }

    const durationMs = this.overspeedStartTime !== null
      ? Math.max(0, timestamp - this.overspeedStartTime)
      : 0;

    // Determine target alert level
    let level = this.currentState.level;

    if (currentSpeedKmh >= limit + this.config.criticalThresholdKmh) {
      // 1. Critical Level: Gross overspeed (e.g. +10 km/h or more) triggers immediately
      level = 'critical';
    } else if (currentSpeedKmh > limit + this.config.warningToleranceKmh) {
      // 2. Warning Level: Exceeds warning tolerance (+3 km/h).
      // Requires duration >= warningDebounceMs to eliminate transient GPS spikes
      if (durationMs >= this.config.warningDebounceMs || this.currentState.level === 'warning') {
        level = 'warning';
      } else {
        level = 'caution';
      }
    } else if (isOver) {
      // 3. Caution Level: Hovering 0 to +3 km/h over limit
      // If we were previously in warning, stay in caution until dropping below recovery floor
      level = 'caution';
    } else {
      // 4. Recovery check: Must drop below (limit - recoveryHysteresisKmh) to clear alert
      if (currentSpeedKmh <= limit - this.config.recoveryHysteresisKmh) {
        level = 'normal';
      }
      // If between (limit - recovery) and limit, retain current level (hysteresis gap)
    }

    this.currentState = {
      level,
      currentSpeedKmh,
      speedLimitKmh: limit,
      deltaKmh: delta,
      isOverspeed: isOver,
      overspeedDurationMs: durationMs,
      reason: limitResult.reason,
    };

    return this.currentState;
  }
}

export const overspeedFSM = new OverspeedFSM();
