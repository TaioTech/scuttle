/**
 * Hazards that do not belong to a lane.
 *
 * Every hazard in `board.ts` is a thing a row contains: it is generated from
 * the row's seed, it lives in the row's coordinate space, and it is drawn
 * inside the row's slice of the render loop. A seagull is not: it strikes a
 * patch of sand rather than a lane.
 *
 * So it carries a position in continuous board coordinates and is resolved
 * separately — one collision pass over roamers, one render pass after every
 * lane. That is the whole structural difference, and keeping it in its own
 * module is what stops `board.ts`'s guarantee that a lane is crossable from
 * quietly acquiring exceptions it cannot actually enforce.
 *
 * Pure, like the rest of `lib/`, and deliberately stateless: a closed form of
 * the run's clock, so it cannot drift.
 *
 * Both hazards `scuttle.md` describes as pursuing are absent here, and that is
 * now one decision rather than two. The dog was always deferred. The frisbee
 * was built and then cut, because aiming it at the crab's current row gave it
 * the dog's specified behaviour without the dog's specified fairness rule: two
 * thirds of throws covered the lane the player was standing in, it crossed
 * faster than the crab runs sideways, and the only escape was forward through
 * the lane it also covered. The spec asks a pursuer to be readable — to commit
 * to a direction for a beat, or lose interest — and neither hazard comes back
 * until that rule exists and is tested. `git show b5e50c4` has the flight
 * arithmetic and its tests when it does.
 */

import {
  LANE_HEIGHT,
  SEAGULL_HALF_W,
  SEAGULL_PERIOD_TICKS,
  SEAGULL_STRIKE_TICKS,
  SEAGULL_WARN_TICKS,
} from "./constants";
import type { Box } from "./collision";

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
