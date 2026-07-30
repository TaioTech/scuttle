import { describe, expect, it } from "vitest";
import {
  gapsOf,
  hasHazards,
  hazardCenterAt,
  hazardStepPerTick,
  laneAt,
  laneStrength,
  type Lane,
  minGapOf,
  shellCount,
  shellOf,
  surfWashingAt,
  tideAt,
  waterlineAt,
} from "./board";
import {
  BEACH_LANES,
  BOARD_WIDTH,
  CYCLE_SPAN,
  DRIFT_COUNT,
  DRIFT_SPEED,
  DRIFT_WIDTH,
  DRY_LANES,
  DT,
  MIN_GAP,
  PLAYER_HALF_W,
  RAMP_LANES,
  SAFE_LANE_INTERVAL,
  SEA_ROW,
  SHELL_HALF_W,
  STILL_WIDTH,
  SURF_BREAK_TICKS,
  SURF_LANES,
  SURF_PERIOD_TICKS,
  SURF_ROW_LAG,
  TIDE_FULL_TICKS,
  WRAP_MARGIN,
} from "./constants";
import { seedForDay } from "./rng";

const SEED = seedForDay(42);

/**
 * Every lane of a day's beach, promenade to shoreline, which is what most of
 * these assertions sweep. The sea past it is not part of the beach and is
 * checked on its own.
 */
function beach(seed = SEED, tick = 0): Lane[] {
  return Array.from({ length: BEACH_LANES + 1 }, (_, row) =>
    laneAt(seed, row, tick),
  );
}

/** Just the dry sand, which is the only band the seed has any say over. */
function drySand(seed = SEED): Lane[] {
  return Array.from({ length: DRY_LANES }, (_, i) => laneAt(seed, i + 1));
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

  it("keeps the safe lanes on their rhythm through the dry sand", () => {
    drySand().forEach((lane, index) => {
      const row = index + 1;
      expect(lane.kind === "safe").toBe(row % SAFE_LANE_INTERVAL === 0);
    });
    expect(laneAt(SEED, 0).kind).toBe("safe");
  });

  it("produces both still and drifting hazard lanes", () => {
    const kinds = new Set(drySand().map((lane) => lane.kind));
    expect(kinds).toEqual(new Set(["safe", "still", "drift"]));
  });

  it("lays the beach out in bands, sand then wet sand then surf", () => {
    const kinds = beach().map((lane) => lane.kind);
    expect(kinds[DRY_LANES]).not.toBe("tideline");
    expect(kinds[DRY_LANES + 1]).toBe("tideline");
    expect(kinds[BEACH_LANES]).toBe("surf");

    // Once a band has started it runs to the end of itself. A tide line with a
    // patch of dry sand in the middle of it would be the bands losing their
    // meaning, and the tide's escalation is only legible if a player can read
    // the board as three regions rather than as thirty-two independent rows.
    const order = ["tideline", "surf"];
    let seen = -1;
    for (let row = DRY_LANES + 1; row <= BEACH_LANES; row += 1) {
      const index = order.indexOf(laneAt(SEED, row).kind);
      expect(index).toBeGreaterThanOrEqual(seen);
      seen = index;
    }
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

  it("puts the surf immediately before the sea", () => {
    // This used to insist on a safe lane there: the last thing between a player
    // and the water should not be a hazard to gamble on with the whole run
    // behind them. The surf is not that hazard. It cannot kill, so ending the
    // beach with it costs a mistimed crossing a lane rather than the run, and
    // the final push being against the water is the shape the spec asks for.
    for (let day = 0; day < 50; day += 1) {
      expect(laneAt(seedForDay(day), BEACH_LANES).kind).toBe("surf");
    }
  });

  it("never lets the tide reach the dry sand", () => {
    // The seed decides what is in the dry-sand lanes and the tide is not
    // allowed a vote. Water arriving under a crab mid-step would delete a
    // hazard it had already committed to crossing, which is the fixed-length
    // beach's crossability guarantee being undone by the clock.
    for (const tick of [0, 1_000, TIDE_FULL_TICKS, TIDE_FULL_TICKS * 4]) {
      for (let row = 1; row <= DRY_LANES; row += 1) {
        const lane = laneAt(SEED, row, tick);
        expect(lane.kind).not.toBe("surf");
        expect(lane.kind).not.toBe("tideline");
        expect(lane).toEqual(laneAt(SEED, row, 0));
      }
    }
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
      if (!hasHazards(lane)) continue;
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
        if (!hasHazards(lane)) continue;
        expect(lane.hazards.length).toBeGreaterThan(0);
        for (const gap of gapsOf(lane)) {
          expect(gap).toBeGreaterThanOrEqual(minGapOf(lane) - 1e-9);
        }
      }
    }
  });
});

describe("laneStrength", () => {
  it("starts the beach at nothing and reaches full by the ramp's end", () => {
    expect(laneStrength(1)).toBe(0);
    expect(laneStrength(RAMP_LANES)).toBe(1);
  });

  it("never falls back once it has climbed", () => {
    let previous = -1;
    for (let row = 0; row <= BEACH_LANES; row += 1) {
      const strength = laneStrength(row);
      expect(strength).toBeGreaterThanOrEqual(previous);
      previous = strength;
    }
  });

  it("leaves the beach past the ramp entirely alone", () => {
    for (let row = RAMP_LANES; row <= BEACH_LANES; row += 1) {
      expect(laneStrength(row)).toBe(1);
    }
  });
});

describe("the opening ramp", () => {
  it("only ever lowers a lane's ceilings, never raises them", () => {
    // The ramp's fairness guarantee is structural rather than statistical: it
    // interpolates ceilings downward, so a lane inside the ramp is drawn from a
    // strict subset of what the same row could otherwise have produced. No seed
    // can make an early lane harder than a late one of the same kind.
    for (let day = 0; day < 400; day += 1) {
      for (let row = 1; row < RAMP_LANES; row += 1) {
        const lane = laneAt(seedForDay(day), row);
        if (!hasHazards(lane)) continue;

        const strength = laneStrength(row);
        const widths = lane.kind === "drift" ? DRIFT_WIDTH : STILL_WIDTH;
        const ceiling = widths.min + (widths.max - widths.min) * strength;
        for (const hazard of lane.hazards) {
          expect(hazard.halfWidth * 2).toBeLessThanOrEqual(ceiling + 1e-9);
        }

        if (lane.kind === "drift") {
          const fastest =
            DRIFT_SPEED.min + (DRIFT_SPEED.max - DRIFT_SPEED.min) * strength;
          expect(lane.speed).toBeLessThanOrEqual(fastest + 1e-9);
          expect(lane.hazards.length).toBeLessThanOrEqual(DRIFT_COUNT.max);
        }
      }
    }
  });

  it("never opens the beach with a lane at full strength", () => {
    // The complaint this exists for: the second lane of the run was drawn from
    // the same distribution as the twenty-ninth, and a player meets the opening
    // on every run and the far end perhaps once.
    for (let day = 0; day < 400; day += 1) {
      const lane = laneAt(seedForDay(day), 1);
      if (!hasHazards(lane)) continue;
      expect(lane.hazards.length).toBe(DRIFT_COUNT.min);
      if (lane.kind === "drift") expect(lane.speed).toBe(DRIFT_SPEED.min);
    }
  });

  it("still leaves every ramped lane crossable", () => {
    for (let day = 0; day < 400; day += 1) {
      for (let row = 1; row < RAMP_LANES; row += 1) {
        const lane = laneAt(seedForDay(day), row);
        if (!hasHazards(lane)) continue;
        for (const gap of gapsOf(lane)) {
          expect(gap).toBeGreaterThanOrEqual(minGapOf(lane) - 1e-9);
        }
      }
    }
  });
});

describe("the tide", () => {
  it("starts out and comes fully in, and stays in", () => {
    expect(tideAt(0)).toBe(0);
    expect(tideAt(TIDE_FULL_TICKS)).toBe(1);
    expect(tideAt(TIDE_FULL_TICKS * 10)).toBe(1);
  });

  it("only ever advances", () => {
    let previous = -1;
    for (let tick = 0; tick <= TIDE_FULL_TICKS * 2; tick += 137) {
      expect(tideAt(tick)).toBeGreaterThanOrEqual(previous);
      previous = tideAt(tick);
    }
  });

  it("brings the water further up the beach as it advances", () => {
    let previous = Number.POSITIVE_INFINITY;
    for (let tick = 0; tick <= TIDE_FULL_TICKS; tick += 97) {
      const waterline = waterlineAt(tick);
      expect(waterline).toBeLessThanOrEqual(previous);
      previous = waterline;
    }
  });

  it("narrows the tide line to nothing without eating the dry sand", () => {
    const low = waterlineAt(0);
    const high = waterlineAt(TIDE_FULL_TICKS);
    expect(BEACH_LANES - low + 1).toBe(SURF_LANES.low);
    expect(BEACH_LANES - high + 1).toBe(SURF_LANES.high);
    // At full tide the surf's leading edge sits exactly on the first row past
    // the dry sand: every lane of wet sand taken, not one lane of sand.
    expect(high).toBe(DRY_LANES + 1);
    expect(waterlineAt(TIDE_FULL_TICKS * 5)).toBe(DRY_LANES + 1);
  });

  it("reads a clock nowhere", () => {
    const now = Date.now;
    const random = Math.random;
    Date.now = () => {
      throw new Error("the tide read a clock");
    };
    Math.random = () => {
      throw new Error("the tide read an unseeded source");
    };
    try {
      for (let tick = 0; tick < 5_000; tick += 1) {
        expect(() => laneAt(SEED, BEACH_LANES - 4, tick)).not.toThrow();
      }
    } finally {
      Date.now = now;
      Math.random = random;
    }
  });
});

describe("surfWashingAt", () => {
  it("washes for its break and rests for the remainder of the cycle", () => {
    let washing = 0;
    for (let tick = 0; tick < SURF_PERIOD_TICKS; tick += 1) {
      if (surfWashingAt(0, tick)) washing += 1;
    }
    expect(washing).toBe(SURF_BREAK_TICKS);
  });

  it("repeats exactly, however long the run goes on", () => {
    for (let tick = 0; tick < 400; tick += 1) {
      expect(surfWashingAt(25, tick)).toBe(
        surfWashingAt(25, tick + SURF_PERIOD_TICKS),
      );
      // A closed form of the tick, so a long run cannot drift out of true the
      // way an accumulated phase would.
      expect(surfWashingAt(25, tick)).toBe(
        surfWashingAt(25, tick + SURF_PERIOD_TICKS * 1_000),
      );
    }
  });

  it("breaks nearer the sea first, so a set runs shoreward", () => {
    // The lane one row up the beach repeats what its neighbour did a lag ago,
    // which is what makes the band read as a wave rather than as a row of
    // lights blinking together.
    for (let tick = 0; tick < 300; tick += 1) {
      expect(surfWashingAt(25, tick + SURF_ROW_LAG)).toBe(
        surfWashingAt(26, tick),
      );
    }
  });

  it("leaves every surf lane crossable more often than not", () => {
    expect(SURF_BREAK_TICKS).toBeLessThan(SURF_PERIOD_TICKS / 2);
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

describe("shells", () => {
  it("puts them only in lanes that carry a hazard", () => {
    for (let day = 0; day < 200; day += 1) {
      const seed = seedForDay(day);
      for (let row = 0; row <= BEACH_LANES; row += 1) {
        const lane = laneAt(seed, row);
        if (!hasHazards(lane)) expect(shellOf(lane)).toBeNull();
      }
    }
  });

  it("gives a beach a handful of them, and never none", () => {
    for (let day = 0; day < 200; day += 1) {
      const total = shellCount(seedForDay(day));
      expect(total).toBeGreaterThan(0);
      expect(total).toBeLessThanOrEqual(DRY_LANES);
    }
  });

  it("keeps every shell inside the board and reachable by a crab", () => {
    for (let day = 0; day < 400; day += 1) {
      const seed = seedForDay(day);
      for (let row = 1; row <= DRY_LANES; row += 1) {
        const shell = shellOf(laneAt(seed, row));
        if (shell === null) continue;
        expect(shell).toBeGreaterThanOrEqual(PLAYER_HALF_W - 1e-9);
        expect(shell).toBeLessThanOrEqual(BOARD_WIDTH - PLAYER_HALF_W + 1e-9);
      }
    }
  });

  it("never buries a still lane's shell under a blocker", () => {
    // AC #6, and the case the whole placement order exists for. A still lane's
    // hazards never move, so a shell laid on top of one is a shell that simply
    // cannot be had — an optional pickup quietly turned into an impossible one.
    for (let day = 0; day < 400; day += 1) {
      const seed = seedForDay(day);
      for (let row = 1; row <= DRY_LANES; row += 1) {
        const lane = laneAt(seed, row);
        if (lane.kind !== "still" || lane.shell === null) continue;
        for (const hazard of lane.hazards) {
          const overlap =
            Math.abs(lane.shell - hazard.center) <
            hazard.halfWidth + SHELL_HALF_W;
          expect(overlap).toBe(false);
        }
      }
    }
  });

  it("leaves a drifting lane's shell clear at some phase of the cycle", () => {
    // The guarantee is structural — a drifting lane's hazards sweep the whole
    // board, so every point on it is under a gap eventually — but it is cheap
    // to confirm rather than assert, and this is the acceptance criterion the
    // spec singles out as needing its own test.
    for (let day = 0; day < 120; day += 1) {
      const seed = seedForDay(day);
      for (let row = 1; row <= DRY_LANES; row += 1) {
        const lane = laneAt(seed, row);
        if (lane.kind !== "drift" || lane.shell === null) continue;

        let clear = false;
        for (let tick = 0; tick < 4_000 && !clear; tick += 1) {
          clear = lane.hazards.every((hazard) => {
            const center = hazardCenterAt(lane, hazard, tick);
            // Wide enough that the crab standing on the shell is clear too,
            // not merely the shell itself.
            return (
              Math.abs(center - lane.shell!) >= hazard.halfWidth + PLAYER_HALF_W
            );
          });
        }
        expect(clear).toBe(true);
      }
    }
  });

  it("never sits dead centre of the gap the player would already cross", () => {
    // A pickup that costs nothing is not the optional risk the spec asks for.
    let offset = 0;
    let counted = 0;
    for (let day = 0; day < 200; day += 1) {
      const seed = seedForDay(day);
      for (let row = 1; row <= DRY_LANES; row += 1) {
        const lane = laneAt(seed, row);
        if (lane.kind !== "still" || lane.shell === null) continue;
        offset += Math.abs(lane.shell - BOARD_WIDTH / 2);
        counted += 1;
      }
    }
    expect(counted).toBeGreaterThan(0);
    expect(offset / counted).toBeGreaterThan(PLAYER_HALF_W);
  });

  it("does not move with the tide", () => {
    // Shells lie in the dry sand and the tide never reaches it, so a run's
    // shell count is fixed the moment the day is.
    const seed = seedForDay(7);
    for (const elapsed of [0, TIDE_FULL_TICKS, TIDE_FULL_TICKS * 3]) {
      for (let row = 1; row <= DRY_LANES; row += 1) {
        expect(shellOf(laneAt(seed, row, elapsed))).toEqual(
          shellOf(laneAt(seed, row, 0)),
        );
      }
    }
  });
});
