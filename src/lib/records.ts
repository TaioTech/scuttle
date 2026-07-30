/**
 * What the device remembers between runs, and the rules for updating it.
 *
 * Pure, like everything else here: this module decides what a new record is,
 * and knows nothing about where it is kept. Reading and writing the thing is
 * the browser's problem and lives with the rest of the side effects, which is
 * also what makes these rules testable without a storage API.
 */

import { BEACH_LANES } from "./constants";
import { formatElapsed } from "./sim";

/** How a run ended, reduced to the numbers worth keeping. */
export type Run = {
  won: boolean;
  /** Lanes crossed, already capped at the length of the beach. */
  lanes: number;
  /** Ticks taken. Only meaningful for a run that reached the sea. */
  elapsed: number;
  /** Shells picked up. */
  shells: number;
  /** Which day's beach this was. */
  day: number;
};

/** The best a player has managed on this device. */
export type Best = {
  /**
   * Fewest ticks taken to reach the sea, or null if it has never been reached.
   *
   * Comparable across days only because the beach is a fixed length. If that
   * ever stops being true, this stops meaning anything.
   */
  ticks: number | null;
  /** Furthest lane ever reached, whether or not that run was won. */
  lanes: number;
  /** Most shells taken in a single run. */
  shells: number;
  /**
   * Consecutive days the sea has been reached, and the last day it was.
   *
   * The day is kept alongside the count because a streak is not a number, it is
   * a number plus when it was last true — without the date there is no way to
   * tell a live streak from a stale one, and a run of three that ended a month
   * ago would go on claiming to be three forever.
   *
   * The count is not decayed on read or on a loss. Retries are unlimited, so a
   * loss says nothing: a player who dies at lane four and wins on the next go
   * has still reached the sea today. A streak ends by a day passing without a
   * win, which is a thing that can only be noticed by looking at the date —
   * see {@link liveStreak}.
   */
  streak: number;
  streakDay: number | null;
  /** The longest streak ever held, which no later gap can take away. */
  bestStreak: number;
};

/** No runs yet. Also what a corrupt or missing record falls back to. */
export function emptyBest(): Best {
  return {
    ticks: null,
    lanes: 0,
    shells: 0,
    streak: 0,
    streakDay: null,
    bestStreak: 0,
  };
}

/**
 * Folds a finished run into the record.
 *
 * `improved` is whether this run beat the thing that run was competing on — a
 * won run is measured against the best time, a lost one against the furthest
 * lane. A win that is slower than the record still counts as reaching the sea
 * and still raises the distance, it just does not announce itself.
 */
export function withRun(
  best: Best,
  run: Run,
): { best: Best; improved: boolean } {
  const beatTime =
    run.won && (best.ticks === null || run.elapsed < best.ticks);
  const beatDistance = run.lanes > best.lanes;

  const streak = run.won ? wonOn(best, run.day) : best.streak;
  const streakDay = run.won ? run.day : best.streakDay;

  return {
    best: {
      ticks: beatTime ? run.elapsed : best.ticks,
      lanes: beatDistance ? run.lanes : best.lanes,
      shells: Math.max(best.shells, run.shells),
      streak,
      streakDay,
      bestStreak: Math.max(best.bestStreak, streak),
    },
    improved: run.won ? beatTime : beatDistance,
  };
}

/**
 * The streak after reaching the sea on the given day.
 *
 * Winning twice in one day is not two days, which matters because retries are
 * unlimited: without this a player could farm a streak of thirty in an
 * afternoon and the number would mean nothing at all.
 */
function wonOn(best: Best, day: number): number {
  if (best.streakDay === day) return best.streak;
  if (best.streakDay === day - 1) return best.streak + 1;
  return 1;
}

/**
 * The streak as it stands today, which is not always the one on record.
 *
 * A streak ends by a day going past without a win, and nothing happens on that
 * day for the record to notice — the player simply did not come back. So the
 * stored count is only meaningful next to the day it was last true, and the
 * live value has to be worked out against today's date rather than read.
 *
 * Today still counts as unbroken even if nothing has been won yet: the day is
 * not over, and a streak that reads zero every morning until you win would be
 * telling the player they had lost something they still have.
 */
export function liveStreak(best: Best, today: number): number {
  if (best.streakDay === null) return 0;
  const gap = today - best.streakDay;
  return gap === 0 || gap === 1 ? best.streak : 0;
}

/**
 * The line a player can copy, for both outcomes and giving nothing away.
 *
 * It names the day and what happened and never what was in the lanes — a
 * summary that leaked the beach would make sharing it an unkindness, and the
 * whole appeal of a daily is that everyone arrives at the same board unspoiled.
 *
 * A loss shares too, and reads as a lane rather than a failure. With one life
 * most runs are losses, and a share that only appears on a win is one most
 * players never see and never learn to expect.
 */
export function shareSummary(
  run: Run,
  totalShells: number,
  streak: number,
): string {
  const outcome = run.won
    ? `reached the sea in ${formatElapsed(run.elapsed)}`
    : `lane ${run.lanes}/${BEACH_LANES}`;
  const parts = [`Scuttle #${run.day}`, outcome];
  if (totalShells > 0) parts.push(`${run.shells}/${totalShells} shells`);
  if (streak > 1) parts.push(`${streak}-day streak`);
  return `${parts.join(" · ")}\nhttps://scuttle.taiotech.com`;
}

/**
 * Whether a value read back from storage is a record this version understands.
 *
 * Anything on a device can be edited, corrupted, or left behind by an older
 * build, and none of those may break the game — losing the record is a cost the
 * player can absorb and a crash on load is not.
 */
export function isBest(value: unknown): value is Partial<Best> {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  const ticksOk =
    candidate.ticks === null ||
    candidate.ticks === undefined ||
    (typeof candidate.ticks === "number" &&
      Number.isFinite(candidate.ticks) &&
      candidate.ticks >= 0);
  const lanesOk = countOk(candidate.lanes);
  return ticksOk && lanesOk;
}

/**
 * Fills in whatever a stored record is missing.
 *
 * Shells and the streak were added after the game had been played, and the
 * fields are purely additive: a record without them is a valid record of
 * somebody who has simply never had one. Reading it forward like this rather
 * than bumping the storage key is the difference between a returning player
 * keeping the personal best they earned and being quietly told they have never
 * played. A key bump throws away real results to save this function, which is
 * the wrong trade for a game whose whole score is a number on one device.
 *
 * Anything unrecognised falls back rather than throwing, for the reason
 * {@link isBest} exists: losing a record is a cost a player can absorb and a
 * crash on load is not.
 */
export function normalizeBest(value: Partial<Best>): Best {
  const empty = emptyBest();
  const streakDay =
    typeof value.streakDay === "number" && Number.isFinite(value.streakDay)
      ? value.streakDay
      : null;
  return {
    ticks: typeof value.ticks === "number" ? value.ticks : empty.ticks,
    lanes: countOr(value.lanes, empty.lanes),
    shells: countOr(value.shells, empty.shells),
    // A streak is only ever as real as the day attached to it. Without one it
    // cannot be told from a stale count, so it starts again rather than being
    // believed.
    streak: streakDay === null ? 0 : countOr(value.streak, empty.streak),
    streakDay,
    bestStreak: countOr(value.bestStreak, empty.bestStreak),
  };
}

function countOk(value: unknown): boolean {
  return (
    typeof value === "number" && Number.isFinite(value) && value >= 0
  );
}

function countOr(value: unknown, fallback: number): number {
  return countOk(value) ? (value as number) : fallback;
}
