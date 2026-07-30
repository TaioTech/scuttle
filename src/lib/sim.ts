import {
  BOARD_WIDTH,
  CYCLE_SPAN,
  DT,
  HAZARD_HALF_H,
  LANE_HEIGHT,
  LATERAL_SPEED,
  PLAYER_HALF_H,
  PLAYER_HALF_W,
  STEP_BUFFER_TICKS,
  STEP_TICKS,
  SURF_GRACE_TICKS,
  TICK_HZ,
} from "./constants";
import {
  type Beach,
  type DriftLane,
  hasHazards,
  hazardCenterAt,
  hazardStepPerTick,
  type Lane,
  type StillLane,
  surfWashingAt,
} from "./board";
import { sweptOverlap, type Box } from "./collision";

/** What the three buttons are doing on the tick about to be simulated. */
export type Input = {
  /** Held, not tapped: lateral motion is continuous while the button is down. */
  left: boolean;
  right: boolean;
  /**
   * Held, like the other two — the simulation takes the edge itself.
   *
   * Holding forward crosses one lane, not the beach: a held button would turn
   * a sequence of commitments into one, and forward would end up as continuous
   * as lateral, only slower, which is the asymmetry gone. Deriving the press
   * here rather than trusting the caller to send it once keeps that true no
   * matter what the input layer does.
   */
  forward: boolean;
};

/** A forward step in progress. Nothing can stop it; only ticks finish it. */
export type Step = {
  from: number;
  to: number;
  /** Ticks elapsed, from 1 on the tick the step began to {@link STEP_TICKS}. */
  elapsed: number;
};

/** Everything that varies during a run. */
export type SimState = {
  /** Ticks since the run began. The board is a function of this and the beach. */
  tick: number;
  alive: boolean;
  /** Centre of the crab, in board units from the left edge. */
  x: number;
  /** The lane the crab is standing in, or the one it is stepping out of. */
  row: number;
  step: Step | null;
  /**
   * Ticks remaining on a forward press that arrived mid-step.
   *
   * Without this, crossing two lanes back to back needs a press on the exact
   * tick a step lands, and the game feels unresponsive for a reason that has
   * nothing to do with the asymmetry being tested. The window is short enough
   * that a press early in a step still expires unheard.
   */
  buffer: number;
  /** Whether forward was down last tick, so a press can be told from a hold. */
  forwardWasDown: boolean;
  /** Furthest lane reached. The score of a run that ended on the sand. */
  furthest: number;
  /** Whether the crab reached the sea. The run is over and it was won. */
  won: boolean;
  /**
   * Whether the player has touched a control yet.
   *
   * The clock waits for them. A run timed from page load would charge the
   * player for the first paint, and it would take away the look at the day's
   * beach before committing to it — which is a real part of a game about
   * reading lanes, not dead time.
   */
  started: boolean;
  /**
   * Ticks since the first input. The score of a run that reached the sea.
   *
   * Ticks rather than milliseconds, because the simulation is forbidden a clock
   * and because a time measured in anything else is a time two devices can
   * disagree about. Seconds are a display concern.
   */
  elapsed: number;
  /**
   * Ticks of wave immunity left. Nothing can kill the crab while this is set.
   *
   * A wave carries rather than kills, and this is what makes that true of the
   * whole episode rather than only of the water itself. It covers the ride and
   * a beat past its end, so a crab set down beside a walker has time to react
   * instead of dying to a move it never made.
   */
  immune: number;
};

/**
 * Whether a wave is carrying the crab right now.
 *
 * Derived from the step running backwards rather than stored, because a step
 * toward the shore is the only thing that ever produces one and a second copy
 * of that fact is a second thing to keep true.
 */
export function isCarried(state: SimState): boolean {
  return state.step !== null && state.step.to < state.step.from;
}

/** A run at its first tick, before anything has moved. */
export function createSim(): SimState {
  return {
    tick: 0,
    alive: true,
    x: BOARD_WIDTH / 2,
    row: 0,
    step: null,
    buffer: 0,
    forwardWasDown: false,
    furthest: 0,
    won: false,
    started: false,
    elapsed: 0,
    immune: 0,
  };
}

/**
 * A run's time as seconds, to one decimal place.
 *
 * The only place ticks are turned into human time, and it is deliberately not
 * in the simulation's way: `elapsed` stays a tick count everywhere that two
 * devices have to agree, and becomes a string only when someone reads it.
 */
export function formatElapsed(ticks: number): string {
  return `${(ticks / TICK_HZ).toFixed(1)}s`;
}

/**
 * Advances the run by exactly one tick.
 *
 * Takes no delta and reads no clock. Everything that changes between two ticks
 * is a function of the tick number, the beach, and the buttons — which is what
 * makes a run on a struggling phone the same run as on a desktop, and what
 * makes the day's beach the same beach everywhere.
 *
 * Returns a new state; the argument is not modified.
 */
export function stepSim(
  state: SimState,
  input: Input,
  beach: Beach,
): SimState {
  if (!state.alive || state.won) return state;

  // The clock starts on the first thing the player does and runs until the sea.
  const started = state.started || input.left || input.right || input.forward;
  const elapsed = started ? state.elapsed + 1 : state.elapsed;

  // Every question this tick asks of the board is asked of the same board: the
  // one belonging to the tick being produced. The tide moves band boundaries
  // between ticks, and a tick that resolved its movement against one beach and
  // its collisions against another would have a seam in it exactly where the
  // water arrives.
  const tick = state.tick + 1;
  const at = (row: number): Lane => beach(row, elapsed);

  const fromX = state.x;
  const fromY = playerY(state);

  let x = state.x;
  let row = state.row;
  let step = state.step;
  let buffer = Math.max(0, state.buffer - 1);
  let immune = Math.max(0, state.immune - 1);

  const pressed = input.forward && !state.forwardWasDown;

  if (step) {
    if (pressed) buffer = STEP_BUFFER_TICKS;

    const elapsed = step.elapsed + 1;
    if (elapsed >= STEP_TICKS) {
      row = step.to;
      step = null;
    } else {
      step = { ...step, elapsed };
    }
  } else {
    const direction = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (direction !== 0) {
      x = clamp(
        x + direction * LATERAL_SPEED * DT,
        PLAYER_HALF_W,
        BOARD_WIDTH - PLAYER_HALF_W,
      );
    }

    if (pressed || buffer > 0) {
      step = { from: row, to: row + 1, elapsed: 1 };
      buffer = 0;
    }
  }

  // A wave takes a crab that is standing in washing surf and sets it down one
  // lane toward shore. It is checked after the player's own move, so a forward
  // press on the tick a wave breaks is an escape rather than a collision of
  // intents — the crab that committed to leaving is allowed to have left.
  //
  // The ride grants immunity for its whole duration and a beat past its end,
  // and that is what settles the ordering question rather than a rule about
  // which resolves first: nothing solid can act on a carried crab, so whether
  // the wave or the hazard moved first is not a thing the player can observe.
  // The grace also stops a crab set down in still-washing surf from being
  // picked straight back up, so a set costs a lane and not an unbroken ride.
  if (!step && immune === 0 && at(row).kind === "surf" && surfWashingAt(row, tick)) {
    step = { from: row, to: Math.max(0, row - 1), elapsed: 1 };
    immune = STEP_TICKS + SURF_GRACE_TICKS;
    buffer = 0;
  }

  const next: SimState = {
    ...state,
    tick,
    x,
    row,
    step,
    buffer,
    immune,
    forwardWasDown: input.forward,
    furthest: Math.max(state.furthest, row),
    // Asked of the beach rather than compared against a row number. The tide
    // moves where the water is, and a shoreline the simulation has hard-coded
    // is one the tide cannot move.
    won: at(row).kind === "sea",
    started,
    elapsed,
  };

  next.alive = immune > 0 || !struck(next, at, fromX, fromY);

  return next;
}

/**
 * The crab's vertical centre, in board units, at whatever point of a step it
 * has reached. Whole lanes when standing; anywhere in between when stepping.
 */
export function playerY(state: SimState): number {
  const row = state.step
    ? state.step.from +
      (state.step.to - state.step.from) * (state.step.elapsed / STEP_TICKS)
    : state.row;
  return row * LANE_HEIGHT + LANE_HEIGHT / 2;
}

/** The vertical centre of a lane, in board units. */
export function laneY(row: number): number {
  return row * LANE_HEIGHT + LANE_HEIGHT / 2;
}

/**
 * Whether the crab touched anything on the way from its previous position to
 * its current one.
 *
 * Only the lanes the crab actually overlaps are examined, which mid-step is
 * two: the one being left and the one being entered.
 */
function struck(
  state: SimState,
  at: (row: number) => Lane,
  fromX: number,
  fromY: number,
): boolean {
  const toY = playerY(state);
  const lowest = Math.floor((Math.min(fromY, toY) - PLAYER_HALF_H) / LANE_HEIGHT);
  const highest = Math.floor((Math.max(fromY, toY) + PLAYER_HALF_H) / LANE_HEIGHT);

  const crabStart: Box = {
    x: fromX,
    y: fromY,
    halfWidth: PLAYER_HALF_W,
    halfHeight: PLAYER_HALF_H,
  };
  const crabEnd: Box = {
    x: state.x,
    y: toY,
    halfWidth: PLAYER_HALF_W,
    halfHeight: PLAYER_HALF_H,
  };

  for (let row = Math.max(0, lowest); row <= highest; row += 1) {
    const lane = at(row);
    if (!hasHazards(lane)) continue;
    if (laneStruck(lane, row, state.tick, crabStart, crabEnd)) return true;
  }

  return false;
}

function laneStruck(
  lane: StillLane | DriftLane,
  row: number,
  tick: number,
  crabStart: Box,
  crabEnd: Box,
): boolean {
  const drift = hazardStepPerTick(lane);
  const y = laneY(row);

  for (const hazard of lane.hazards) {
    // The hazard's position at the end of the tick is authoritative, and its
    // start is that position rewound by one tick's drift in a straight line.
    // Reading the start from the previous tick's wrapped position instead would
    // put a discontinuity in the path every time a hazard crossed the seam.
    const end = hazardCenterAt(lane, hazard, tick);
    const start = end - drift;

    const box = (x: number): Box => ({
      x,
      y,
      halfWidth: hazard.halfWidth,
      halfHeight: HAZARD_HALF_H,
    });

    if (sweptOverlap(crabStart, crabEnd, box(start), box(end))) return true;

    // A hazard mid-wrap is leaving on one side and arriving on the other.
    // Testing the second image as well is what stops the seam from being a
    // hole the crab can walk through.
    if (drift !== 0) {
      const shift = drift > 0 ? CYCLE_SPAN : -CYCLE_SPAN;
      if (
        sweptOverlap(crabStart, crabEnd, box(start - shift), box(end - shift))
      ) {
        return true;
      }
    }
  }

  return false;
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}
