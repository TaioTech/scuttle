import { describe, expect, it } from "vitest";
import { type Best, emptyBest, isBest, withRun } from "./records";

const lost = (lanes: number) => ({ won: false, lanes, elapsed: 0 });
const won = (elapsed: number) => ({ won: true, lanes: 32, elapsed });

describe("withRun", () => {
  it("takes the first win as the best time", () => {
    const { best, improved } = withRun(emptyBest(), won(2_400));
    expect(best.ticks).toBe(2_400);
    expect(improved).toBe(true);
  });

  it("keeps the faster of two wins", () => {
    const first = withRun(emptyBest(), won(2_400)).best;
    const faster = withRun(first, won(1_900));
    expect(faster.best.ticks).toBe(1_900);
    expect(faster.improved).toBe(true);

    const slower = withRun(faster.best, won(3_000));
    expect(slower.best.ticks).toBe(1_900);
    expect(slower.improved).toBe(false);
  });

  it("keeps the furthest of two losses", () => {
    const first = withRun(emptyBest(), lost(11));
    expect(first.best.lanes).toBe(11);
    expect(first.improved).toBe(true);

    const shorter = withRun(first.best, lost(4));
    expect(shorter.best.lanes).toBe(11);
    expect(shorter.improved).toBe(false);
  });

  it("measures a win against the time and a loss against the distance", () => {
    // A slow win still reached the sea, so it raises the distance without
    // announcing itself as a record.
    const start: Best = { ticks: 1_000, lanes: 5 };
    const slowWin = withRun(start, won(9_999));
    expect(slowWin.improved).toBe(false);
    expect(slowWin.best.ticks).toBe(1_000);
    expect(slowWin.best.lanes).toBe(32);
  });

  it("never lets a run make the record worse", () => {
    const start: Best = { ticks: 1_000, lanes: 20 };
    expect(withRun(start, lost(2)).best).toEqual(start);
    expect(withRun(start, won(5_000)).best.ticks).toBe(1_000);
  });

  it("does not modify the record it is given", () => {
    const start: Best = { ticks: 1_000, lanes: 20 };
    const copy = { ...start };
    withRun(start, won(10));
    expect(start).toEqual(copy);
  });
});

describe("isBest", () => {
  it("accepts a record that has never seen a win", () => {
    expect(isBest({ ticks: null, lanes: 0 })).toBe(true);
  });

  it("accepts a complete record", () => {
    expect(isBest({ ticks: 1_234, lanes: 32 })).toBe(true);
  });

  it("rejects anything a corrupt or older store might hold", () => {
    // None of these may reach the game: a record is the one thing here that
    // arrives from outside and can be edited by hand.
    for (const value of [
      null,
      undefined,
      42,
      "best",
      [],
      {},
      { ticks: 1 },
      { lanes: 1 },
      { ticks: "1", lanes: 1 },
      { ticks: 1, lanes: "1" },
      { ticks: Number.NaN, lanes: 1 },
      { ticks: 1, lanes: Number.POSITIVE_INFINITY },
      { ticks: -1, lanes: 1 },
      { ticks: 1, lanes: -3 },
    ]) {
      expect(isBest(value)).toBe(false);
    }
  });
});
