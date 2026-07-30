import {
  type Best,
  emptyBest,
  isBest,
  normalizeBest,
  type Run,
  withRun,
} from "@/lib/records";

/**
 * The personal best, and the only code that touches storage.
 *
 * This lives outside `lib/` on purpose: `localStorage` is the browser, and
 * `lib/` is the part of the game that has rules rather than surroundings. What
 * counts as a record is decided in `lib/records.ts` and tested without any of
 * this.
 *
 * Shaped as an external store rather than component state for the same reason
 * the calendar date is: the page is prerendered, the record does not exist on
 * the server, and reading it during a render would either disagree with the
 * HTML already sent or have to be papered over by setting state in an effect.
 * Treating it as the external system it is makes both problems go away.
 *
 * Every operation swallows its failures. Storage can be full, disabled, or
 * refused outright in a private window, and losing the record must cost the
 * player their record and never their game.
 */

/**
 * Versioned, so a future change of shape cannot be read as this one.
 *
 * Still `v1` after shells and the streak were added, on purpose. Those fields
 * are additive, and `normalizeBest` reads an older record forward into them —
 * so bumping the key would throw away personal bests that are still perfectly
 * valid in order to avoid writing a function that had to exist anyway. It gets
 * bumped when a shape changes incompatibly, not when it grows.
 */
const KEY = "scuttle.best.v1";

/**
 * The snapshot handed to the server render, and the fallback everywhere else.
 *
 * One frozen instance because `useSyncExternalStore` compares snapshots by
 * identity — a fresh object every call is an infinite render.
 */
const NONE: Best = Object.freeze(emptyBest());

let cache: Best | null = null;
const listeners = new Set<() => void>();

function read(): Best {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw === null) return NONE;
    const parsed: unknown = JSON.parse(raw);
    return isBest(parsed) ? normalizeBest(parsed) : NONE;
  } catch {
    return NONE;
  }
}

/** Subscribes to changes. Only this module ever writes, so this is our own. */
export function subscribeBest(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The current record, read from storage once and cached by identity after. */
export function bestSnapshot(): Best {
  if (cache === null) cache = read();
  return cache;
}

/** What the server renders with: nothing, because it cannot know. */
export function serverBestSnapshot(): Best {
  return NONE;
}

/**
 * Folds a finished run into the record and reports whether it was a best.
 *
 * Writing through here rather than from the caller keeps the cache, the stored
 * value and the subscribers from ever disagreeing about what the record is.
 */
export function recordRun(run: Run): boolean {
  const outcome = withRun(bestSnapshot(), run);
  cache = outcome.best;

  try {
    window.localStorage.setItem(KEY, JSON.stringify(outcome.best));
  } catch {
    // A player in a private window keeps playing; they just keep no record.
  }

  for (const listener of listeners) listener();
  return outcome.improved;
}
