import { describe, expect, it } from "vitest";
import { createRng, dayNumber, deriveRng, seedForDay } from "./rng";

describe("dayNumber", () => {
  it("reads the local calendar date, not the instant", () => {
    // Late evening and early morning of the same local day are the same run,
    // even though they straddle midnight UTC in some zones.
    const evening = new Date(2026, 6, 29, 23, 30);
    const morning = new Date(2026, 6, 29, 0, 1);
    expect(dayNumber(evening)).toBe(dayNumber(morning));
  });

  it("advances by one per calendar day", () => {
    const first = dayNumber(new Date(2026, 6, 29, 12));
    const second = dayNumber(new Date(2026, 6, 30, 12));
    expect(second - first).toBe(1);
  });

  it("advances by one across a month boundary", () => {
    const last = dayNumber(new Date(2026, 6, 31, 12));
    const next = dayNumber(new Date(2026, 7, 1, 12));
    expect(next - last).toBe(1);
  });
});

describe("seedForDay", () => {
  it("gives adjacent days unrelated seeds", () => {
    // A weak hash would leave consecutive days a fixed distance apart, which
    // would show up as consecutive beaches looking like each other.
    const seeds = [40, 41, 42, 43, 44].map(seedForDay);
    const deltas = seeds.slice(1).map((seed, i) => seed - seeds[i]);
    expect(new Set(deltas).size).toBe(deltas.length);
  });

  it("is stable for a given day", () => {
    expect(seedForDay(42)).toBe(seedForDay(42));
  });
});

describe("createRng", () => {
  it("replays exactly from the same seed", () => {
    const a = createRng(1234);
    const b = createRng(1234);
    const first = Array.from({ length: 200 }, () => a());
    const second = Array.from({ length: 200 }, () => b());
    expect(first).toEqual(second);
  });

  it("stays inside [0, 1)", () => {
    const rng = createRng(seedForDay(7));
    for (let i = 0; i < 10_000; i += 1) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("spreads across the range rather than clustering", () => {
    const rng = createRng(seedForDay(11));
    const buckets = new Array(10).fill(0);
    for (let i = 0; i < 100_000; i += 1) {
      buckets[Math.floor(rng() * 10)] += 1;
    }
    for (const count of buckets) {
      expect(count).toBeGreaterThan(9_000);
      expect(count).toBeLessThan(11_000);
    }
  });
});

describe("deriveRng", () => {
  it("gives every row its own stream", () => {
    const seed = seedForDay(3);
    const firstDraws = new Set(
      Array.from({ length: 500 }, (_, row) => deriveRng(seed, row)()),
    );
    expect(firstDraws.size).toBe(500);
  });

  it("is addressable — row 400 does not depend on rows 0 to 399", () => {
    const seed = seedForDay(3);
    const direct = deriveRng(seed, 400)();
    for (let row = 0; row < 400; row += 1) deriveRng(seed, row)();
    expect(deriveRng(seed, 400)()).toBe(direct);
  });
});
