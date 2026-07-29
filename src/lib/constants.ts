/**
 * Every tunable number in the game, in one file.
 *
 * Scuttle's quality is a tuning problem rather than a feature problem — step
 * duration, lateral speed, lane speeds and gap sizes are what decide whether
 * the sideways asymmetry reads as a tactic or as an annoyance. Keeping them
 * together means a tuning pass is one file open, and means nothing in the
 * simulation can quietly hard-code a number that a later pass will not find.
 *
 * Distances are in board units. The board is {@link BOARD_WIDTH} units across
 * and the renderer scales that to whatever the screen is, so these numbers are
 * device-independent by construction.
 */

/**
 * Simulation ticks per second.
 *
 * The simulation advances in whole ticks and never sees a frame delta, so this
 * is the only rate that affects play. Render rate is a separate concern and
 * changing it cannot change a run.
 */
export const TICK_HZ = 60;

/** Seconds per simulation tick. */
export const DT = 1 / TICK_HZ;

/** Milliseconds per simulation tick. */
export const TICK_MS = 1000 / TICK_HZ;

/**
 * Longest frame the loop will pay back in one go, in milliseconds.
 *
 * A backgrounded tab or a stalled main thread produces a delta measured in
 * seconds. Without a clamp the loop tries to catch up in a single frame, which
 * takes longer than a frame, which makes the next delta bigger still. Dropping
 * the excess costs the player some elapsed board time and keeps the tab alive.
 */
export const MAX_FRAME_MS = 250;

/** Width of the playable board, in board units. */
export const BOARD_WIDTH = 120;

/** Height of one lane, in board units. */
export const LANE_HEIGHT = 16;

/**
 * How many lanes are on screen at once.
 *
 * Fixed rather than derived from the viewport: a taller phone seeing further
 * down the beach would be playing an easier version of the same run. Eleven is
 * chosen so a phone held in portrait letterboxes by only a few dozen pixels,
 * while a wide window letterboxes at the sides rather than showing more beach.
 */
export const VISIBLE_LANES = 11;

/** How many lanes of already-crossed beach stay visible below the crab. */
export const LANES_BEHIND = 2;

/**
 * Half the crab's width, in board units.
 *
 * Wider than it is tall, so the shape says which way the thing is built to move
 * before the player has pressed anything.
 */
export const PLAYER_HALF_W = 6.5;

/** Half the crab's height, in board units. */
export const PLAYER_HALF_H = 4.5;

/**
 * Lateral speed in board units per second.
 *
 * Crossing the whole board takes a little over two and a half seconds, and one
 * forward step's worth of time buys roughly one and a half hazard gaps of
 * sideways travel — enough that sliding to a better entry point is a real
 * choice rather than a rounding error.
 */
export const LATERAL_SPEED = 46;

/**
 * Ticks a forward step takes, start to finish.
 *
 * Once begun the step runs to completion and refuses all input, so this number
 * is the length of the commitment the player is making.
 */
export const STEP_TICKS = 24;

/**
 * How long a forward press stays live after arriving mid-step.
 *
 * Short enough that a press made early in a step is simply missed, long enough
 * that chaining two crossings does not need a tick-perfect tap.
 */
export const STEP_BUFFER_TICKS = 8;

/** Half the height of a hazard, in board units. */
export const HAZARD_HALF_H = 5.5;

/**
 * How far past each edge of the board a drifting lane extends.
 *
 * Hazards wrap at the ends of this margin rather than at the board edge, so a
 * hazard is always fully off-board at the moment it wraps and can never appear
 * to teleport through the crab. It has to exceed the widest hazard.
 */
export const WRAP_MARGIN = 40;

/** Total cycle length of a drifting lane, in board units. */
export const CYCLE_SPAN = BOARD_WIDTH + 2 * WRAP_MARGIN;

/**
 * Narrowest gap the generator will ever leave between two hazards.
 *
 * Every lane is built by giving each gap this much first and only then sharing
 * out what is left, so a lane that cannot be crossed is not something the seed
 * is capable of producing, whatever the day's numbers come out as.
 *
 * A drifting gap has to be wide enough to survive the crossing, not merely to
 * hold the crab. The step cannot be steered, so from the moment it begins the
 * gap slides on underneath a crab that cannot follow it: at the fastest lane
 * speed that is most of ten units of travel gone before it lands. Sizing this
 * to the crab alone leaves a lane that looks passable and arithmetically is
 * not, which reads to a player as the game cheating.
 *
 * A still gap has no such problem and only has to be wide enough to stand in
 * with room to line up first.
 */
export const MIN_GAP = { drift: 32, still: 24 } as const;

/** Every fourth lane is safe, giving a rhythm of three crossings and a breath. */
export const SAFE_LANE_INTERVAL = 4;

/** Narrowest and widest a drifting hazard can be. */
export const DRIFT_WIDTH = { min: 16, max: 34 } as const;

/**
 * Slowest and fastest a drifting lane can run, in board units per second.
 *
 * The ceiling stays well under {@link LATERAL_SPEED} so that a crab standing in
 * a gap can always track it rather than being carried out of it.
 */
export const DRIFT_SPEED = { min: 9, max: 24 } as const;

/** Fewest and most hazards in a drifting lane. */
export const DRIFT_COUNT = { min: 2, max: 3 } as const;

/** Narrowest and widest a static blocker can be. */
export const STILL_WIDTH = { min: 10, max: 26 } as const;

/** Fewest and most blockers in a static lane. */
export const STILL_COUNT = { min: 2, max: 2 } as const;

/** Proportion of hazard lanes that are static blockers rather than drifting. */
export const STILL_LANE_CHANCE = 0.3;
