/**
 * Continuous collision between two axis-aligned boxes over one tick.
 *
 * Testing where things ended up is not enough. A committed forward step takes
 * the crab across a lane over a fifth of a second, and a hazard crossing that
 * lane in the same window can be entirely past the crab by the time the tick
 * ends — the crab was hit, both boxes are clear, and the player is told they
 * died to nothing. Sweeping the whole tick is what makes the answer honest,
 * and it is what lets hazard speeds be tuned without the tuning quietly
 * introducing a hole.
 */

/** An axis-aligned box, given by its centre and half extents. */
export type Box = {
  x: number;
  y: number;
  halfWidth: number;
  halfHeight: number;
};

/**
 * Whether two boxes touch at any point during a tick.
 *
 * Both boxes move in a straight line from their start to their end position,
 * and the whole of both paths is considered rather than either endpoint. Half
 * extents are taken from the start boxes; nothing in the game resizes mid-tick.
 *
 * The test reduces to a ray against a box: subtracting one box's motion from
 * the other's leaves a single moving point, and inflating the stationary box by
 * the moving one's half extents restores the contact distance.
 */
export function sweptOverlap(
  aStart: Box,
  aEnd: Box,
  bStart: Box,
  bEnd: Box,
): boolean {
  const dx = aEnd.x - aStart.x - (bEnd.x - bStart.x);
  const dy = aEnd.y - aStart.y - (bEnd.y - bStart.y);

  const cx = bStart.x - aStart.x;
  const cy = bStart.y - aStart.y;

  const hx = aStart.halfWidth + bStart.halfWidth;
  const hy = aStart.halfHeight + bStart.halfHeight;

  const x = axisSpan(cx, hx, dx);
  if (!x) return false;
  const y = axisSpan(cy, hy, dy);
  if (!y) return false;

  const enter = Math.max(x.enter, y.enter);
  const exit = Math.min(x.exit, y.exit);

  return enter <= exit && exit >= 0 && enter <= 1;
}

type Span = { enter: number; exit: number };

/**
 * The interval of `t` over which one axis overlaps, or `null` if it never does.
 *
 * A displacement of zero on an axis is not a degenerate case to guard against
 * but the common one — a crab mid-step has no lateral motion at all — so it
 * resolves to "overlapping for the whole tick, or never".
 */
function axisSpan(
  center: number,
  halfExtent: number,
  displacement: number,
): Span | null {
  if (displacement === 0) {
    if (Math.abs(center) >= halfExtent) return null;
    return { enter: Number.NEGATIVE_INFINITY, exit: Number.POSITIVE_INFINITY };
  }

  const near = (center - halfExtent) / displacement;
  const far = (center + halfExtent) / displacement;

  return {
    enter: Math.min(near, far),
    exit: Math.max(near, far),
  };
}
