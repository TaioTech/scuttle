/**
 * Hazards that do not belong to a lane.
 *
 * Every hazard in `board.ts` is a thing a row contains: it is generated from
 * the row's seed, it lives in the row's coordinate space, and it is drawn
 * inside the row's slice of the render loop. These are not. A frisbee is
 * airborne and overlaps two rows at once, and a seagull strikes a patch of
 * sand rather than a lane.
 *
 * So they carry a position in continuous board coordinates and are resolved
 * separately — one collision pass over roamers, one render pass after every
 * lane. That is the whole structural difference, and keeping it in its own
 * module is what stops `board.ts`'s guarantee that a lane is crossable from
 * quietly acquiring exceptions it cannot actually enforce.
 *
 * Pure, like the rest of `lib/`, and deliberately stateless: both are closed
 * forms of the run's clock, so neither adds a field to `SimState` and neither
 * can drift. The pursuing hazard `scuttle.md` also specifies is the one that
 * would, and it is deferred for exactly that reason — see the spec.
 */

import {
  BOARD_WIDTH,
  DRY_LANES,
  FRISBEE_ARC_LANES,
  FRISBEE_FLIGHT_TICKS,
  FRISBEE_HALF,
  FRISBEE_PERIOD_TICKS,
  LANE_HEIGHT,
  SEAGULL_HALF_W,
  SEAGULL_PERIOD_TICKS,
  SEAGULL_STRIKE_TICKS,
  SEAGULL_WARN_TICKS,
} from "./constants";
import { deriveRng, rangeFloat } from "./rng";
import type { Box } from "./collision";

/** A frisbee in flight, or the fact that none is. */
export type Frisbee = {
  /** Centre in board units. `y` is in board units too, not a row index. */
  x: number;
  y: number;
  /** Which way it is travelling, for the art to lean into. */
  direction: 1 | -1;
  /** How far through its flight, zero to one, for the spin. */
  progress: number;
};

/** A seagull's attention: where it is aimed and how far along it is. */
export type Seagull = {
  x: number;
  y: number;
  /** Zero to one across the warning, then the strike. */
  warning: number;
  /** Whether the bird is actually down. Only then is the patch lethal. */
  striking: boolean;
};

/** The vertical centre of a row, in board units. */
function rowY(row: number): number {
  return row * LANE_HEIGHT + LANE_HEIGHT / 2;
}

/**
 * The frisbee in the air at this point in the run, if there is one.
 *
 * A closed form of the run's clock and the day's seed, like every position in
 * `board.ts` and for the same reason: a throw accumulated tick by tick would
 * drift, and two devices an hour into the same day would be watching different
 * frisbees.
 *
 * Its centre climbs a full lane and falls back over the flight, so it always
 * overlaps two rows and the pair it overlaps changes as it goes. That is what
 * "arcs across two lanes at once" has to mean for something with a hitbox.
 */
export function frisbeeAt(
  seed: number,
  elapsed: number,
  lockRow: number,
): Frisbee | null {
  // Nothing in the air until the first throw is due, so the opening stays the
  // opening. The ramp softens the lanes and it cannot soften something that
  // arrives from off the board.
  if (elapsed < FRISBEE_PERIOD_TICKS) return null;
  const throwIndex = Math.floor(elapsed / FRISBEE_PERIOD_TICKS);
  const into = elapsed - throwIndex * FRISBEE_PERIOD_TICKS;
  if (into >= FRISBEE_FLIGHT_TICKS) return null;

  const rng = deriveRng(seed, 9_001 + throwIndex);
  const direction: 1 | -1 = rng() < 0.5 ? -1 : 1;

  // Thrown across the band the crab was in when it was let go, offset by a
  // lane or so. A frisbee sent to a seeded row is a hazard most runs never
  // meet — the beach is thirty-two lanes and only eleven are ever on screen,
  // so a fixed row is overwhelmingly likely to be somewhere the player is not.
  // Aimed instead, it is a thing that happens to you, and it stays fair
  // because it crosses sideways from off the board: it is seen coming and it
  // is dodged by moving, never by having guessed right.
  const row = clamp(
    lockRow + Math.round(rangeFloat(rng, -1.4, 1.4)),
    1,
    Math.max(1, DRY_LANES - 1),
  );

  const progress = into / FRISBEE_FLIGHT_TICKS;
  const travel = BOARD_WIDTH + FRISBEE_HALF.width * 4;
  const from = direction > 0 ? -FRISBEE_HALF.width * 2 : BOARD_WIDTH + FRISBEE_HALF.width * 2;

  return {
    x: from + direction * travel * progress,
    // A full sine hump: up one lane and back down, so the two rows it is
    // currently in are never in doubt and never the same two for long.
    y: rowY(row) + Math.sin(progress * Math.PI) * FRISBEE_ARC_LANES * LANE_HEIGHT,
    direction,
    progress,
  };
}

/**
 * The seagull's current business, if it has any.
 *
 * It locks onto wherever the crab was standing when the dive began, and then
 * that patch of sand is fixed for the rest of it. Locking once rather than
 * tracking is what makes the threat avoidable: a shadow that followed the crab
 * would be a warning about something the player cannot get out of the way of,
 * which is the opposite of what the acceptance criterion asks for.
 *
 * `lockX` is the crab's position at the lock tick, which the caller has and
 * this module does not.
 */
export function seagullAt(
  elapsed: number,
  lockX: number,
  lockRow: number,
): Seagull | null {
  if (elapsed <= 0) return null;
  // Never the promenade. Row zero is where the run starts and where the camera
  // stops, and the parent spec calls it always safe — a bird that could take a
  // crab off the starting line would make "always safe" a thing the player has
  // to learn is not quite true, which is worse than the hazard is worth.
  if (lockRow <= 0) return null;
  const into = elapsed % SEAGULL_PERIOD_TICKS;
  if (into >= SEAGULL_WARN_TICKS + SEAGULL_STRIKE_TICKS) return null;

  const striking = into >= SEAGULL_WARN_TICKS;
  return {
    x: lockX,
    y: rowY(lockRow),
    warning: striking ? 1 : into / SEAGULL_WARN_TICKS,
    striking,
  };
}

/** Whether this tick is the one a frisbee is let go on. */
export function frisbeeLocksOn(elapsed: number): boolean {
  return elapsed >= FRISBEE_PERIOD_TICKS && elapsed % FRISBEE_PERIOD_TICKS === 0;
}

/** Whether this tick is the one a seagull picks its target on. */
export function seagullLocksOn(elapsed: number): boolean {
  return elapsed > 0 && elapsed % SEAGULL_PERIOD_TICKS === 0;
}

/** The box a seagull strike covers. Only lethal while {@link Seagull.striking}. */
export function seagullBox(seagull: Seagull): Box {
  return {
    x: seagull.x,
    y: seagull.y,
    halfWidth: SEAGULL_HALF_W,
    halfHeight: LANE_HEIGHT / 2,
  };
}

/** The box a frisbee kills from, which is the same box its art states. */
export function frisbeeBox(frisbee: Frisbee): Box {
  return {
    x: frisbee.x,
    y: frisbee.y,
    halfWidth: FRISBEE_HALF.width,
    halfHeight: FRISBEE_HALF.height,
  };
}


function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}
