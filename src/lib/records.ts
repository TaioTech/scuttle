/**
 * What the device remembers between runs, and the rules for updating it.
 *
 * Pure, like everything else here: this module decides what a new record is,
 * and knows nothing about where it is kept. Reading and writing the thing is
 * the browser's problem and lives with the rest of the side effects, which is
 * also what makes these rules testable without a storage API.
 */

/** How a run ended, reduced to the two numbers worth keeping. */
export type Run = {
  won: boolean;
  /** Lanes crossed, already capped at the length of the beach. */
  lanes: number;
  /** Ticks taken. Only meaningful for a run that reached the sea. */
  elapsed: number;
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
};

/** No runs yet. Also what a corrupt or missing record falls back to. */
export function emptyBest(): Best {
  return { ticks: null, lanes: 0 };
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

  return {
    best: {
      ticks: beatTime ? run.elapsed : best.ticks,
      lanes: beatDistance ? run.lanes : best.lanes,
    },
    improved: run.won ? beatTime : beatDistance,
  };
}

/**
 * Whether a value read back from storage is a record this version understands.
 *
 * Anything on a device can be edited, corrupted, or left behind by an older
 * build, and none of those may break the game — losing the record is a cost the
 * player can absorb and a crash on load is not.
 */
export function isBest(value: unknown): value is Best {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  const ticksOk =
    candidate.ticks === null ||
    (typeof candidate.ticks === "number" &&
      Number.isFinite(candidate.ticks) &&
      candidate.ticks >= 0);
  const lanesOk =
    typeof candidate.lanes === "number" &&
    Number.isFinite(candidate.lanes) &&
    candidate.lanes >= 0;
  return ticksOk && lanesOk;
}
