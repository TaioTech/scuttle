import { type Beach, hazardCenterAt } from "./board";
import {
  BOARD_WIDTH,
  GAIT_FULL_SPEED,
  GAIT_SWING,
  GAIT_TICKS,
  HAZARD_HALF_H,
  LANE_HEIGHT,
  LANES_BEHIND,
  PLAYER_HALF_H,
  PLAYER_HALF_W,
  TICK_HZ,
  TOWEL_STRIPE_SPACING,
  VISIBLE_LANES,
  WALKER_GAIT_TICKS,
  WALKER_SPACING,
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
      lane.kind === "sea"
        ? PALETTE.sea
        : lane.kind === "safe"
          ? PALETTE.safe
          : PALETTE.sand[Math.abs(row) % 2];
    ctx.fillRect(view.originX, top, BOARD_WIDTH * view.scale, laneHeight + 1);

    // The shoreline gets foam rather than the usual lane rule, so the end of
    // the beach reads as somewhere to arrive instead of one more boundary.
    const shoreline = lane.kind === "sea" && beach(row - 1).kind !== "sea";
    ctx.fillStyle = shoreline ? PALETTE.seaFoam : PALETTE.line;
    ctx.fillRect(
      view.originX,
      top,
      BOARD_WIDTH * view.scale,
      shoreline ? Math.max(1, 1.2 * view.scale) : 1,
    );

    if (lane.kind === "safe" || lane.kind === "sea") continue;

    const middle = toScreenY((row + 0.5) * LANE_HEIGHT);
    for (const hazard of lane.hazards) {
      const center = hazardCenterAt(lane, hazard, tick);
      ctx.save();
      ctx.translate(toScreenX(center), middle);
      if (lane.kind === "drift") {
        drawWalkers(ctx, hazard.halfWidth, view.scale, tick);
      } else {
        drawTowel(ctx, hazard.halfWidth, view.scale);
      }
      ctx.restore();
    }
  }

  // How fast the crab is actually travelling, in board units per second. Only
  // the leg swing uses it, and only to decide how far to swing.
  const speed = Math.abs(current.x - previous.x) * TICK_HZ;

  ctx.save();
  ctx.translate(toScreenX(crabX), toScreenY(crabY));
  drawCrab(ctx, view.scale, current.step !== null, tick, speed);
  ctx.restore();

  ctx.restore();
}

/**
 * The crab, drawn about the origin: a shell, six legs, two claws, two eyes.
 *
 * The shell is a rounded rectangle filling the collision box exactly, and it is
 * deliberately not the ellipse the shape wants to be. An inscribed ellipse
 * leaves the corners of the box empty, so a crab that visibly cleared a hazard
 * dies to a corner the player could not see — the same complaint the swept
 * collision exists to prevent, arriving by a different route. The claws sit
 * inside that width for the mirror-image reason. Only the legs and eyestalks
 * reach past the box, they do so vertically where there is no gap to misjudge,
 * and they are strokes rather than mass.
 *
 * Mid-step it lightens, squashes and tucks its legs in: the player has given up
 * control for the next few tenths of a second and the shape should say so,
 * since the whole game is built on knowing when that is true.
 *
 * `tick` may be fractional — it is interpolated between the two simulated
 * states — and it is the only thing the animation phase comes from.
 */
function drawCrab(
  ctx: CanvasRenderingContext2D,
  scale: number,
  stepping: boolean,
  tick: number,
  speed: number,
): void {
  const halfWidth = PLAYER_HALF_W * scale * (stepping ? 1.08 : 1);
  const halfHeight = PLAYER_HALF_H * scale * (stepping ? 0.86 : 1);
  const shell = stepping ? PALETTE.crabStepping : PALETTE.crab;
  const limb = stepping ? PALETTE.crabSteppingLimb : PALETTE.crabLimb;
  const lit = stepping ? PALETTE.crabSteppingShell : PALETTE.crabShell;

  // A committed step tucks the legs; otherwise they swing further the faster
  // the crab is travelling, so a standing crab shuffles and a moving one runs.
  const swing = stepping
    ? 0
    : Math.min(1, speed / GAIT_FULL_SPEED) * GAIT_SWING * halfHeight;
  const phase = (tick / GAIT_TICKS) * Math.PI * 2;

  ctx.lineCap = "round";
  ctx.strokeStyle = limb;
  ctx.lineWidth = Math.max(1, 0.7 * scale);
  for (let leg = 0; leg < 3; leg += 1) {
    const alongBody = (leg - 1) * halfWidth * 0.46;
    const lift = Math.sin(phase + leg * 1.7) * swing;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(alongBody, halfHeight * 0.2);
      ctx.lineTo(
        alongBody + side * halfWidth * 0.5,
        halfHeight + Math.abs(lift) * 0.6 + halfHeight * 0.35,
      );
      ctx.stroke();
    }
  }

  ctx.fillStyle = shell;
  roundedRect(
    ctx,
    -halfWidth,
    -halfHeight,
    halfWidth * 2,
    halfHeight * 2,
    Math.min(6, 3 * scale),
  );

  // A lit band across the top so the shell reads as domed rather than flat.
  ctx.fillStyle = lit;
  roundedRect(
    ctx,
    -halfWidth * 0.72,
    -halfHeight * 0.78,
    halfWidth * 1.44,
    halfHeight * 0.66,
    Math.min(4, 2 * scale),
  );

  // Claws, drawn over the shell at its outer edges rather than reaching past
  // them. Held outboard they were solid mass sitting outside the collision box,
  // which made the crab read some forty per cent wider than the width it
  // actually dies at — so every gap looked tighter than it was and the player
  // hunted for room the lane already had. Art wider than the box is the milder
  // half of the same fault as art narrower than it: one kills you from daylight
  // you could see, the other hides room you were entitled to.
  const clawWidth = 2.6 * scale;
  ctx.fillStyle = limb;
  for (const side of [-1, 1]) {
    const bob = Math.sin(phase + (side > 0 ? Math.PI : 0)) * swing * 0.4;
    roundedRect(
      ctx,
      side > 0 ? halfWidth - clawWidth : -halfWidth,
      -halfHeight * 0.5 + bob,
      clawWidth,
      2.2 * scale,
      1 * scale,
    );
  }

  // Eyestalks, rising just clear of the shell.
  ctx.strokeStyle = limb;
  ctx.lineWidth = Math.max(1, 0.5 * scale);
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * halfWidth * 0.42, -halfHeight * 0.4);
    ctx.lineTo(side * halfWidth * 0.42, -halfHeight - 1.4 * scale);
    ctx.stroke();
  }

  const eye = Math.max(1, 0.9 * scale);
  ctx.fillStyle = PALETTE.background;
  ctx.beginPath();
  ctx.arc(-halfWidth * 0.42, -halfHeight - 1.4 * scale, eye, 0, Math.PI * 2);
  ctx.arc(halfWidth * 0.42, -halfHeight - 1.4 * scale, eye, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * A drifting hazard, drawn about its centre as a group of beachgoers.
 *
 * One hazard can be thirty-four board units wide, which is far too wide to read
 * as a single person, so it is drawn as however many walkers fit across it. The
 * group spans the collision box exactly: art narrower than the box it kills
 * from is the game cheating, and art wider than it is the game being mysterious.
 *
 * Each walker's stride is offset by its index so a group reads as people rather
 * than as a chorus line.
 */
function drawWalkers(
  ctx: CanvasRenderingContext2D,
  halfWidth: number,
  scale: number,
  tick: number,
): void {
  const width = halfWidth * 2;
  const count = Math.max(1, Math.round(width / WALKER_SPACING));
  const half = HAZARD_HALF_H * scale;
  const phase = (tick / WALKER_GAIT_TICKS) * Math.PI * 2;

  // The hazard's full extent first, spanning the collision box exactly. See
  // PALETTE.driftMass for why this is not decoration.
  ctx.fillStyle = PALETTE.driftMass;
  roundedRect(
    ctx,
    -halfWidth * scale,
    -half,
    width * scale,
    half * 2,
    Math.min(4, 2 * scale),
  );

  for (let i = 0; i < count; i += 1) {
    // Spread across the hazard so the outermost walkers sit inside its edges.
    const t = count === 1 ? 0.5 : (i + 0.5) / count;
    const x = (-halfWidth + t * width) * scale;
    const stride = Math.sin(phase + i * 2.1) * half * 0.22;

    ctx.strokeStyle = PALETTE.driftLeg;
    ctx.lineWidth = Math.max(1, 0.62 * scale);
    ctx.lineCap = "round";
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x, half * 0.1);
      ctx.lineTo(x + side * stride, half * 0.92);
      ctx.stroke();
    }

    ctx.fillStyle = PALETTE.drift;
    roundedRect(
      ctx,
      x - half * 0.34,
      -half * 0.5,
      half * 0.68,
      half * 0.98,
      Math.min(3, 1.2 * scale),
    );

    ctx.fillStyle = PALETTE.driftHead;
    ctx.beginPath();
    ctx.arc(x, -half * 0.68, half * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * A static blocker, drawn about its centre: a striped towel with someone on it.
 *
 * Warmer and calmer than the walkers and no dimmer, because a blocker that
 * reads as scenery is one the player walks into once and blames the game for.
 * It fills the collision box exactly.
 */
function drawTowel(
  ctx: CanvasRenderingContext2D,
  halfWidth: number,
  scale: number,
): void {
  const width = halfWidth * 2 * scale;
  const half = HAZARD_HALF_H * scale;
  const left = -halfWidth * scale;

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(left, -half, width, half * 2, Math.min(3, 1.5 * scale));
  ctx.clip();

  ctx.fillStyle = PALETTE.still;
  ctx.fillRect(left, -half, width, half * 2);

  ctx.fillStyle = PALETTE.stillStripe;
  const stripes = Math.max(2, Math.round((halfWidth * 2) / TOWEL_STRIPE_SPACING));
  const gap = width / stripes;
  for (let i = 0; i < stripes; i += 1) {
    ctx.fillRect(left + i * gap + gap * 0.25, -half, gap * 0.28, half * 2);
  }

  // The sunbather: a torso and a head, lying along the towel.
  ctx.fillStyle = PALETTE.stillBody;
  ctx.beginPath();
  ctx.ellipse(0, half * 0.05, width * 0.24, half * 0.46, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(-width * 0.3, half * 0.05, half * 0.3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
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
