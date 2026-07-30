import { describe, expect, it } from "vitest";
import {
  gapsOf,
  hazardCenterAt,
  hazardStepPerTick,
  laneAt,
  type Lane,
  minGapOf,
} from "./board";
import {
  BEACH_LANES,
  BOARD_WIDTH,
  CYCLE_SPAN,
  DT,
  MIN_GAP,
  PLAYER_HALF_W,
  SAFE_LANE_INTERVAL,
  SEA_ROW,
  WRAP_MARGIN,
} from "./constants";
import { seedForDay } from "./rng";

const SEED = seedForDay(42);

/**
 * Every lane of a day's beach, promenade to shoreline, which is what most of
 * these assertions sweep. The sea past it is not part of the beach and is
 * checked on its own.
 */
function beach(seed = SEED): Lane[] {
  return Array.from({ length: BEACH_LANES + 1 }, (_, row) => laneAt(seed, row));
}

describe("laneAt", () => {
  it("returns the same lane every time it is asked", () => {
    for (let row = 0; row < 120; row += 1) {
      expect(laneAt(SEED, row)).toEqual(laneAt(SEED, row));
    }
  });

  it("gives different days different beaches", () => {
    const one = JSON.stringify(beach(seedForDay(1)));
    const two = JSON.stringify(beach(seedForDay(2)));
    expect(one).not.toBe(two);
  });

  it("starts the crab on a safe lane", () => {
    expect(laneAt(SEED, 0).kind).toBe("safe");
  });

  it("keeps the safe lanes on their rhythm", () => {
    beach().forEach((lane, row) => {
      expect(lane.kind === "safe").toBe(row % SAFE_LANE_INTERVAL === 0);
    });
  });

  it("produces both still and drifting hazard lanes", () => {
    const kinds = new Set(beach().map((lane) => lane.kind));
    expect(kinds).toEqual(new Set(["safe", "still", "drift"]));
  });

  it("ends the beach at the sea", () => {
    expect(laneAt(SEED, BEACH_LANES).kind).not.toBe("sea");
    expect(laneAt(SEED, SEA_ROW).kind).toBe("sea");
  });

  it("keeps every row past the shoreline as sea", () => {
    // A crab that somehow overshoots is still in the water rather than off the
    // end of a beach that stopped being generated.
    for (let row = SEA_ROW; row < SEA_ROW + 50; row += 1) {
      expect(laneAt(SEED, row).kind).toBe("sea");
    }
  });

  it("puts a safe lane immediately before the sea", () => {
    // The last thing between the player and the water should not be a hazard
    // they have to gamble on with the whole run already behind them.
    expect(laneAt(SEED, BEACH_LANES).kind).toBe("safe");
  });

  it("gives every day the same length of beach", () => {
    for (let day = 0; day < 50; day += 1) {
      const seed = seedForDay(day);
      expect(laneAt(seed, BEACH_LANES).kind).not.toBe("sea");
      expect(laneAt(seed, SEA_ROW).kind).toBe("sea");
    }
  });

  it("does not read an unseeded source", () => {
    const random = Math.random;
    Math.random = () => {
      throw new Error("board generation reached Math.random");
    };
    try {
      expect(() => beach()).not.toThrow();
    } finally {
      Math.random = random;
    }
  });
});

describe("lane layout", () => {
  it("always leaves a gap the crab fits through", () => {
    const crabWidth = PLAYER_HALF_W * 2;
    expect(MIN_GAP.drift).toBeGreaterThan(crabWidth);
    expect(MIN_GAP.still).toBeGreaterThan(crabWidth);

    for (const lane of beach()) {
      if (lane.kind === "safe") continue;
      for (const gap of gapsOf(lane)) {
        expect(gap).toBeGreaterThanOrEqual(minGapOf(lane) - 1e-9);
      }
    }
  });

  it("fills its lane exactly, leaving no hazard hanging off the end", () => {
    for (const lane of beach()) {
      if (lane.kind === "safe" || lane.kind === "sea") continue;
      const span = lane.kind === "drift" ? CYCLE_SPAN : BOARD_WIDTH;
      for (const hazard of lane.hazards) {
        expect(hazard.center - hazard.halfWidth).toBeGreaterThanOrEqual(-1e-9);
        expect(hazard.center + hazard.halfWidth).toBeLessThanOrEqual(
          span + 1e-9,
        );
      }
    }
  });

  it("never places a hazard wider than the wrap margin", () => {
    // A hazard wider than the margin would still be on the board at the moment
    // it wraps, and would appear to jump across the beach.
    for (const lane of beach()) {
      if (lane.kind !== "drift") continue;
      for (const hazard of lane.hazards) {
        expect(hazard.halfWidth * 2).toBeLessThan(WRAP_MARGIN);
      }
    }
  });

  it("holds every lane crossable across many days", () => {
    // The beach is thirty-odd lanes rather than the six hundred rows this used
    // to sweep, so the day count carries the coverage instead: three years of
    // beaches, every lane of every one of them.
    for (let day = 0; day < 1_100; day += 1) {
      for (const lane of beach(seedForDay(day))) {
        if (lane.kind === "safe" || lane.kind === "sea") continue;
        expect(lane.hazards.length).toBeGreaterThan(0);
        for (const gap of gapsOf(lane)) {
          expect(gap).toBeGreaterThanOrEqual(minGapOf(lane) - 1e-9);
        }
      }
    }
  });
});

describe("hazardCenterAt", () => {
  const driftLane = beach().find((lane) => lane.kind === "drift")!;

  it("leaves a still lane's hazards where they were placed", () => {
    const still = beach().find((lane) => lane.kind === "still")!;
    for (const hazard of still.hazards) {
      expect(hazardCenterAt(still, hazard, 0)).toBe(hazard.center);
      expect(hazardCenterAt(still, hazard, 5_000)).toBe(hazard.center);
    }
  });

  it("moves a drifting hazard at the lane's speed", () => {
    const hazard = driftLane.hazards[0];
    const before = hazardCenterAt(driftLane, hazard, 100);
    const after = hazardCenterAt(driftLane, hazard, 160);
    const expected = driftLane.direction * driftLane.speed * 60 * DT;
    // Compare modulo the cycle, since the hazard may have wrapped in between.
    const travelled = ((after - before - expected) % CYCLE_SPAN) / CYCLE_SPAN;
    expect(Math.abs(travelled - Math.round(travelled))).toBeLessThan(1e-9);
  });

  it("keeps hazards inside the cycle, wrapping off the board rather than on", () => {
    for (let tick = 0; tick < 20_000; tick += 7) {
      for (const hazard of driftLane.hazards) {
        const x = hazardCenterAt(driftLane, hazard, tick);
        expect(x).toBeGreaterThanOrEqual(-WRAP_MARGIN);
        expect(x).toBeLessThan(BOARD_WIDTH + WRAP_MARGIN);
      }
    }
  });

  it("does not drift out of true over a long run", () => {
    // Positions come from the tick number rather than from accumulation, so
    // fifteen minutes of play lands exactly where the closed form says.
    const hazard = driftLane.hazards[0];
    const tick = 60 * 60 * 15;
    const closedForm =
      (((hazard.center + driftLane.direction * driftLane.speed * tick * DT) %
        CYCLE_SPAN) +
        CYCLE_SPAN) %
      CYCLE_SPAN;
    expect(hazardCenterAt(driftLane, hazard, tick)).toBe(
      closedForm - WRAP_MARGIN,
    );
  });
});

describe("hazardStepPerTick", () => {
  it("is zero for lanes that do not move", () => {
    expect(hazardStepPerTick({ kind: "safe" })).toBe(0);
    const still = beach().find((lane) => lane.kind === "still")!;
    expect(hazardStepPerTick(still)).toBe(0);
  });

  it("is a fraction of a unit, well inside a hazard's width", () => {
    for (const lane of beach()) {
      if (lane.kind !== "drift") continue;
      expect(Math.abs(hazardStepPerTick(lane))).toBeLessThan(1);
    }
  });
});
