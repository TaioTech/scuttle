/**
 * What the hub's ledger gets told, and the rules for deciding it.
 *
 * Pure, like everything else here: this module decides what a day's submission
 * contains and how a finished run changes it, and knows nothing about fetch,
 * storage, or when any of it happens. Those live in
 * `components/ledgerStore.ts`, for the same reason `records.ts` and
 * `bestStore.ts` are two files.
 *
 * The contract itself is documented once, in the hub's
 * `docs/PROFILE_INTEGRATION.md`, and deliberately not restated here. Two rules
 * from it shape this file and are worth naming where they bite:
 *
 * - **The day's best is submitted, not the last run.** The ledger upserts
 *   unconditionally and cannot know which of two runs was better, so a day's
 *   entry is a high-water mark that only ever improves. That is what makes a
 *   retried or duplicated submission harmless by construction rather than by
 *   bookkeeping.
 * - **The day number is ours.** It comes from {@link import("./rng").dayNumber}
 *   and the ledger takes it as given, so a player's profile always agrees with
 *   the beach they were shown.
 */

import type { Run } from "./records";

/** This app's slug in the hub's project index. Also what makes it a known game. */
export const LEDGER_GAME = "scuttle";

/**
 * The collectibles' names on the profile.
 *
 * Permanent once shipped. Renaming one does not migrate the rows already stored
 * under the old name, so the profile would show both and neither would be whole.
 *
 * `wins` is deliberately plain rather than themed — no "crossings", no "seas".
 * These names are raw facts a later rewards system is expected to compute on,
 * and a name that describes what happened outlasts one that describes this
 * game's decoration.
 */
export const SHELL_COLLECTIBLE = "shells";
export const WIN_COLLECTIBLE = "wins";

/** The range the ledger accepts a day number in. Anything else is a 400 forever. */
const MIN_DAY = 1;
const MAX_DAY = 100_000;

/**
 * How many days of unsent submissions are worth keeping.
 *
 * A queue exists so a submission that could not be sent is not lost, not so
 * that an offline fortnight replays in full. Bounded because this sits in the
 * same storage as the personal best, and an unbounded list of days is the one
 * thing here that could grow until a write fails and takes the record with it.
 */
export const LEDGER_QUEUE_LIMIT = 14;

/**
 * One day's best, and whether the hub has heard about it yet.
 *
 * Kept after it has been sent, rather than dropped, because a later run on the
 * same day has to fold into the day's best — and a day whose best was forgotten
 * the moment it was sent would submit that run's numbers alone, which is the
 * last run rather than the day's best.
 */
export type DayBest = {
  /** The day number this app derived, from the player's local midnight. */
  readonly day: number;
  /** Furthest lane reached that day. */
  readonly lanes: number;
  /** Fewest ticks to the sea that day, or null if it was never reached. */
  readonly ticks: number | null;
  /** Most shells taken in a single run that day. */
  readonly shells: number;
  /** Whether this day still needs to reach the hub. */
  readonly pending: boolean;
};

/** A submission, in the shape the contract specifies. */
export type Submission = {
  readonly game: string;
  readonly day: number;
  readonly metrics: Readonly<Record<string, number>>;
  readonly collectibles: Readonly<Record<string, number>>;
};

/**
 * Whether a day number is one the ledger will accept.
 *
 * Checked here rather than discovered at the endpoint, because a day outside
 * the range is rejected identically every time — queueing it would mean
 * retrying a guaranteed failure on every load forever.
 */
export function submittableDay(day: number): boolean {
  return Number.isInteger(day) && day >= MIN_DAY && day <= MAX_DAY;
}

/**
 * Folds a finished run into the day's entry, marking it as needing to be sent.
 *
 * The high-water rule matches how the record on the device already works: a
 * won run competes on time, every run competes on distance, and shells are the
 * most taken in one go rather than a total for the day. Shells being a per-run
 * maximum matters more here than locally — the profile sums a collectible across
 * days, so a day contributing anything other than one run's worth would inflate
 * a lifetime total that nobody could reconcile.
 */
export function withRunToday(
  days: readonly DayBest[],
  run: Run,
): DayBest[] {
  const existing = days.find((entry) => entry.day === run.day);
  const beatTime =
    run.won && (existing?.ticks == null || run.elapsed < existing.ticks);

  const updated: DayBest = {
    day: run.day,
    lanes: Math.max(existing?.lanes ?? 0, run.lanes),
    ticks: beatTime ? run.elapsed : (existing?.ticks ?? null),
    shells: Math.max(existing?.shells ?? 0, run.shells),
    pending: true,
  };

  const others = days.filter((entry) => entry.day !== run.day);
  return [updated, ...others]
    .sort((a, b) => b.day - a.day)
    .slice(0, LEDGER_QUEUE_LIMIT);
}

/**
 * Marks a day as delivered, but only if it has not improved since.
 *
 * A run can finish while that day's submission is still in flight. Clearing the
 * flag by day alone would mark the better run as sent when what actually
 * reached the hub was the worse one, and nothing would ever send it again —
 * a silent loss of exactly the run the player cared about.
 */
export function settle(
  days: readonly DayBest[],
  submitted: DayBest,
): DayBest[] {
  return days.map((entry) =>
    entry.day === submitted.day && unchanged(entry, submitted)
      ? { ...entry, pending: false }
      : entry,
  );
}

function unchanged(entry: DayBest, submitted: DayBest): boolean {
  return (
    entry.lanes === submitted.lanes &&
    entry.ticks === submitted.ticks &&
    entry.shells === submitted.shells
  );
}

/** The days still owed to the hub, oldest first so a backlog arrives in order. */
export function pendingDays(days: readonly DayBest[]): DayBest[] {
  return days.filter((entry) => entry.pending).sort((a, b) => a.day - b.day);
}

/**
 * A day's entry as the contract's payload.
 *
 * `metrics` and `collectibles` must be flat objects of finite numbers, so the
 * unreached sea is an absent key rather than a null — and its absence is what
 * says the sea was never reached, since there is no boolean to say it with.
 *
 * A win is one per *day*, not one per run. Retries are unlimited, so counting
 * every winning run would let an afternoon manufacture thirty of them and the
 * total would stop meaning anything — the same reasoning that already stops
 * {@link import("./records").liveStreak} treating two wins in one day as two
 * days. Summed across days by the profile, this reads as the number of days the
 * sea was reached, which is the fact a later rewards system would want and the
 * one a player cannot farm.
 */
export function submissionFor(entry: DayBest): Submission {
  const metrics: Record<string, number> = { lanes: entry.lanes };
  if (entry.ticks !== null) metrics.ticks = entry.ticks;

  return {
    game: LEDGER_GAME,
    day: entry.day,
    metrics,
    collectibles: {
      [SHELL_COLLECTIBLE]: entry.shells,
      [WIN_COLLECTIBLE]: entry.ticks === null ? 0 : 1,
    },
  };
}

/**
 * Reads a stored queue back, keeping only what still makes sense.
 *
 * Same bar as the personal best: anything on a device can be edited, corrupted,
 * or left by an older build, and none of that may cost the player their game.
 * A malformed entry is dropped rather than repaired, because unlike the record
 * there is nothing here a player would miss.
 */
export function normalizeDays(value: unknown): DayBest[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter(isDayBest)
    .map((entry) => ({
      day: entry.day,
      lanes: entry.lanes,
      ticks: entry.ticks ?? null,
      shells: entry.shells,
      pending: entry.pending === true,
    }))
    .sort((a, b) => b.day - a.day)
    .slice(0, LEDGER_QUEUE_LIMIT);
}

function isDayBest(value: unknown): value is DayBest {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Record<string, unknown>;

  return (
    typeof entry.day === "number" &&
    submittableDay(entry.day) &&
    countOk(entry.lanes) &&
    countOk(entry.shells) &&
    (entry.ticks === null ||
      entry.ticks === undefined ||
      countOk(entry.ticks))
  );
}

function countOk(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}
