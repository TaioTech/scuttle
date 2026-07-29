import { describe, expect, it } from "vitest";
import { type Box, sweptOverlap } from "./collision";

function box(x: number, y: number, halfWidth = 5, halfHeight = 5): Box {
  return { x, y, halfWidth, halfHeight };
}

/**
 * The naive test this module exists to replace: are the boxes touching where
 * they ended up? Used here only to demonstrate what it misses.
 */
function endpointOverlap(a: Box, b: Box): boolean {
  return (
    Math.abs(a.x - b.x) < a.halfWidth + b.halfWidth &&
    Math.abs(a.y - b.y) < a.halfHeight + b.halfHeight
  );
}

describe("sweptOverlap", () => {
  it("reports boxes that already overlap when the tick begins", () => {
    const a = box(0, 0);
    const b = box(3, 0);
    expect(sweptOverlap(a, a, b, b)).toBe(true);
  });

  it("reports boxes that are apart and stay apart", () => {
    const a = box(0, 0);
    const b = box(40, 0);
    expect(sweptOverlap(a, a, b, b)).toBe(false);
  });

  it("ignores a hazard in a different lane", () => {
    const a = box(0, 0);
    const b = box(0, 40);
    expect(sweptOverlap(a, box(0, 0), b, box(0, 40))).toBe(false);
  });

  it("catches a hazard that crosses the crab and clears it in one tick", () => {
    // This is the bug the module exists for: a fast hazard starting well left
    // of the crab and ending well right of it, touching nothing at either end.
    const crab = box(0, 0);
    const hazardStart = box(-60, 0);
    const hazardEnd = box(60, 0);

    expect(endpointOverlap(crab, hazardStart)).toBe(false);
    expect(endpointOverlap(crab, hazardEnd)).toBe(false);
    expect(sweptOverlap(crab, crab, hazardStart, hazardEnd)).toBe(true);
  });

  it("catches a crab that steps through a hazard and out the other side", () => {
    // The same tunnelling, with the roles reversed: a committed step long
    // enough to cross a lane in a single tick.
    const crabStart = box(0, -60);
    const crabEnd = box(0, 60);
    const hazard = box(0, 0);

    expect(endpointOverlap(crabStart, hazard)).toBe(false);
    expect(endpointOverlap(crabEnd, hazard)).toBe(false);
    expect(sweptOverlap(crabStart, crabEnd, hazard, hazard)).toBe(true);
  });

  it("times the crossing rather than merely noticing it happened", () => {
    // A crab stepping up out of a lane and a hazard sweeping along it cross
    // paths in space. Whether that is a hit depends on when each arrives, and
    // the answer has to come out different for the two orderings.
    const crabStart = box(0, 0);
    const crabEnd = box(0, 30);

    // The hazard is already alongside as the step begins: caught.
    expect(sweptOverlap(crabStart, crabEnd, box(-8, 0), box(52, 0))).toBe(true);

    // The hazard arrives at the crab's column only once the crab is a lane
    // clear of it: missed.
    expect(sweptOverlap(crabStart, crabEnd, box(-60, 0), box(0, 0))).toBe(false);
  });

  it("is unaffected by both boxes moving together", () => {
    // Relative motion is what matters, so a hazard the crab is riding
    // alongside neither collides nor escapes.
    const near = sweptOverlap(box(0, 0), box(10, 0), box(40, 0), box(50, 0));
    const still = sweptOverlap(box(0, 0), box(0, 0), box(40, 0), box(40, 0));
    expect(near).toBe(still);
  });

  it("does not fire on boxes that only graze edge to edge", () => {
    const a = box(0, 0);
    const b = box(10, 0);
    expect(sweptOverlap(a, a, b, b)).toBe(false);
  });

  it("respects the tick boundary — contact after this tick is not a hit yet", () => {
    const crab = box(0, 0);
    // Arrives at the crab's edge exactly as the tick ends, then keeps going.
    const hazardStart = box(-100, 0);
    const hazardEnd = box(-11, 0);
    expect(sweptOverlap(crab, crab, hazardStart, hazardEnd)).toBe(false);
  });
});
