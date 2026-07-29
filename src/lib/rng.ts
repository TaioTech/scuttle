/**
 * Seeded randomness, and the day seed everything else derives from.
 *
 * Nothing in a run may sample an unseeded source. Two devices playing the same
 * calendar day, offline and with no contact between them, have to face the same
 * beach, and the only thing they are guaranteed to agree on is the date.
 */

/** Milliseconds in a day. */
const DAY_MS = 86_400_000;

/**
 * The day Scuttle counts from. Arbitrary, but fixed forever: changing it
 * renumbers every day that has already been played.
 */
const EPOCH_UTC = Date.UTC(2026, 0, 1);

/**
 * Which numbered day a date falls on.
 *
 * Read from the *local* calendar rather than from UTC. A run belongs to the day
 * the player is living in, so someone playing at eleven at night gets that
 * day's beach rather than tomorrow's. Two players in different time zones
 * therefore cross paths a few hours apart rather than at the same instant,
 * which is the intended behaviour for a daily.
 */
export function dayNumber(date: Date): number {
  const local = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor((local - EPOCH_UTC) / DAY_MS);
}

/**
 * The seed for a numbered day.
 *
 * Adjacent days are adjacent integers, which a weak hash would turn into
 * near-identical beaches. Mixing here means day 41 and day 42 share nothing.
 */
export function seedForDay(day: number): number {
  return mix32(day + 0x9e37_79b9);
}

/**
 * A deterministic generator over `[0, 1)`.
 *
 * Two generators built from the same seed produce the same sequence, on any
 * device and any JavaScript engine — the arithmetic is all 32-bit integer work
 * and never touches a float until the final division.
 */
export function createRng(seed: number): () => number {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b_79f5) | 0;
    return mix32(state) / 4_294_967_296;
  };
}

/**
 * A generator for one addressable slice of a seed.
 *
 * Lets a lane be generated from its row index alone, without walking the beach
 * from row zero to get there — which matters because the renderer needs lanes
 * ahead of the crab and the simulation needs them behind it.
 */
export function deriveRng(seed: number, key: number): () => number {
  return createRng((seed ^ Math.imul(key + 1, 0x9e37_79b9)) | 0);
}

/** A seeded float in `[min, max)`. */
export function rangeFloat(
  rng: () => number,
  min: number,
  max: number,
): number {
  return min + rng() * (max - min);
}

/** A seeded integer in `[min, max]`, both ends included. */
export function rangeInt(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/**
 * SplitMix32's finalising mix, returning an unsigned 32-bit integer.
 *
 * Every operation is masked back into 32 bits with `Math.imul` and the unsigned
 * shift, so the result does not depend on how a given engine happens to hold
 * intermediate numbers.
 */
function mix32(input: number): number {
  let z = input | 0;
  z = Math.imul(z ^ (z >>> 16), 0x21f0_aaad);
  z = Math.imul(z ^ (z >>> 15), 0x735a_2d97);
  return (z ^ (z >>> 15)) >>> 0;
}
