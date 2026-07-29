import { type Beach, hazardCenterAt } from "./board";
import {
  BOARD_WIDTH,
  HAZARD_HALF_H,
  LANE_HEIGHT,
  LANES_BEHIND,
  PLAYER_HALF_H,
  PLAYER_HALF_W,
  VISIBLE_LANES,
} from "./constants";
import { PALETTE } from "./palette";
import { playerY, type SimState } from "./sim";

/**
 * Where the board sits inside the canvas, in CSS pixels.
 *
 * The board is letterboxed rather than stretched, and the number of lanes on
 * screen is fixed rather than derived from the viewport — a taller phone
 * seeing two more lanes ahead would be playing an easier version of the same
 * run, which is the difficulty varying by device through the back door.
 */
export type View = {
  scale: number;
  originX: number;
  originY: number;
  height: number;
};

/** Fits the board into a canvas of the given CSS size. */
export function fitView(width: number, height: number): View {
  const scale = Math.min(
    width / BOARD_WIDTH,
    height / (VISIBLE_LANES * LANE_HEIGHT),
  );
  return {
    scale,
    originX: (width - BOARD_WIDTH * scale) / 2,
    originY: (height - VISIBLE_LANES * LANE_HEIGHT * scale) / 2,
    height: VISIBLE_LANES * LANE_HEIGHT * scale,
  };
}

/**
 * Draws the beach somewhere between two simulated ticks.
 *
 * `alpha` is how far past `previous` the frame has got, which is the leftover
 * the accumulator could not spend. Interpolating here rather than simulating a
 * partial tick is what lets a 60 Hz simulation look right on a 120 Hz screen
 * without the simulation knowing anything about the screen.
 */
export function drawFrame(
  ctx: CanvasRenderingContext2D,
  view: View,
  beach: Beach,
  previous: SimState,
  current: SimState,
  alpha: number,
  /** The canvas's size in CSS pixels, the context already scaled to match. */
  size: { width: number; height: number },
): void {
  const crabX = lerp(previous.x, current.x, alpha);
  const crabY = lerp(playerY(previous), playerY(current), alpha);
  const tick = previous.tick + (current.tick - previous.tick) * alpha;

  // The crab sits a couple of lanes up from the bottom edge so there is beach
  // ahead of it to read, and the camera stops at the promenade rather than
  // panning off the bottom of the world.
  const cameraRow = Math.max(0, crabY / LANE_HEIGHT - 0.5 - LANES_BEHIND);

  ctx.fillStyle = PALETTE.background;
  ctx.fillRect(0, 0, size.width, size.height);

  const toScreenY = (boardY: number) =>
    view.originY + view.height - (boardY - cameraRow * LANE_HEIGHT) * view.scale;
  const toScreenX = (boardX: number) => view.originX + boardX * view.scale;

  ctx.save();
  ctx.beginPath();
  ctx.rect(view.originX, view.originY, BOARD_WIDTH * view.scale, view.height);
  ctx.clip();

  const firstRow = Math.floor(cameraRow);
  for (let row = firstRow; row <= firstRow + VISIBLE_LANES; row += 1) {
    const lane = beach(row);
    const top = toScreenY((row + 1) * LANE_HEIGHT);
    const laneHeight = LANE_HEIGHT * view.scale;

    ctx.fillStyle =
      lane.kind === "safe" ? PALETTE.safe : PALETTE.sand[Math.abs(row) % 2];
    ctx.fillRect(view.originX, top, BOARD_WIDTH * view.scale, laneHeight + 1);

    ctx.fillStyle = PALETTE.line;
    ctx.fillRect(view.originX, top, BOARD_WIDTH * view.scale, 1);

    if (lane.kind === "safe") continue;

    ctx.fillStyle = lane.kind === "drift" ? PALETTE.drift : PALETTE.still;
    for (const hazard of lane.hazards) {
      const center = hazardCenterAt(lane, hazard, tick);
      roundedRect(
        ctx,
        toScreenX(center - hazard.halfWidth),
        toScreenY((row + 0.5) * LANE_HEIGHT + HAZARD_HALF_H),
        hazard.halfWidth * 2 * view.scale,
        HAZARD_HALF_H * 2 * view.scale,
        Math.min(4, 2 * view.scale),
      );
    }
  }

  drawCrab(
    ctx,
    toScreenX(crabX),
    toScreenY(crabY),
    view.scale,
    current.step !== null,
  );

  ctx.restore();
}

/**
 * The crab: a body wider than it is tall, and two eyes on the leading edge.
 *
 * Mid-step it lightens and squashes — the player has given up control for the
 * next few tenths of a second and the shape should say so, since the whole
 * game is built on knowing when that is true.
 */
function drawCrab(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  stepping: boolean,
): void {
  const halfWidth = PLAYER_HALF_W * scale * (stepping ? 1.08 : 1);
  const halfHeight = PLAYER_HALF_H * scale * (stepping ? 0.86 : 1);

  ctx.fillStyle = stepping ? PALETTE.crabStepping : PALETTE.crab;
  roundedRect(
    ctx,
    x - halfWidth,
    y - halfHeight,
    halfWidth * 2,
    halfHeight * 2,
    Math.min(6, 3 * scale),
  );

  const eye = Math.max(1, 0.9 * scale);
  ctx.fillStyle = PALETTE.background;
  ctx.beginPath();
  ctx.arc(x - halfWidth * 0.42, y - halfHeight * 0.35, eye, 0, Math.PI * 2);
  ctx.arc(x + halfWidth * 0.42, y - halfHeight * 0.35, eye, 0, Math.PI * 2);
  ctx.fill();
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.fill();
}

function lerp(from: number, to: number, alpha: number): number {
  return from + (to - from) * alpha;
}
