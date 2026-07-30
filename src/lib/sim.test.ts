import { describe, expect, it } from "vitest";
import {
  type Beach,
  beachFor,
  laneAt,
  surfWashingAt,
} from "./board";
import {
  BOARD_WIDTH,
  DT,
  LANE_HEIGHT,
  LATERAL_SPEED,
  MAX_FRAME_MS,
  PLAYER_HALF_W,
  BEACH_LANES,
  STEP_BUFFER_TICKS,
  STEP_TICKS,
  SURF_GRACE_TICKS,
  SURF_PERIOD_TICKS,
  TICK_MS,
  TIDE_FULL_TICKS,
} from "./constants";
import { drainTicks } from "./loop";
import { seedForDay } from "./rng";
import {
  createSim,
  formatElapsed,
  type Input,
  playerY,
  type SimState,
  stepSim,
} from "./sim";

const SEED = seedForDay(42);
const DAY: Beach = beachFor(SEED);

/**
 * A beach with nothing on it.
 *
 * The movement rules and the hazards are separate concerns, and a step that
 * takes two fifths of a second always crosses a lane with something in it —
 * so measuring the step on the real beach mostly measures dying.
 */
const EMPTY: Beach = () => ({ kind: "safe" });

/** Three lanes of safe sand and then the water, for testing the finish. */
const SHORE: Beach = (row) => (row >= 3 ? { kind: "sea" } : { kind: "safe" });

const IDLE: Input = { left: false, right: false, forward: false };
const LEFT: Input = { ...IDLE, left: true };
const RIGHT: Input = { ...IDLE, right: true };
const FORWARD: Input = { ...IDLE, forward: true };

/** Runs `count` ticks with the same buttons held throughout. */
function hold(
  state: SimState,
  input: Input,
  count: number,
  beach: Beach = EMPTY,
): SimState {
  let next = state;
  for (let i = 0; i < count; i += 1) next = stepSim(next, input, beach);
  return next;
}

/** One tick on the empty beach. */
function oneTick(state: SimState, input: Input): SimState {
  return stepSim(state, input, EMPTY);
}

/** Steps forward `lanes` times on {@link SHORE}, landing each one. */
function crossTo(lanes: number): SimState {
  let state = createSim();
  for (let lane = 0; lane < lanes; lane += 1) {
    state = hold(stepSim(state, FORWARD, SHORE), IDLE, STEP_TICKS, SHORE);
  }
  return state;
}

describe("lateral movement", () => {
  it("moves at the lateral speed while held", () => {
    const after = hold(createSim(), RIGHT, 60);
    expect(after.x).toBeCloseTo(BOARD_WIDTH / 2 + LATERAL_SPEED * 60 * DT, 6);
  });

  it("reverses the instant the other button is held", () => {
    const right = hold(createSim(), RIGHT, 30);
    const back = hold(right, LEFT, 30);
    expect(back.x).toBeCloseTo(BOARD_WIDTH / 2, 6);
  });

  it("does nothing when both are held", () => {
    const after = hold(createSim(), { ...IDLE, left: true, right: true }, 60);
    expect(after.x).toBe(BOARD_WIDTH / 2);
  });

  it("stops at the edges of the board", () => {
    const left = hold(createSim(), LEFT, 600);
    expect(left.x).toBe(PLAYER_HALF_W);

    const right = hold(createSim(), RIGHT, 600);
    expect(right.x).toBe(BOARD_WIDTH - PLAYER_HALF_W);
  });

  it("is finer grained than a lane is wide", () => {
    // One tick of sideways travel has to be small enough that positioning
    // inside a gap is a real thing the player can do.
    const one = oneTick(createSim(), RIGHT);
    expect(one.x - BOARD_WIDTH / 2).toBeLessThan(1);
  });
});

describe("the forward step", () => {
  it("takes exactly the step duration and lands one lane on", () => {
    let state = oneTick(createSim(), FORWARD);
    expect(state.step).not.toBeNull();

    state = hold(state, IDLE, STEP_TICKS - 2);
    expect(state.step).not.toBeNull();
    expect(state.row).toBe(0);

    state = oneTick(state, IDLE);
    expect(state.step).toBeNull();
    expect(state.row).toBe(1);
  });

  it("completes even though the button was released immediately", () => {
    const begun = oneTick(createSim(), FORWARD);
    const landed = hold(begun, IDLE, STEP_TICKS);
    expect(landed.row).toBe(1);
  });

  it("cannot be cancelled by pressing back or sideways", () => {
    let state = oneTick(createSim(), FORWARD);
    const startedAt = state.x;
    state = hold(state, LEFT, STEP_TICKS - 1);
    expect(state.row).toBe(1);
    expect(state.x).toBe(startedAt);
  });

  it("refuses lateral input for its whole duration", () => {
    const begun = oneTick(createSim(), RIGHT);
    const stepping = oneTick(begun, FORWARD);
    const during = hold(stepping, RIGHT, STEP_TICKS - 3);
    expect(during.x).toBe(stepping.x);
  });

  it("moves the crab smoothly across the lane rather than jumping", () => {
    let state = oneTick(createSim(), FORWARD);
    let previous = LANE_HEIGHT / 2;
    for (let i = 1; i < STEP_TICKS; i += 1) {
      const y = playerY(state);
      expect(y).toBeGreaterThan(previous);
      expect(y - previous).toBeCloseTo(LANE_HEIGHT / STEP_TICKS, 6);
      previous = y;
      state = oneTick(state, IDLE);
    }
    expect(playerY(state)).toBeCloseTo(LANE_HEIGHT / 2 + LANE_HEIGHT, 6);
  });

  it("does not auto-repeat while the button is held", () => {
    // Holding forward crosses one lane, not the beach. Every lane is a
    // separate decision.
    const held = hold(createSim(), FORWARD, STEP_TICKS * 3);
    expect(held.row).toBe(1);
    expect(held.step).toBeNull();
  });
});

describe("the forward buffer", () => {
  it("carries a late press into the next step", () => {
    let state = oneTick(createSim(), FORWARD);
    state = hold(state, IDLE, STEP_TICKS - STEP_BUFFER_TICKS);
    state = oneTick(state, FORWARD);
    state = hold(state, IDLE, STEP_TICKS - state.step!.elapsed);
    expect(state.row).toBe(1);

    // The tick after landing, the buffered press starts the next step.
    state = oneTick(state, IDLE);
    expect(state.step).not.toBeNull();
    expect(state.step!.to).toBe(2);
  });

  it("lets an early press expire unheard", () => {
    let state = oneTick(createSim(), FORWARD);
    state = oneTick(state, FORWARD);
    state = hold(state, IDLE, STEP_TICKS + 2);
    expect(state.row).toBe(1);
    expect(state.step).toBeNull();
  });
});

describe("collision", () => {
  /** The first still lane of the day, and a point inside one of its blockers. */
  function insideABlocker(): { row: number; x: number } {
    for (let row = 1; row < 200; row += 1) {
      const lane = laneAt(SEED, row);
      if (lane.kind !== "still") continue;
      const blocker = lane.hazards.find(
        (h) =>
          h.center > PLAYER_HALF_W && h.center < BOARD_WIDTH - PLAYER_HALF_W,
      );
      if (blocker) return { row, x: blocker.center };
    }
    throw new Error("no still lane with a reachable blocker in the first 200 rows");
  }

  it("ends the run when the crab is standing in a hazard", () => {
    const { row, x } = insideABlocker();
    const state: SimState = { ...createSim(), row, x };
    expect(stepSim(state, IDLE, DAY).alive).toBe(false);
  });

  it("leaves the crab alone on the starting lane whatever it does", () => {
    let state = createSim();
    for (let i = 0; i < 600; i += 1) {
      state = stepSim(state, i % 120 < 60 ? LEFT : RIGHT, DAY);
    }
    expect(state.alive).toBe(true);
    expect(state.row).toBe(0);
  });

  it("kills the crab mid-step, not only where it was going to land", () => {
    // Walk forty days of beach. Every death that lands while a step is still
    // in progress is one that testing the destination alone would have missed.
    let midStep = 0;
    let onLanding = 0;
    for (let day = 0; day < 40; day += 1) {
      const beach = beachFor(seedForDay(day));
      let state = createSim();
      for (let t = 0; t < 4_000 && state.alive; t += 1) {
        const wasStepping = state.step !== null;
        state = stepSim(state, t % 30 === 0 ? FORWARD : IDLE, beach);
        if (!state.alive) {
          if (wasStepping) midStep += 1;
          else onLanding += 1;
        }
      }
    }
    expect(midStep).toBeGreaterThan(0);
    expect(midStep + onLanding).toBeGreaterThan(30);
  });

  it("stops advancing once the run is over", () => {
    const { row, x } = insideABlocker();
    const dead = stepSim({ ...createSim(), row, x }, IDLE, DAY);
    expect(dead.alive).toBe(false);
    expect(hold(dead, FORWARD, 100, DAY)).toBe(dead);
  });

  it("wins when the crab reaches the water", () => {
    let state = createSim();
    for (let lane = 0; lane < 3; lane += 1) {
      expect(state.won).toBe(false);
      state = hold(oneTick(state, FORWARD), IDLE, STEP_TICKS, SHORE);
    }
    expect(state.row).toBe(3);
    expect(state.won).toBe(true);
    expect(state.alive).toBe(true);
  });

  it("stops advancing once the sea is reached", () => {
    const won = crossTo(3);
    expect(won.won).toBe(true);
    expect(hold(won, FORWARD, 100, SHORE)).toBe(won);
  });

  it("asks the beach where the water is rather than a row number", () => {
    // The tide will move the shoreline. A simulation that compares against a
    // fixed row is one the tide cannot move.
    const nearer: Beach = (row) =>
      row >= 1 ? { kind: "sea" } : { kind: "safe" };
    const state = hold(oneTick(createSim(), FORWARD), IDLE, STEP_TICKS, nearer);
    expect(state.row).toBe(1);
    expect(state.won).toBe(true);
  });

  it("counts the furthest lane the crab actually reached", () => {
    let state = createSim();
    state = hold(oneTick(state, FORWARD), IDLE, STEP_TICKS);
    expect(state.row).toBe(1);
    expect(state.furthest).toBe(1);

    // A step that is still in the air has not been survived yet.
    const inTheAir = oneTick(state, FORWARD);
    expect(inTheAir.furthest).toBe(1);
  });
});

describe("the clock", () => {
  it("does not start until the player touches something", () => {
    const waiting = hold(createSim(), IDLE, 300);
    expect(waiting.started).toBe(false);
    expect(waiting.elapsed).toBe(0);
  });

  it("starts on the first input and counts every tick after it", () => {
    const idled = hold(createSim(), IDLE, 100);
    const moved = hold(idled, RIGHT, 60);
    expect(moved.started).toBe(true);
    expect(moved.elapsed).toBe(60);

    // Letting go does not stop it. The run is running.
    expect(hold(moved, IDLE, 40).elapsed).toBe(100);
  });

  it("counts ticks and not milliseconds", () => {
    // The same run at any frame rate is the same number of ticks, which is the
    // only reason a shared time means anything.
    expect(formatElapsed(0)).toBe("0.0s");
    expect(formatElapsed(60)).toBe("1.0s");
    expect(formatElapsed(90)).toBe("1.5s");
    expect(formatElapsed(4_215)).toBe("70.3s");
  });

  it("stops when the sea is reached", () => {
    const won = crossTo(3);
    expect(won.won).toBe(true);
    const after = hold(won, RIGHT, 200, SHORE);
    expect(after.elapsed).toBe(won.elapsed);
  });

  it("stops when the crab dies", () => {
    // A lane that is solid all the way across, so the death needs no searching
    // for and the test is about the clock rather than about the beach.
    const lethal: Beach = () => ({
      kind: "still",
      hazards: [{ center: BOARD_WIDTH / 2, halfWidth: BOARD_WIDTH / 2 }],
    });

    const running = hold(createSim(), RIGHT, 50);
    expect(running.elapsed).toBe(50);

    const dead = stepSim(running, IDLE, lethal);
    expect(dead.alive).toBe(false);
    expect(hold(dead, RIGHT, 100).elapsed).toBe(dead.elapsed);
  });
});

describe("determinism", () => {
  /** A fixed script of button presses, keyed by tick rather than by clock. */
  function scripted(t: number): Input {
    // Sideways for the first while, so two days diverge on where the crab is
    // before they diverge on what it walks into.
    if (t > 40 && t % 37 === 0) return FORWARD;
    if (t % 7 < 3) return LEFT;
    if (t % 11 < 4) return RIGHT;
    return IDLE;
  }

  function run(seed: number, ticks: number): SimState {
    const beach = beachFor(seed);
    let state = createSim();
    for (let t = 0; t < ticks; t += 1) state = stepSim(state, scripted(t), beach);
    return state;
  }

  it("replays a run exactly", () => {
    expect(run(SEED, 3_000)).toEqual(run(SEED, 3_000));
  });

  it("never reads a clock or an unseeded source", () => {
    const random = Math.random;
    const now = Date.now;
    Math.random = () => {
      throw new Error("the simulation reached Math.random");
    };
    Date.now = () => {
      throw new Error("the simulation reached Date.now");
    };
    try {
      expect(() => run(SEED, 3_000)).not.toThrow();
    } finally {
      Math.random = random;
      Date.now = now;
    }
  });

  it("does not modify the state it is given", () => {
    const before = createSim();
    const snapshot = structuredClone(before);
    stepSim(before, FORWARD, DAY);
    expect(before).toEqual(snapshot);
  });

  it("plays the beach it was handed rather than a fixed one", () => {
    // Deliberately a weak bound. How much two days differ is a property of the
    // board and is asserted there; all this has to catch is a simulation that
    // ignores the beach it was given, and a fixed script dies early enough
    // that most days end the same way whatever the beach was.
    const outcomes = new Set(
      Array.from({ length: 20 }, (_, day) =>
        JSON.stringify(run(seedForDay(day), 2_000)),
      ),
    );
    expect(outcomes.size).toBeGreaterThan(1);
  });
});

describe("frame rate", () => {
  /** Ticks earned over `durationMs` of wall clock at a steady frame rate. */
  function ticksOver(frameMs: number, durationMs: number): number {
    let pending = 0;
    let ticks = 0;
    const frames = Math.round(durationMs / frameMs);
    for (let i = 0; i < frames; i += 1) {
      const drain = drainTicks(pending, frameMs);
      pending = drain.pending;
      ticks += drain.ticks;
    }
    return ticks;
  }

  it("earns the same ticks per second however the frames arrive", () => {
    // A phone at 120 Hz, a laptop at 60 Hz and something struggling at 20 Hz
    // all simulate the same ten seconds of beach.
    const rates = [120, 60, 30, 20].map((hz) => ticksOver(1000 / hz, 10_000));
    for (const ticks of rates) {
      expect(ticks).toBeGreaterThanOrEqual(599);
      expect(ticks).toBeLessThanOrEqual(600);
      expect(Math.abs(ticks - rates[0])).toBeLessThanOrEqual(1);
    }
  });

  it("carries fractions of a tick between frames rather than losing them", () => {
    const drain = drainTicks(0, TICK_MS * 1.5);
    expect(drain.ticks).toBe(1);
    expect(drain.pending).toBeCloseTo(TICK_MS * 0.5, 9);
  });

  it("drops the excess of a very long frame instead of trying to catch up", () => {
    const drain = drainTicks(0, 5_000);
    expect(drain.ticks).toBe(Math.floor(MAX_FRAME_MS / TICK_MS));
  });

  it("produces an identical run whatever the frame pacing was", () => {
    // Ten seconds of held input, delivered as smooth 120 Hz frames and as a
    // stuttering 20 Hz mess, has to leave the crab in exactly the same place.
    const simulate = (frameMs: number, targetTicks: number): SimState => {
      let state = createSim();
      let pending = 0;
      while (state.tick < targetTicks) {
        const drain = drainTicks(pending, frameMs);
        pending = drain.pending;
        for (let i = 0; i < drain.ticks && state.tick < targetTicks; i += 1) {
          state = stepSim(state, RIGHT, DAY);
        }
      }
      return state;
    };

    const smooth = simulate(1000 / 120, 600);
    const stuttering = simulate(1000 / 20, 600);
    const awful = simulate(MAX_FRAME_MS, 600);

    expect(stuttering).toEqual(smooth);
    expect(awful).toEqual(smooth);
  });
});

describe("the surf", () => {
  /** Every row is surf, so a wave is the only thing that can happen. */
  const SURF: Beach = () => ({ kind: "surf" });

  /**
   * Surf everywhere except one lane of lethal sand where a wave will set the
   * crab down. The whole point of the immunity is what happens on that lane.
   */
  const SURF_OVER_TEETH = (deadRow: number): Beach =>
    (row) =>
      row === deadRow
        ? {
            kind: "still",
            hazards: [{ center: BOARD_WIDTH / 2, halfWidth: BOARD_WIDTH / 2 }],
          }
        : { kind: "surf" };

  /** The first tick at or after `from` on which the given row is washing. */
  function nextBreak(row: number, from = 0): number {
    for (let tick = from; tick < from + SURF_PERIOD_TICKS * 2; tick += 1) {
      if (surfWashingAt(row, tick)) return tick;
    }
    throw new Error("the surf never broke");
  }

  /** A crab standing on `row`, wound forward to just before a wave breaks. */
  function waitingForAWave(row: number, beach: Beach = SURF): SimState {
    const breaks = nextBreak(row, 2);
    let state: SimState = { ...createSim(), row, tick: breaks - 1 };
    state = stepSim(state, IDLE, beach);
    return state;
  }

  it("carries a standing crab one lane toward shore", () => {
    const state = waitingForAWave(20);
    expect(state.step).toEqual({ from: 20, to: 19, elapsed: 1 });
  });

  it("does not end the run", () => {
    const caught = waitingForAWave(20);
    const landed = hold(caught, IDLE, STEP_TICKS, SURF);
    expect(landed.alive).toBe(true);
    expect(landed.won).toBe(false);
    expect(landed.row).toBe(19);
  });

  it("cannot kill the crab it is carrying", () => {
    // The rule that makes "carries rather than kills" mean anything. Without
    // it the wave does not kill the player, it arranges for the beach to.
    const beach = SURF_OVER_TEETH(19);
    const caught = waitingForAWave(20, beach);
    expect(caught.immune).toBeGreaterThan(0);

    const landed = hold(caught, IDLE, STEP_TICKS, beach);
    expect(landed.alive).toBe(true);
    expect(landed.row).toBe(19);
  });

  it("keeps the crab alive for a beat after setting it down, and no longer", () => {
    const beach = SURF_OVER_TEETH(19);
    const caught = waitingForAWave(20, beach);

    // Still standing on lethal sand a moment after landing.
    const sheltered = hold(caught, IDLE, STEP_TICKS + SURF_GRACE_TICKS - 2, beach);
    expect(sheltered.alive).toBe(true);
    expect(sheltered.row).toBe(19);

    // The grace runs out and the sand is what it always was.
    const exposed = hold(sheltered, IDLE, 3, beach);
    expect(exposed.alive).toBe(false);
  });

  it("lets a crab that committed to leaving get away", () => {
    // Forward is resolved before the wave, so a press on the tick a set breaks
    // is an escape rather than a collision of intents.
    const breaks = nextBreak(20, 2);
    const before: SimState = { ...createSim(), row: 20, tick: breaks - 1 };
    const state = stepSim(before, FORWARD, SURF);
    expect(state.step).toEqual({ from: 20, to: 21, elapsed: 1 });
    expect(state.immune).toBe(0);
  });

  it("does not interrupt a step already under way", () => {
    // The step is uninterruptible whatever is happening to the lane it left.
    const breaks = nextBreak(20, 40);
    let state: SimState = { ...createSim(), row: 20, tick: breaks - 8 };
    state = stepSim(state, FORWARD, SURF);
    const mid = hold(state, IDLE, 6, SURF);
    expect(mid.step?.to).toBe(21);
    expect(mid.immune).toBe(0);
  });

  it("costs a lane per set rather than an unbroken ride to the sand", () => {
    // The grace beat also stops a crab set down in still-washing surf from
    // being picked straight back up.
    const caught = waitingForAWave(20);
    const landed = hold(caught, IDLE, STEP_TICKS, SURF);
    expect(landed.row).toBe(19);

    const during = hold(landed, IDLE, SURF_GRACE_TICKS - 2, SURF);
    expect(during.row).toBe(19);
    expect(during.step).toBeNull();
  });

  it("never carries the crab off the back of the world", () => {
    let state: SimState = { ...createSim(), row: 1 };
    state = hold(state, IDLE, SURF_PERIOD_TICKS * 6, SURF);
    expect(state.row).toBeGreaterThanOrEqual(0);
    expect(state.alive).toBe(true);
  });

  it("is not something a crab can be killed by", () => {
    const state = hold(createSim(), IDLE, SURF_PERIOD_TICKS * 4, SURF);
    expect(state.alive).toBe(true);
  });
});

describe("the tide", () => {
  it("puts two devices on the same beach given the same inputs", () => {
    // The tide advances with the tick, so a run is still reproducible tick for
    // tick — what changes is that a player who dawdles meets a different board.
    const scripted = (t: number): Input =>
      t % 90 === 0 ? FORWARD : t % 7 < 4 ? RIGHT : LEFT;

    const run = (): SimState => {
      let state = createSim();
      const beach = beachFor(SEED);
      for (let t = 0; t < 4_000; t += 1) state = stepSim(state, scripted(t), beach);
      return state;
    };

    expect(run()).toEqual(run());
  });

  it("does not come in while the player is still reading the beach", () => {
    // The run's clock waits for the first input so the day's beach can be read
    // before it is committed to. A tide that did not wait with it would charge
    // the player a slice of the escalation for looking.
    const beach = beachFor(SEED);
    const idled = hold(createSim(), IDLE, TIDE_FULL_TICKS, beach);
    expect(idled.elapsed).toBe(0);
    expect(idled.tick).toBe(TIDE_FULL_TICKS);

    for (let row = 1; row <= BEACH_LANES; row += 1) {
      expect(beach(row, idled.elapsed)).toEqual(beach(row, 0));
    }
  });

  it("starts coming in the moment the player does", () => {
    const beach = beachFor(SEED);
    const waited = hold(createSim(), IDLE, 2_000, beach);
    const playing = hold(waited, RIGHT, TIDE_FULL_TICKS, beach);
    expect(playing.elapsed).toBe(TIDE_FULL_TICKS);
    expect(beach(BEACH_LANES - 5, playing.elapsed).kind).toBe("surf");
  });

  it("changes the board under a player who waits", () => {
    // Standing still has to cost something concrete, or the clock only matters
    // to the scoreboard and camping is free.
    const beach = beachFor(SEED);
    const early = beach(BEACH_LANES - 5, 0);
    const late = beach(BEACH_LANES - 5, TIDE_FULL_TICKS);
    expect(early.kind).not.toBe(late.kind);
    expect(late.kind).toBe("surf");
  });
});
