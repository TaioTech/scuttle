import { describe, expect, it } from "vitest";
import {
  DT,
  LATERAL_SPEED,
  SEAGULL_PERIOD_TICKS,
  SEAGULL_STRIKE_TICKS,
  SEAGULL_WARN_TICKS,
  STEP_TICKS,
} from "./constants";
import { seagullAt, seagullLocksOn } from "./roamers";

describe("the seagull", () => {
  it("warns before it strikes, and only strikes after the warning", () => {
    for (let into = 1; into < SEAGULL_WARN_TICKS; into += 1) {
      expect(seagullAt(into, 60, 9)!.striking).toBe(false);
    }
    expect(seagullAt(SEAGULL_WARN_TICKS, 60, 9)!.striking).toBe(true);
  });

  it("gives enough lead time to move clear of it", () => {
    // The acceptance criterion this hazard exists to satisfy: announced with
    // enough warning that an alert player can move out of it, rather than
    // something merely reacted to. Measured against what the crab can actually
    // do — walk sideways out of the patch, or commit a whole forward step.
    const escapeSideways = (8 * 2) / LATERAL_SPEED / DT;
    expect(SEAGULL_WARN_TICKS).toBeGreaterThan(escapeSideways);
    expect(SEAGULL_WARN_TICKS).toBeGreaterThan(STEP_TICKS);
  });

  it("finishes and leaves the sand alone until the next dive", () => {
    const after = SEAGULL_WARN_TICKS + SEAGULL_STRIKE_TICKS;
    expect(seagullAt(after, 60, 9)).toBeNull();
    expect(seagullAt(SEAGULL_PERIOD_TICKS - 1, 60, 9)).toBeNull();
  });

  it("never takes a crab off the promenade", () => {
    // Row zero is where a run starts and the parent spec calls it always safe.
    for (let into = 1; into < SEAGULL_PERIOD_TICKS; into += 1) {
      expect(seagullAt(into, 60, 0)).toBeNull();
      expect(seagullAt(into, 60, -3)).toBeNull();
    }
  });

  it("locks its patch once and does not follow the crab", () => {
    // A shadow that kept tracking would be a warning about something there is
    // no getting out of the way of, which is the opposite of the point.
    const first = seagullAt(SEAGULL_WARN_TICKS - 30, 40, 9)!;
    const later = seagullAt(SEAGULL_WARN_TICKS - 1, 40, 9)!;
    expect(later.x).toBe(first.x);
    expect(later.y).toBe(first.y);
    expect(later.warning).toBeGreaterThan(first.warning);
  });

  it("picks its target on exactly one tick per dive", () => {
    let locks = 0;
    for (let elapsed = 1; elapsed <= SEAGULL_PERIOD_TICKS * 3; elapsed += 1) {
      if (seagullLocksOn(elapsed)) locks += 1;
    }
    expect(locks).toBe(3);
  });
});


