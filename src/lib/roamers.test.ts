import { describe, expect, it } from "vitest";
import {
  BOARD_WIDTH,
  DT,
  FRISBEE_FLIGHT_TICKS,
  FRISBEE_PERIOD_TICKS,
  LATERAL_SPEED,
  SEAGULL_PERIOD_TICKS,
  SEAGULL_STRIKE_TICKS,
  SEAGULL_WARN_TICKS,
  STEP_TICKS,
} from "./constants";
import { seedForDay } from "./rng";
import {
  frisbeeAt,
  frisbeeLocksOn,
  seagullAt,
  seagullLocksOn,
} from "./roamers";

const SEED = seedForDay(42);

describe("the frisbee", () => {
  it("is not in the air until the first throw is due", () => {
    // The opening ramp softens the lanes and cannot soften something that
    // arrives from off the board, so nothing is thrown during it.
    expect(frisbeeAt(SEED, 0, 9)).toBeNull();
    expect(frisbeeAt(SEED, FRISBEE_PERIOD_TICKS - 1, 9)).toBeNull();
    expect(frisbeeAt(SEED, FRISBEE_PERIOD_TICKS, 9)).not.toBeNull();
  });

  it("is aimed near the row the crab was in when it was let go", () => {
    // A frisbee sent to a seeded row is a hazard most runs never meet: the
    // beach is thirty-two lanes and eleven are ever on screen. Aimed, it is a
    // thing that happens to you — and still fair, because it comes in
    // sideways from off the board and is dodged by moving rather than by
    // having guessed right.
    for (let day = 0; day < 60; day += 1) {
      const seed = seedForDay(day);
      for (const lockRow of [3, 9, 15, 20]) {
        const frisbee = frisbeeAt(seed, FRISBEE_PERIOD_TICKS, lockRow)!;
        const row = frisbee.y / 16;
        expect(Math.abs(row - lockRow)).toBeLessThan(3.2);
      }
    }
  });

  it("is let go on exactly one tick per throw", () => {
    let throws = 0;
    for (let e = 1; e <= FRISBEE_PERIOD_TICKS * 3; e += 1) {
      if (frisbeeLocksOn(e)) throws += 1;
    }
    expect(throws).toBe(3);
  });

  it("crosses the board and then is gone until the next throw", () => {
    const midFlight = frisbeeAt(SEED, FRISBEE_PERIOD_TICKS + 40, 9);
    expect(midFlight).not.toBeNull();
    expect(frisbeeAt(SEED, FRISBEE_PERIOD_TICKS + FRISBEE_FLIGHT_TICKS, 9)).toBeNull();
  });

  it("is in the air for a good deal less than the gap between throws", () => {
    // An interruption to be waited out, not a second set of lanes to solve.
    expect(FRISBEE_FLIGHT_TICKS).toBeLessThan(FRISBEE_PERIOD_TICKS / 2);
  });

  it("clears the board from one side to the other", () => {
    const first = frisbeeAt(SEED, FRISBEE_PERIOD_TICKS + 1, 9)!;
    const last = frisbeeAt(
      SEED,
      FRISBEE_PERIOD_TICKS + FRISBEE_FLIGHT_TICKS - 1,
      9,
    )!;
    expect(Math.sign(last.x - first.x)).toBe(first.direction);
    // Starts and ends off the board, so it never blinks into existence in
    // front of a player who had no way to see it coming.
    expect(first.x < 0 || first.x > BOARD_WIDTH).toBe(true);
    expect(last.x < 0 || last.x > BOARD_WIDTH).toBe(true);
  });

  it("arcs across two lanes, and not the same two throughout", () => {
    // The parent spec's phrase for this hazard, made literal: its centre rises
    // a full lane and falls back, so the pair of rows it overlaps changes.
    const heights = new Set<number>();
    for (let into = 1; into < FRISBEE_FLIGHT_TICKS; into += 1) {
      const frisbee = frisbeeAt(SEED, FRISBEE_PERIOD_TICKS + into, 9)!;
      heights.add(Math.round(frisbee.y));
    }
    expect(heights.size).toBeGreaterThan(10);
  });

  it("is the same frisbee on two devices at the same tick", () => {
    for (let elapsed = 0; elapsed < 3_000; elapsed += 37) {
      expect(frisbeeAt(SEED, elapsed, 9)).toEqual(frisbeeAt(SEED, elapsed, 9));
    }
  });

  it("reads no clock and samples nothing unseeded", () => {
    const now = Date.now;
    const random = Math.random;
    Date.now = () => {
      throw new Error("the frisbee read a clock");
    };
    Math.random = () => {
      throw new Error("the frisbee read an unseeded source");
    };
    try {
      for (let elapsed = 0; elapsed < 2_000; elapsed += 1) {
        expect(() => frisbeeAt(SEED, elapsed, 9)).not.toThrow();
      }
    } finally {
      Date.now = now;
      Math.random = random;
    }
  });
});

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


