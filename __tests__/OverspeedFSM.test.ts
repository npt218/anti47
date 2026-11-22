/**
 * Unit Tests for Overspeed Finite State Machine with Hysteresis
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { OverspeedFSM } from '../src/services/rules/OverspeedFSM';
import { SpeedLimitResult } from '../src/types/rules';

describe('OverspeedFSM', () => {
  let fsm: OverspeedFSM;
  const limit50: SpeedLimitResult = {
    limitKmh: 50,
    source: 'circular_31_statutory',
    reason: 'Đô thị',
  };

  beforeEach(() => {
    fsm = new OverspeedFSM({
      warningToleranceKmh: 3.0,
      criticalThresholdKmh: 10.0,
      warningDebounceMs: 1500,
      recoveryHysteresisKmh: 1.0,
    });
  });

  it('remains normal when speed is below or equal to the limit', () => {
    const state = fsm.update(48, limit50, 1000);
    expect(state.level).toBe('normal');
    expect(state.isOverspeed).toBe(false);
    expect(state.deltaKmh).toBe(-2);
  });

  it('enters caution when speed is between limit and warning tolerance (+1 to +3 km/h)', () => {
    const state = fsm.update(52, limit50, 1000);
    expect(state.level).toBe('caution');
    expect(state.isOverspeed).toBe(true);
    expect(state.deltaKmh).toBe(2);
  });

  it('debounces warning level: transient spike (< 1500ms) only stays in caution', () => {
    // Speed jumps to 55 km/h (+5 km/h over 50 km/h) at t = 1000ms
    const state1 = fsm.update(55, limit50, 1000);
    expect(state1.level).toBe('caution'); // Not yet warning!

    // At t = 2000ms (1000ms elapsed < 1500ms debounce), still caution
    const state2 = fsm.update(55, limit50, 2000);
    expect(state2.level).toBe('caution');
  });

  it('triggers warning level when overspeed tolerance is sustained for >= 1500ms', () => {
    // Start at t = 1000ms
    fsm.update(56, limit50, 1000);

    // After 1600ms (t = 2600ms >= 1500ms)
    const state = fsm.update(56, limit50, 2600);
    expect(state.level).toBe('warning');
    expect(state.isOverspeed).toBe(true);
    expect(state.overspeedDurationMs).toBe(1600);
  });

  it('triggers critical level immediately for gross overspeed (+10 km/h) without debounce', () => {
    // 61 km/h on 50 km/h road (+11 km/h >= 10 km/h critical threshold)
    const state = fsm.update(61, limit50, 1000);
    expect(state.level).toBe('critical');
  });

  it('demonstrates hysteresis recovery: warning does not clear until speed drops below (limit - 1 km/h)', () => {
    // 1. Enter warning
    fsm.update(56, limit50, 1000);
    fsm.update(56, limit50, 2600);
    expect(fsm.getState().level).toBe('warning');

    // 2. Rider slows down to exactly 50 km/h (the limit itself)
    // Hysteresis gap: (limit - 1) = 49 km/h. At 50 km/h, alert does NOT immediately drop to normal!
    const stateAt50 = fsm.update(50, limit50, 3000);
    expect(stateAt50.level).not.toBe('normal');

    // 3. Rider slows down to 48.5 km/h (below 49 km/h recovery floor)
    const stateRecovered = fsm.update(48.5, limit50, 3500);
    expect(stateRecovered.level).toBe('normal');
    expect(stateRecovered.isOverspeed).toBe(false);
  });
});
