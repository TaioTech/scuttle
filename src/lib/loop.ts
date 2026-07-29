import { MAX_FRAME_MS, TICK_MS } from "./constants";

/** How many whole ticks a frame has earned, and what is left over. */
export type Drain = {
  /** Ticks to simulate before drawing this frame. */
  ticks: number;
  /**
   * Milliseconds carried into the next frame, always less than one tick.
   *
   * Also the interpolation alpha's numerator: the renderer draws the fraction
   * of a tick that has elapsed but not yet been simulated, which is what makes
   * a 60 Hz simulation look right on a 120 Hz screen.
   */
  pending: number;
};

/**
 * Converts elapsed wall-clock time into whole simulation ticks.
 *
 * This is the only place in the game where real time is consulted, and all it
 * ever produces is a count. The simulation itself never learns how long a frame
 * took, so a device rendering at half the rate runs the same ticks in the same
 * order and plays the same run — it simply draws fewer pictures of it.
 *
 * A frame longer than {@link MAX_FRAME_MS} has its excess dropped rather than
 * paid back. Catching up on a two-second stall takes longer than a frame, which
 * makes the next frame longer still; the run loses some elapsed beach time and
 * the tab stays responsive, which is the better of two bad outcomes.
 */
export function drainTicks(pendingMs: number, frameMs: number): Drain {
  const accumulated = pendingMs + Math.min(Math.max(frameMs, 0), MAX_FRAME_MS);
  const ticks = Math.floor(accumulated / TICK_MS);
  return { ticks, pending: accumulated - ticks * TICK_MS };
}
