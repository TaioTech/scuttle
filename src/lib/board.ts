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
  STILL_COUNT,
  STILL_LANE_CHANCE,
  STILL_WIDTH,
  SHELL_CHANCE,
  SHELL_GAP_BIAS,
  SHELL_HALF_W,
  SURF_BREAK_TICKS,
  SURF_LANES,
  SURF_PERIOD_TICKS,
  SURF_ROW_LAG,
  TIDE_FULL_TICKS,
  UMBRELLA_CHANCE,
  UMBRELLA_PLANT_TICKS,
  UMBRELLA_PLANTS,
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
  /**
   * The run tick this hazard becomes lethal, or zero if it always was.
   *
   * An umbrella plants itself into a lane mid-run, which a towel never does.
   * Rather than making the lane itself change shape over time, the hazard is
   * generated once and simply is not lethal yet — so `laneAt` stays pure in the
   * seed and the row for the whole dry sand, and only the *reading* of a hazard
   * depends on when you ask.
   *
   * That is what keeps the crossability guarantee intact. The lane is laid out
   * with every hazard present and every gap at its minimum; an umbrella that
   * has not planted yet only ever makes the lane wider than the guarantee
   * requires, so no seed and no moment can produce a lane that cannot be
   * crossed.
   */
  plantsAt: number;
};

/** A lane with nothing in it. Somewhere to stand and think. */
export type SafeLane = { kind: "safe" };

/** The water at the end of the beach. Reaching it is winning. */
export type SeaLane = { kind: "sea" };

/**
 * Wet sand between the dry beach and the surf. Safe to stand on, and shrinking.
 *
 * Its own variant rather than a `safe` lane so the renderer can draw it as the
 * thing the tide is taking, and so the compiler will not let a later change
 * treat "somewhere to rest" and "somewhere the water has not reached yet" as
 * the same fact.
 */
export type TideLine = { kind: "tideline" };

/**
 * Water that carries rather than kills.
 *
 * A surf lane washes on a cycle. While it washes it moves a crab standing in it
 * one lane back toward shore; between sets it is simply somewhere to stand.
 * Nothing in the surf is ever lethal, so it never appears in a collision test —
 * the danger is where the wave leaves you, not the wave.
 */
export type SurfLane = { kind: "surf" };

/**
 * Where a lane's shell sits, in board units from the left edge, or `null`.
 *
 * Board space rather than the lane's own space, even for a drifting lane: a
 * shell is a thing lying on the sand and the crowd walks over it. That is also
 * what makes a drifting lane's shell reachable by construction — every point on
 * the board is under a gap at some phase of the cycle, so waiting is always an
 * option and the only question is whether it is worth the time.
 */
export type ShellAt = number | null;

/** Towels and sunbathers: dry sand that simply is not available. */
export type StillLane = { kind: "still"; hazards: Hazard[]; shell: ShellAt };

/** Beachgoers walking the sand, wrapping around off-board and coming back. */
export type DriftLane = {
  kind: "drift";
  direction: 1 | -1;
  /** Board units per second. */
  speed: number;
  hazards: Hazard[];
  shell: ShellAt;
};

/**
 * One row of the beach.
 *
 * A discriminated union rather than a lane with optional fields, so the tide
 * line and the surf can be added later as new variants that the compiler
 * forces every caller to handle.
 */
export type Lane = SafeLane | SeaLane | TideLine | SurfLane | StillLane | DriftLane;

/**
 * A whole beach, addressed by row and by how long the run has been going.
 *
 * The simulation takes one of these rather than a seed, so the thing that
 * decides what is in a lane stays outside the thing that decides what happens
 * when the crab touches it. That is what lets the movement rules be tested on
 * an empty beach.
 *
 * The second argument is here because of the tide, and it means exactly what
 * the board comment always promised it would: a tide shifts which row is which,
 * which is a different beach and not a different simulation. A beach that
 * ignores it is still a beach — most of the test fixtures are — because a
 * tideless board is simply one the water never reaches.
 *
 * It is `elapsed` and not `tick` on purpose. See {@link tideAt}.
 */
export type Beach = (row: number, elapsed: number) => Lane;

/** The beach for one day's seed. */
export function beachFor(seed: number): Beach {
  return (row, elapsed) => laneAt(seed, row, elapsed);
}

/**
 * How far in the tide is, from nothing at the run's first tick to fully in.
 *
 * Measured in `elapsed` — ticks since the player's first input — rather than in
 * `tick`, which counts from the moment the page loaded. The run's clock waits
 * for the player so they can read the day's beach before committing to it, and
 * a tide that did not wait with it would quietly charge them a quarter of the
 * escalation for looking. Standing still is meant to cost something, but only
 * once standing still is a choice inside a run rather than a decision not to
 * have started one.
 *
 * Hazards and waves keep moving on `tick` while the player reads, because a
 * board frozen until first input is one whose rhythms cannot be read at all.
 * The beach is alive whether or not anybody is playing; the tide is the run's
 * own pressure and belongs to the run.
 *
 * A function of that count and nothing else, which is what keeps two devices on
 * the same beach: they need only have simulated the same number of ticks, not
 * to have measured the same amount of time.
 */
export function tideAt(elapsed: number): number {
  const progress = elapsed / TIDE_FULL_TICKS;
  return progress < 0 ? 0 : progress > 1 ? 1 : progress;
}

/**
 * The first row that is surf, given how long the run has been going.
 *
 * Descends as the tide comes in, so the water reaches further up the beach and
 * the wet sand behind it narrows. Floored at the last row of dry sand: the tide
 * takes the tide line and stops.
 */
export function waterlineAt(elapsed: number): number {
  const lanes =
    SURF_LANES.low + (SURF_LANES.high - SURF_LANES.low) * tideAt(elapsed);
  return BEACH_LANES - Math.floor(lanes) + 1;
}

/**
 * Whether a surf lane is washing at the given tick.
 *
 * Lanes nearer the sea break first, so a set reads as a wave running shoreward
 * rather than as the whole band flickering together. Like every other position
 * in this file it is a closed form of the tick, never a counter that advances.
 */
export function surfWashingAt(row: number, tick: number): boolean {
  const offset = row * SURF_ROW_LAG;
  return wrap(tick + offset, SURF_PERIOD_TICKS) < SURF_BREAK_TICKS;
}

/**
 * The lane at a given row of the day's beach, at a given point in a run.
 *
 * Pure in the seed, the row and the elapsed count: the same three always give
 * the same lane, on any device, in any order, however many times it is asked.
 * Nothing is cached because nothing needs to be — a lane is a few dozen
 * arithmetic operations, and a cache is a place for two devices to disagree.
 *
 * Row zero is the crab's starting row and is always safe, and everything past
 * {@link BEACH_LANES} is the sea. Only the band boundaries move with the tide;
 * what is actually in a dry-sand lane stays pure in the seed and the row, so
 * the tide can never change a hazard the crab has already committed to.
 */
export function laneAt(seed: number, row: number, elapsed = 0): Lane {
  // Row zero and everything behind it is the promenade the crab starts on.
  if (row <= 0) return { kind: "safe" };
  // The beach ends. Every row past it is water, so a crab that overshoots the
  // shoreline is still in the sea rather than off the end of the world.
  if (row > BEACH_LANES) return { kind: "sea" };
  if (row >= waterlineAt(elapsed)) return { kind: "surf" };
  if (row > DRY_LANES) return { kind: "tideline" };
  if (row % SAFE_LANE_INTERVAL === 0) return { kind: "safe" };

  const rng = deriveRng(seed, row);
  const strength = laneStrength(row);

  if (rng() < STILL_LANE_CHANCE) {
    const hazards = placeHazards(rng, {
      span: BOARD_WIDTH,
      cyclic: false,
      minGap: MIN_GAP.still,
      count: rangeInt(rng, STILL_COUNT.min, STILL_COUNT.max),
      minWidth: STILL_WIDTH.min,
      maxWidth: lerp(STILL_WIDTH.min, STILL_WIDTH.max, strength),
      plantable: true,
    });
    return { kind: "still", hazards, shell: placeShell(rng, hazards) };
  }

  const hazards = placeHazards(rng, {
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
  });

  return {
    kind: "drift",
    direction: rng() < 0.5 ? -1 : 1,
    speed: rangeFloat(
      rng,
      DRIFT_SPEED.min,
      lerp(DRIFT_SPEED.min, DRIFT_SPEED.max, strength),
    ),
    hazards,
    shell: placeShell(rng, null),
  };
}

/**
 * Where a lane's shell lies, or `null` if it has none.
 *
 * Two cases, and the difference is what makes the reachability guarantee
 * structural rather than something to be checked afterwards.
 *
 * A drifting lane's hazards sweep the whole board, so every point on it is
 * under a gap at some phase of the cycle. Any position is reachable; the shell
 * only has to be somewhere the crab can physically stand, which means clear of
 * the walls. Pass `null` for the hazards and it lands anywhere on the board.
 *
 * A still lane's hazards never move, so a shell has to be placed relative to
 * them or it is simply buried. It goes inside one of the lane's gaps, offset
 * from that gap's centre by a fraction of the room actually available — a
 * fraction rather than a distance, so the offset cannot push it into a hazard
 * however narrow the gap. Dead centre would put the shell exactly where a
 * player crossing that gap already stands, and a pickup that costs nothing is
 * not the optional risk the spec asks for.
 */
function placeShell(rng: () => number, hazards: Hazard[] | null): ShellAt {
  if (rng() >= SHELL_CHANCE) return null;

  const lowest = PLAYER_HALF_W;
  const highest = BOARD_WIDTH - PLAYER_HALF_W;

  if (hazards === null) return rangeFloat(rng, lowest, highest);

  // The open runs between this lane's hazards, in board space, including the
  // stretches against each wall.
  const edges = [...hazards].sort((a, b) => a.center - b.center);
  const runs: { from: number; to: number }[] = [];
  let cursor = 0;
  for (const hazard of edges) {
    runs.push({ from: cursor, to: hazard.center - hazard.halfWidth });
    cursor = hazard.center + hazard.halfWidth;
  }
  runs.push({ from: cursor, to: BOARD_WIDTH });

  const usable = runs
    .map((run) => ({
      from: Math.max(run.from + SHELL_HALF_W, lowest),
      to: Math.min(run.to - SHELL_HALF_W, highest),
    }))
    .filter((run) => run.to > run.from);

  if (usable.length === 0) return null;

  const run = usable[rangeInt(rng, 0, usable.length - 1)];
  const middle = (run.from + run.to) / 2;
  const room = (run.to - run.from) / 2;
  const side = rng() < 0.5 ? -1 : 1;
  return middle + side * room * SHELL_GAP_BIAS;
}

/** How many shells the day's beach has in it, all told. */
export function shellCount(seed: number): number {
  let total = 0;
  for (let row = 1; row <= DRY_LANES; row += 1) {
    if (shellOf(laneAt(seed, row)) !== null) total += 1;
  }
  return total;
}

/** A lane's shell, or `null` for a lane that has no room for one. */
export function shellOf(lane: Lane): ShellAt {
  return hasHazards(lane) ? lane.shell : null;
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
  if (!hasHazards(lane)) return [];

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
  if (!hasHazards(lane)) return Number.POSITIVE_INFINITY;
  return lane.kind === "drift" ? MIN_GAP.drift : MIN_GAP.still;
}

/**
 * Whether a lane has anything solid in it.
 *
 * Asked rather than listing the empty kinds at every call site, so adding a
 * band to the beach is one change here instead of a hunt for the places that
 * happened to enumerate them. The surf is deliberately on the empty side: it
 * acts on the crab, but nothing in it is ever lethal.
 */
export function hasHazards(lane: Lane): lane is StillLane | DriftLane {
  return lane.kind === "still" || lane.kind === "drift";
}

type Placement = {
  span: number;
  cyclic: boolean;
  minGap: number;
  count: number;
  minWidth: number;
  maxWidth: number;
  /** Whether one of these may turn out to be an umbrella that plants later. */
  plantable?: boolean;
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
    hazards.push({
      center: cursor + widths[i] / 2,
      halfWidth: widths[i] / 2,
      plantsAt: 0,
    });
    cursor += widths[i];
  }

  // One of a still lane's blockers may turn out to be an umbrella, which is
  // there from the start as far as the layout is concerned and only becomes
  // lethal partway through the run. Chosen after the layout rather than during
  // it, so the gap arithmetic never has to know this happened.
  if (spec.plantable && hazards.length > 0 && rng() < UMBRELLA_CHANCE) {
    const which = rangeInt(rng, 0, hazards.length - 1);
    hazards[which] = {
      ...hazards[which],
      plantsAt: Math.round(
        rangeFloat(rng, UMBRELLA_PLANTS.earliest, UMBRELLA_PLANTS.latest),
      ),
    };
  }

  return hazards;
}

/** Whether a hazard is lethal yet, given how long the run has been going. */
export function isPlanted(hazard: Hazard, elapsed: number): boolean {
  return elapsed >= hazard.plantsAt;
}

/**
 * How far through its arrival an umbrella is, from zero to one, or null if it
 * is not currently arriving.
 *
 * The spec's obligation for this hazard: a thing that was not lethal a moment
 * ago and now is needs a moment the player can see, rather than appearing
 * between one frame and the next. This is that moment, and like every other
 * animation in the game it is a function of the run's clock and nothing else.
 */
export function plantingProgress(
  hazard: Hazard,
  elapsed: number,
): number | null {
  if (hazard.plantsAt === 0) return null;
  const since = elapsed - (hazard.plantsAt - UMBRELLA_PLANT_TICKS);
  if (since < 0 || since >= UMBRELLA_PLANT_TICKS) return null;
  return since / UMBRELLA_PLANT_TICKS;
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
