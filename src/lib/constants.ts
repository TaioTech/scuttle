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

/**
 * How many lanes of beach lie between the promenade and the sea.
 *
 * The beach is the same length every day — only what is in it varies. A
 * generated length would make two days' times incomparable and a personal best
 * meaningless, and it would turn "did you beat it" from a fact everybody shares
 * into a question about which beach you happened to get.
 *
 * A multiple of {@link SAFE_LANE_INTERVAL} so the last thing before the water
 * is a safe lane rather than a hazard the player is forced to gamble on with
 * the whole run behind them.
 *
 * This number is a first guess and is meant to be moved. It is the run's
 * length, and the run's length cannot be reasoned about — only played.
 */
export const BEACH_LANES = 32;

/** The row the sea begins at. Reaching it wins the day. */
export const SEA_ROW = BEACH_LANES + 1;

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

/**
 * Ticks in one full stride of the crab's legs.
 *
 * Animation phase is derived from the tick and nothing else — never from a
 * private counter or a frame delta — so two devices drawing the same tick draw
 * the same crab. Twenty ticks is a third of a second, which reads as scurrying
 * without turning into a blur at the scale the legs are actually drawn.
 */
export const GAIT_TICKS = 20;

/**
 * How far a leg swings, as a fraction of the crab's half-height.
 *
 * Scaled by how fast the crab is actually moving, so a standing crab shuffles
 * and a running one strides. Purely cosmetic: the collision box never changes.
 */
export const GAIT_SWING = 0.5;

/**
 * Board units of lateral speed at which the leg swing reaches full amplitude.
 *
 * Set below {@link LATERAL_SPEED} so that ordinary movement looks committed
 * rather than tentative.
 */
export const GAIT_FULL_SPEED = LATERAL_SPEED * 0.6;

/**
 * Board units of drifting hazard per beachgoer.
 *
 * A drifting hazard is up to thirty-four units wide, which is far too wide to
 * read as one person. It is drawn as a group of walkers spaced across the whole
 * hazard instead, which fills the collision box honestly — art that is narrower
 * than the box it kills you from is art that reads as the game cheating.
 *
 * Tight enough that a group reads as a crowd rather than as individuals with
 * crossable daylight between them. The shadow beneath carries the true extent,
 * but the figures should not be arguing with it.
 */
export const WALKER_SPACING = 8;

/** Ticks in one full stride of a walking beachgoer. */
export const WALKER_GAIT_TICKS = 34;

/** Board units of towel per stripe. */
export const TOWEL_STRIPE_SPACING = 7;
