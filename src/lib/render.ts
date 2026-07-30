import {
  type Beach,
  hasHazards,
  hazardCenterAt,
  isPlanted,
  type Lane,
  plantingProgress,
  surfWashingAt,
} from "./board";
import type { Seagull } from "./roamers";
import {
  BOARD_WIDTH,
  SEAGULL_HALF_W,
  GAIT_FULL_SPEED,
  GAIT_SWING,
  GAIT_TICKS,
  HAZARD_HALF_H,
  LANE_HEIGHT,
  LANES_BEHIND,
  PLAYER_HALF_H,
  PLAYER_HALF_W,
  SHELL_HALF_W,
  TICK_HZ,
  TOWEL_STRIPE_SPACING,
  VISIBLE_LANES,
  WALKER_GAIT_TICKS,
  WALKER_SPACING,
} from "./constants";
import { PALETTE } from "./palette";
import { isCarried, playerY, type SimState } from "./sim";

/**
 * How wide a claw is drawn, and how far past the shell its tip reaches, in
 * board units.
 *
 * The overhang is the tuned number. At the original 2.6 the crab read some
 * forty per cent wider than the box it dies at; at nothing it stopped looking
 * like a crab. This is the middle, and it is a named constant because it is a
 * feel number somebody will want to move again.
 */
const CLAW_WIDTH = 2.6;
const CLAW_OVERHANG = 1.4;

/** The roamers as one thing to hand the renderer. */
export type Roamers = {
  seagull: Seagull | null;
};

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
  /** The hazards that belong to no lane. Null on a board that has none. */
  roamers: Roamers | null = null,
): void {
  const crabX = lerp(previous.x, current.x, alpha);
  const crabY = lerp(playerY(previous), playerY(current), alpha);
  const tick = previous.tick + (current.tick - previous.tick) * alpha;
  // The tide's clock, which waits for the player's first input while the tick
  // does not. Interpolated the same way so the water's edge does not step.
  const elapsed =
    previous.elapsed + (current.elapsed - previous.elapsed) * alpha;

  // The crab sits a couple of lanes up from the bottom edge so there is beach
  // ahead of it to read, and the camera stops at the promenade rather than
  // panning off the bottom of the world.
  const cameraRow = Math.max(0, crabY / LANE_HEIGHT - 0.5 - LANES_BEHIND);
  const taken = current.shells;

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
  const boardWidth = BOARD_WIDTH * view.scale;
  for (let row = firstRow; row <= firstRow + VISIBLE_LANES; row += 1) {
    const lane = beach(row, elapsed);
    const top = toScreenY((row + 1) * LANE_HEIGHT);
    const laneHeight = LANE_HEIGHT * view.scale;

    ctx.fillStyle = laneFloor(lane, row);
    ctx.fillRect(view.originX, top, boardWidth, laneHeight + 1);

    // A washing surf lane is filled edge to edge for exactly the ticks it will
    // carry a crab. The push zone and the thing the player can see are the same
    // rectangle, computed from the same predicate — the surf gets no more
    // licence to imply an extent it does not have than a hazard does.
    if (lane.kind === "surf" && surfWashingAt(row, Math.floor(tick))) {
      ctx.fillStyle = PALETTE.surfWash;
      ctx.fillRect(view.originX, top, boardWidth, laneHeight + 1);
      ctx.fillStyle = PALETTE.surfCrest;
      ctx.fillRect(view.originX, top, boardWidth, Math.max(1, 1.4 * view.scale));
    }

    // The shoreline gets foam rather than the usual lane rule, so the end of
    // the beach reads as somewhere to arrive instead of one more boundary.
    // Everything the water has reached gets a cool rule instead of the sand's
    // warm one, which would be invisible against it.
    //
    // Marked on the last row *before* the sea rather than the first row of it.
    // Every lane draws its own upper rule, so asking the sea to draw the
    // shoreline put the foam at the sea's far edge — a whole lane past the line
    // it was naming. Harmless while the last beach row was pale sand and wrong
    // the moment the surf arrived, since the one thing the foam has to be
    // unambiguous about is where winning starts.
    const shoreline =
      lane.kind !== "sea" && beach(row + 1, elapsed).kind === "sea";
    ctx.fillStyle = shoreline
      ? PALETTE.seaFoam
      : lane.kind === "tideline" || lane.kind === "surf"
        ? PALETTE.waterLine
        : PALETTE.line;
    ctx.fillRect(
      view.originX,
      top,
      boardWidth,
      shoreline ? Math.max(1, 1.2 * view.scale) : 1,
    );

    if (!hasHazards(lane)) continue;

    const middle = toScreenY((row + 0.5) * LANE_HEIGHT);

    // Under the hazards, because a shell lies on the sand and the crowd walks
    // over it. Drawing it on top would let a shell imply a gap that is not
    // there, which is the same fault as art narrower than its box.
    const shell = lane.shell;
    if (shell !== null && (taken & (1 << row)) === 0) {
      ctx.save();
      ctx.translate(toScreenX(shell), middle);
      drawShell(ctx, view.scale, tick, row);
      ctx.restore();
    }

    for (const hazard of lane.hazards) {
      const planting = plantingProgress(hazard, elapsed);
      // An umbrella that has neither planted nor begun arriving is not on the
      // beach yet, and drawing it early would be the art claiming a hazard the
      // collision does not have.
      if (!isPlanted(hazard, elapsed) && planting === null) continue;

      const center = hazardCenterAt(lane, hazard, tick);
      ctx.save();
      ctx.translate(toScreenX(center), middle);
      if (lane.kind === "drift") {
        drawWalkers(ctx, hazard.halfWidth, view.scale, tick);
      } else if (hazard.plantsAt > 0) {
        drawUmbrella(ctx, hazard.halfWidth, view.scale, planting);
      } else {
        drawTowel(ctx, hazard.halfWidth, view.scale);
      }
      ctx.restore();
    }
  }

  // The second pass. Everything that is not lane-bound is drawn here, in board
  // coordinates, after every lane and before the crab — so a roamer is never
  // clipped into whichever row happened to draw it, and so the player never
  // loses themselves under something in the air.
  if (roamers !== null && roamers.seagull !== null) {
    ctx.save();
    ctx.translate(toScreenX(roamers.seagull.x), toScreenY(roamers.seagull.y));
    drawSeagull(ctx, view.scale, roamers.seagull);
    ctx.restore();
  }

  // How fast the crab is actually travelling, in board units per second. Only
  // the leg swing uses it, and only to decide how far to swing.
  const speed = Math.abs(current.x - previous.x) * TICK_HZ;

  ctx.save();
  ctx.translate(toScreenX(crabX), toScreenY(crabY));
  drawCrab(
    ctx,
    view.scale,
    current.step !== null,
    isCarried(current) || current.immune > 0,
    tick,
    speed,
  );
  ctx.restore();

  ctx.restore();
}

/**
 * A conch, drawn about its centre: a spired body, a flared lip, a pointed tail.
 *
 * A scallop fan was tried first. It is the easier shape and it is the wrong
 * one — a symmetrical fan at this size reads as an arch or a sunrise, and the
 * beach already has enough small pale rectangles for a fourth silhouette to
 * need a profile that could not be anything else. A conch leans, which is what
 * makes it read as an object lying on sand rather than as a mark on it.
 *
 * It breathes a little, and the phase comes from the tick and the row so that
 * two shells on the same beach are not pulsing in unison. Like every other
 * animation here it holds no counter of its own — the row is what varies it,
 * and the row is a constant.
 *
 * Kept well inside the width a pickup is granted at. This is the one thing on
 * the beach where art wider than its box would be a kindness rather than a
 * cheat, and it still is not worth doing: a shell that looks bigger than its
 * reach teaches the player a distance that will not work on the next one.
 */
function drawShell(
  ctx: CanvasRenderingContext2D,
  scale: number,
  tick: number,
  row: number,
): void {
  const breath = 1 + Math.sin(tick / 40 + row * 1.9) * 0.05;
  const size = SHELL_HALF_W * scale * breath;

  ctx.save();
  ctx.rotate(-0.35);

  // The body whorl: a fat teardrop, widest low and drawn to a point at the top.
  ctx.fillStyle = PALETTE.shell;
  ctx.beginPath();
  ctx.moveTo(0, -size * 1.15);
  ctx.bezierCurveTo(size * 0.85, -size * 0.5, size * 0.8, size * 0.5, 0, size);
  ctx.bezierCurveTo(-size * 0.8, size * 0.5, -size * 0.85, -size * 0.5, 0, -size * 1.15);
  ctx.fill();

  // The flared lip down one side, which is the half of the outline that says
  // conch rather than pebble.
  ctx.beginPath();
  ctx.moveTo(size * 0.12, -size * 0.45);
  ctx.bezierCurveTo(
    size * 1.15,
    -size * 0.15,
    size * 1.05,
    size * 0.62,
    size * 0.05,
    size * 0.95,
  );
  ctx.bezierCurveTo(size * 0.6, size * 0.35, size * 0.62, -size * 0.1, size * 0.12, -size * 0.45);
  ctx.fill();

  // Spire ridges, tightening toward the tail the way a real whorl does.
  ctx.strokeStyle = PALETTE.shellRidge;
  ctx.lineWidth = Math.max(1, 0.26 * scale);
  ctx.lineCap = "round";
  for (const [at, spread] of [
    [-0.72, 0.34],
    [-0.3, 0.5],
    [0.16, 0.44],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(-size * spread, size * at);
    ctx.quadraticCurveTo(0, size * (at - 0.22), size * spread * 0.7, size * at);
    ctx.stroke();
  }

  ctx.restore();
}

/** The colour of a lane's floor, before anything standing on it is drawn. */
function laneFloor(lane: Lane, row: number): string {
  switch (lane.kind) {
    case "sea":
      return PALETTE.sea;
    case "surf":
      return PALETTE.surf;
    case "tideline":
      return PALETTE.tideLine[Math.abs(row) % 2];
    case "safe":
      return PALETTE.safe;
    default:
      return PALETTE.sand[Math.abs(row) % 2];
  }
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
  carried: boolean,
  tick: number,
  speed: number,
): void {
  const halfWidth = PLAYER_HALF_W * scale * (stepping ? 1.08 : 1);
  const halfHeight = PLAYER_HALF_H * scale * (stepping ? 0.86 : 1);
  // The shell fills the box and the claws straddle its edge, overhanging by a
  // little rather than by a lot.
  //
  // Two wrong answers came first. Claws held well outboard — the original —
  // made the crab read some forty per cent wider than the width it dies at, so
  // every gap looked tighter than it was. Claws tucked wholly inside were
  // honest and turned the crab into a rounded rectangle, which is worse in the
  // way that actually matters: the pincers either side are most of what makes
  // it a crab rather than a token, and a game about a crab should look like it
  // has one.
  //
  // Straddling costs a fraction of a body width of overhang and buys the whole
  // silhouette back. Art wider than the box is the milder half of the fault art
  // narrower than it commits — one kills you from daylight you could see, the
  // other hides a little room you were owed — and at this size the second is
  // worth a claw.
  const shellHalf = halfWidth;
  // A crab in the water's hands is drawn cool rather than orange, and it wins
  // over the mid-step colour because being unkillable is the more important of
  // the two things true of it. The immunity outlasts the ride by design, so the
  // colour holds through the grace beat as well: the player can see the moment
  // it runs out instead of discovering it by dying.
  const shell = carried
    ? PALETTE.crabCarried
    : stepping
      ? PALETTE.crabStepping
      : PALETTE.crab;
  const limb = carried
    ? PALETTE.crabCarriedLimb
    : stepping
      ? PALETTE.crabSteppingLimb
      : PALETTE.crabLimb;
  const lit = carried
    ? PALETTE.crabCarriedShell
    : stepping
      ? PALETTE.crabSteppingShell
      : PALETTE.crabShell;

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
    const alongBody = (leg - 1) * shellHalf * 0.52;
    const lift = Math.sin(phase + leg * 1.7) * swing;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(alongBody, halfHeight * 0.2);
      ctx.lineTo(
        alongBody + side * shellHalf * 0.55,
        halfHeight + Math.abs(lift) * 0.6 + halfHeight * 0.35,
      );
      ctx.stroke();
    }
  }

  // Claws, held out to either side and bobbing against the gait, drawn before
  // the shell so it covers their inner half and only the pincer shows.
  //
  // This is the original treatment, brought back after two attempts at
  // something cleverer. Tucking the claws wholly inside the box turned the crab
  // into a rounded rectangle, and redrawing them as jointed pincers read as
  // chicken feet at the forty-odd pixels a crab actually occupies on a phone.
  // The blunt version was right: at this size the claws are a silhouette, not
  // an anatomy lesson, and two blocks either side of a wide body is what says
  // crab.
  //
  // What was wrong was only how far they reached. They stood a full two and a
  // half units proud of the collision box, which made the crab read some forty
  // per cent wider than the width it dies at, so every gap looked tighter than
  // it was. They now sit deeper into the shell and protrude a little over half
  // as far, which keeps the shape and returns most of the honesty.
  ctx.fillStyle = limb;
  for (const side of [-1, 1]) {
    const bob = Math.sin(phase + (side > 0 ? Math.PI : 0)) * swing * 0.4;
    const outer = shellHalf + CLAW_OVERHANG * scale;
    roundedRect(
      ctx,
      side > 0 ? outer - CLAW_WIDTH * scale : -outer,
      -halfHeight * 0.5 + bob,
      CLAW_WIDTH * scale,
      2.2 * scale,
      1 * scale,
    );
  }

  ctx.fillStyle = shell;
  roundedRect(
    ctx,
    -shellHalf,
    -halfHeight,
    shellHalf * 2,
    halfHeight * 2,
    Math.min(6, 3 * scale),
  );

  // A lit band across the top so the shell reads as domed rather than flat.
  ctx.fillStyle = lit;
  roundedRect(
    ctx,
    -shellHalf * 0.72,
    -halfHeight * 0.78,
    shellHalf * 1.44,
    halfHeight * 0.66,
    Math.min(4, 2 * scale),
  );

  // Eyestalks, rising just clear of the shell.
  ctx.strokeStyle = limb;
  ctx.lineWidth = Math.max(1, 0.5 * scale);
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * shellHalf * 0.45, -halfHeight * 0.4);
    ctx.lineTo(side * shellHalf * 0.45, -halfHeight - 1.4 * scale);
    ctx.stroke();
  }

  const eye = Math.max(1, 0.9 * scale);
  ctx.fillStyle = PALETTE.background;
  ctx.beginPath();
  ctx.arc(-shellHalf * 0.45, -halfHeight - 1.4 * scale, eye, 0, Math.PI * 2);
  ctx.arc(shellHalf * 0.45, -halfHeight - 1.4 * scale, eye, 0, Math.PI * 2);
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

  // The sunbather, lying along the towel with their head at one end.
  //
  // Previously a wide ellipse with a circle overlapping its edge, which at the
  // size a hazard is actually drawn on a phone read as one body with a bulge —
  // closer to a fish than a person. What was missing was not detail but joints:
  // a neck's worth of gap between head and torso, a narrower waist than
  // shoulders, and legs that end somewhere. Three separated parts read as a
  // figure at sizes where one continuous blob never will.
  ctx.fillStyle = PALETTE.stillBody;

  const headAt = -width * 0.32;
  ctx.beginPath();
  ctx.arc(headAt, half * 0.02, half * 0.27, 0, Math.PI * 2);
  ctx.fill();

  // Torso: shoulders at the head end tapering to a waist, so there is a
  // direction to the body rather than a symmetrical lump.
  ctx.beginPath();
  ctx.moveTo(headAt + half * 0.42, -half * 0.42);
  ctx.lineTo(width * 0.08, -half * 0.26);
  ctx.lineTo(width * 0.08, half * 0.3);
  ctx.lineTo(headAt + half * 0.42, half * 0.46);
  ctx.closePath();
  ctx.fill();

  // Legs, drawn as two strokes with daylight between them — the one place on
  // this hazard where a gap is safe to imply, because the towel beneath is
  // already stating the box and the legs are inside it.
  ctx.strokeStyle = PALETTE.stillBody;
  ctx.lineWidth = Math.max(1, 0.9 * scale);
  ctx.lineCap = "round";
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(width * 0.08, side * half * 0.16);
    ctx.lineTo(width * 0.36, side * half * 0.3);
    ctx.stroke();
  }

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

/**
 * An umbrella, planted or arriving.
 *
 * Fills its collision box exactly once planted, the same obligation every other
 * hazard has. While it is arriving the canopy descends from above the lane and
 * the pole grows to meet it, so the moment reads as something being put there
 * rather than something appearing — which is the whole reason this hazard is
 * drawn differently from a towel at all.
 *
 * `planting` is null once it is simply a blocker, and every frame of the
 * arrival comes from the run's clock rather than a counter of the renderer's.
 */
function drawUmbrella(
  ctx: CanvasRenderingContext2D,
  halfWidth: number,
  scale: number,
  planting: number | null,
): void {
  const width = halfWidth * scale;
  const height = HAZARD_HALF_H * scale;
  // Arriving, it comes down from above and settles. Fully planted it sits still.
  const drop = planting === null ? 0 : (1 - planting) * height * 4;

  ctx.save();
  ctx.translate(0, -drop);

  ctx.fillStyle = PALETTE.umbrellaPole;
  ctx.fillRect(-0.5 * scale, -height * 0.2, Math.max(1, scale), height * 1.2 + drop);

  // The canopy spans the whole box. An umbrella narrower than what it kills
  // from would show daylight the player would try to walk through.
  ctx.fillStyle = PALETTE.umbrella;
  ctx.beginPath();
  ctx.moveTo(-width, -height * 0.1);
  ctx.quadraticCurveTo(0, -height * 1.9, width, -height * 0.1);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = PALETTE.umbrellaShade;
  ctx.beginPath();
  ctx.moveTo(-width, -height * 0.1);
  ctx.quadraticCurveTo(-width * 0.5, -height * 0.55, 0, -height * 0.1);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(width * 0.5, -height * 0.1);
  ctx.quadraticCurveTo(width * 0.75, -height * 0.5, width, -height * 0.1);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

/**
 * The seagull: a hard-edged patch of shadow, then the bird in it.
 *
 * The shadow is a flat fill with a drawn boundary rather than a soft gradient.
 * A falling-off shadow is prettier and is a worse warning — under time pressure
 * the player has to be able to tell exactly where it stops, and only an edge
 * says that. The patch grows to the full extent of the box it will kill from
 * and no further, so what is being threatened is never in question.
 *
 * The patch is harmless for every tick of the warning. It kills only once the
 * bird is down, which is the whole point of the lead time.
 */
function drawSeagull(
  ctx: CanvasRenderingContext2D,
  scale: number,
  seagull: Seagull,
): void {
  const width = SEAGULL_HALF_W * scale;
  const height = (LANE_HEIGHT / 2) * scale;

  // Grows to the true box over the warning and then holds there. It never
  // overshoots: a shadow larger than the strike would be a lie in the safe
  // direction, which still teaches the player a distance that is not real.
  const reach = 0.35 + 0.65 * seagull.warning;

  ctx.globalAlpha = 0.34 + 0.4 * seagull.warning;
  ctx.fillStyle = PALETTE.seagullShadow;
  ctx.beginPath();
  ctx.ellipse(0, 0, width * reach, height * reach, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.strokeStyle = PALETTE.seagullEdge;
  ctx.lineWidth = Math.max(1, 0.4 * scale);
  ctx.globalAlpha = 0.55 + 0.45 * seagull.warning;
  ctx.beginPath();
  ctx.ellipse(0, 0, width * reach, height * reach, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;

  if (!seagull.striking) return;

  // The bird itself, only once it is actually down and actually lethal.
  ctx.fillStyle = PALETTE.seagull;
  ctx.beginPath();
  ctx.ellipse(0, 0, width * 0.5, height * 0.52, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = PALETTE.seagullWing;
  ctx.lineWidth = Math.max(1, 0.7 * scale);
  ctx.lineCap = "round";
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * width * 0.2, -height * 0.1);
    ctx.quadraticCurveTo(
      side * width * 0.75,
      -height * 0.7,
      side * width * 0.98,
      -height * 0.1,
    );
    ctx.stroke();
  }

  ctx.fillStyle = PALETTE.seagullBeak;
  ctx.beginPath();
  ctx.moveTo(0, height * 0.15);
  ctx.lineTo(-width * 0.1, height * 0.55);
  ctx.lineTo(width * 0.1, height * 0.55);
  ctx.closePath();
  ctx.fill();
}

