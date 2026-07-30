import {
  BEACH_LANES,
  BOARD_WIDTH,
  CYCLE_SPAN,
  DRIFT_COUNT,
  DRIFT_SPEED,
  DRIFT_WIDTH,
  DT,
  MIN_GAP,
  RAMP_LANES,
  SAFE_LANE_INTERVAL,
  STILL_COUNT,
  STILL_LANE_CHANCE,
  STILL_WIDTH,
  WRAP_MARGIN,
} from "./constants";
import { deriveRng, rangeFloat, rangeInt } from "./rng";

/**
 * One obstacle in a lane.
 *
 * `center` is measured in the lane's own coordinate space: board units from
 * the left edge for a still lane, and position around the cycle for a drifting
 * one. {@link hazardCenterAt} converts the latter into board space.
 */
export type Hazard = {
  center: number;
  halfWidth: number;
};

/** A lane with nothing in it. Somewhere to stand and think. */
export type SafeLane = { kind: "safe" };

/** The water at the end of the beach. Reaching it is winning. */
export type SeaLane = { kind: "sea" };

/** Towels and sunbathers: dry sand that simply is not available. */
export type StillLane = { kind: "still"; hazards: Hazard[] };

/** Beachgoers walking the sand, wrapping around off-board and coming back. */
export type DriftLane = {
  kind: "drift";
  direction: 1 | -1;
  /** Board units per second. */
  speed: number;
  hazards: Hazard[];
};

/**
 * One row of the beach.
 *
 * A discriminated union rather than a lane with optional fields, so the tide
 * line and the surf can be added later as new variants that the compiler
 * forces every caller to handle.
 */
export type Lane = SafeLane | SeaLane | StillLane | DriftLane;

/**
 * A whole beach, addressed by row.
 *
 * The simulation takes one of these rather than a seed, so the thing that
 * decides what is in a lane stays outside the thing that decides what happens
 * when the crab touches it. That is what lets the movement rules be tested on
 * an empty beach, and it is where the tide will attach when it arrives: a tide
 * shifts which row is which, which is a different beach and not a different
 * simulation.
 */
export type Beach = (row: number) => Lane;

/** The beach for one day's seed. */
export function beachFor(seed: number): Beach {
  return (row) => laneAt(seed, row);
}

/**
 * The lane at a given row of the day's beach.
 *
 * Pure in the seed and the row: the same pair always gives the same lane, on
 * any device, in any order, however many times it is asked. Nothing is cached
 * because nothing needs to be — a lane is a few dozen arithmetic operations,
 * and a cache is a place for two devices to disagree.
 *
 * Row zero is the crab's starting row and is always safe, and everything past
 * {@link BEACH_LANES} is the sea.
 */
export function laneAt(seed: number, row: number): Lane {
  // Row zero and everything behind it is the promenade the crab starts on.
  if (row <= 0) return { kind: "safe" };
  // The beach ends. Every row past it is water, so a crab that overshoots the
  // shoreline is still in the sea rather than off the end of the world.
  if (row > BEACH_LANES) return { kind: "sea" };
  if (row % SAFE_LANE_INTERVAL === 0) return { kind: "safe" };

  const rng = deriveRng(seed, row);
  const strength = laneStrength(row);

  if (rng() < STILL_LANE_CHANCE) {
    return {
      kind: "still",
      hazards: placeHazards(rng, {
        span: BOARD_WIDTH,
        cyclic: false,
        minGap: MIN_GAP.still,
        count: rangeInt(rng, STILL_COUNT.min, STILL_COUNT.max),
        minWidth: STILL_WIDTH.min,
        maxWidth: lerp(STILL_WIDTH.min, STILL_WIDTH.max, strength),
      }),
    };
  }

  return {
    kind: "drift",
    direction: rng() < 0.5 ? -1 : 1,
    speed: rangeFloat(
      rng,
      DRIFT_SPEED.min,
      lerp(DRIFT_SPEED.min, DRIFT_SPEED.max, strength),
    ),
    hazards: placeHazards(rng, {
      span: CYCLE_SPAN,
      cyclic: true,
      minGap: MIN_GAP.drift,
      count: rangeInt(
        rng,
        DRIFT_COUNT.min,
        Math.round(lerp(DRIFT_COUNT.min, DRIFT_COUNT.max, strength)),
      ),
      minWidth: DRIFT_WIDTH.min,
      maxWidth: lerp(DRIFT_WIDTH.min, DRIFT_WIDTH.max, strength),
    }),
  };
}

/**
 * How much of its full difficulty a lane at the given row is allowed, from zero
 * at the first lane to one from {@link RAMP_LANES} onward.
 *
 * It raises ceilings and never floors, so a ramped lane is drawn from a strict
 * subset of the lanes the same row could otherwise have produced. An early lane
 * is therefore never harder than an unramped one would have been, whatever the
 * seed does — the guarantee comes from the shape of the interpolation rather
 * than from checking the numbers afterwards.
 *
 * Fewer hazards is the lever that matters most. {@link placeHazards} hands out
 * every gap its minimum and then shares the surplus among however many gaps
 * there are, so dropping a lane from three hazards to two does not merely
 * remove an obstacle: it widens every remaining gap considerably.
 */
export function laneStrength(row: number): number {
  if (RAMP_LANES <= 1) return 1;
  const progress = (row - 1) / (RAMP_LANES - 1);
  return progress < 0 ? 0 : progress > 1 ? 1 : progress;
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

/**
 * Where a hazard's centre sits, in board units, at a given tick.
 *
 * Computed from the tick number rather than accumulated from the last tick.
 * Accumulation would let rounding error build up over a long run until two
 * devices that started identically had drifted apart, which is exactly the
 * failure a seeded daily cannot survive.
 */
export function hazardCenterAt(
  lane: Lane,
  hazard: Hazard,
  tick: number,
): number {
  if (lane.kind !== "drift") return hazard.center;
  const travelled = hazard.center + lane.direction * lane.speed * tick * DT;
  return wrap(travelled, CYCLE_SPAN) - WRAP_MARGIN;
}

/**
 * How far a drifting lane's hazards move in one tick. Zero for a lane that
 * does not drift.
 */
export function hazardStepPerTick(lane: Lane): number {
  return lane.kind === "drift" ? lane.direction * lane.speed * DT : 0;
}

/**
 * The gaps between a lane's hazards, in the lane's own coordinate space.
 *
 * Exists so the guarantee that every lane is crossable can be checked rather
 * than asserted — see the board tests.
 */
export function gapsOf(lane: Lane): number[] {
  if (lane.kind === "safe" || lane.kind === "sea") return [];

  const cyclic = lane.kind === "drift";
  const span = cyclic ? CYCLE_SPAN : BOARD_WIDTH;
  const edges = lane.hazards.map((h) => ({
    start: h.center - h.halfWidth,
    end: h.center + h.halfWidth,
  }));

  const gaps: number[] = [];
  for (let i = 0; i < edges.length - 1; i += 1) {
    gaps.push(edges[i + 1].start - edges[i].end);
  }

  if (cyclic) {
    gaps.push(span - edges[edges.length - 1].end + edges[0].start);
  } else {
    gaps.push(edges[0].start);
    gaps.push(span - edges[edges.length - 1].end);
  }

  return gaps;
}

/** The narrowest gap the given lane was built to leave. */
export function minGapOf(lane: Lane): number {
  if (lane.kind === "safe" || lane.kind === "sea") {
    return Number.POSITIVE_INFINITY;
  }
  return lane.kind === "drift" ? MIN_GAP.drift : MIN_GAP.still;
}

type Placement = {
  span: number;
  cyclic: boolean;
  minGap: number;
  count: number;
  minWidth: number;
  maxWidth: number;
};

/**
 * Lays hazards out along a lane so that every gap is at least {@link MIN_GAP}.
 *
 * The guarantee comes from the order of operations rather than from a retry
 * loop: every gap is handed the minimum first, every hazard is handed its
 * minimum width, and only the surplus that remains after both is randomised.
 * A lane the crab cannot cross is therefore not a thing the seed is able to
 * produce, whatever numbers come out of the generator.
 */
function placeHazards(rng: () => number, spec: Placement): Hazard[] {
  const gapCount = spec.cyclic ? spec.count : spec.count + 1;
  let surplus =
    spec.span - gapCount * spec.minGap - spec.count * spec.minWidth;

  if (surplus < 0) {
    throw new Error(
      `lane of span ${spec.span} cannot hold ${spec.count} hazards at the minimum gap`,
    );
  }

  const widths: number[] = [];
  for (let i = 0; i < spec.count; i += 1) {
    const headroom = Math.min(spec.maxWidth - spec.minWidth, surplus);
    const extra = rangeFloat(rng, 0, headroom);
    widths.push(spec.minWidth + extra);
    surplus -= extra;
  }

  const gaps = shareOut(rng, surplus, gapCount).map(
    (extra) => spec.minGap + extra,
  );

  const hazards: Hazard[] = [];
  let cursor = 0;
  for (let i = 0; i < spec.count; i += 1) {
    cursor += gaps[i];
    hazards.push({ center: cursor + widths[i] / 2, halfWidth: widths[i] / 2 });
    cursor += widths[i];
  }

  return hazards;
}

/**
 * Splits `total` into `parts` non-negative pieces with seeded weights.
 *
 * Weights are floored at a small positive value so a piece can shrink towards
 * nothing without any piece being able to swallow the whole surplus, which
 * would put every hazard in the lane shoulder to shoulder at one end.
 */
function shareOut(rng: () => number, total: number, parts: number): number[] {
  const weights: number[] = [];
  let sum = 0;
  for (let i = 0; i < parts; i += 1) {
    const weight = 0.15 + rng();
    weights.push(weight);
    sum += weight;
  }
  return weights.map((weight) => (weight / sum) * total);
}

/** Non-negative remainder, unlike `%`, which keeps the sign of its left side. */
function wrap(value: number, span: number): number {
  return ((value % span) + span) % span;
}
