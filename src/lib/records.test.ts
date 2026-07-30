import { describe, expect, it } from "vitest";
import {
  type Best,
  emptyBest,
  isBest,
  liveStreak,
  normalizeBest,
  type Run,
  shareSummary,
  withRun,
} from "./records";

const lost = (lanes: number, day = 100, shells = 0): Run => ({
  won: false,
  lanes,
  elapsed: 0,
  shells,
  day,
});
const won = (elapsed: number, day = 100, shells = 0): Run => ({
  won: true,
  lanes: 32,
  elapsed,
  shells,
  day,
});

/** A record with the given fields and sensible nothing everywhere else. */
const best = (fields: Partial<Best> = {}): Best => ({
  ...emptyBest(),
  ...fields,
});

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
    const start = best({ ticks: 1_000, lanes: 5 });
    const slowWin = withRun(start, won(9_999));
    expect(slowWin.improved).toBe(false);
    expect(slowWin.best.ticks).toBe(1_000);
    expect(slowWin.best.lanes).toBe(32);
  });

  it("never lets a run make the record worse", () => {
    const start = best({ ticks: 1_000, lanes: 20, shells: 6 });
    expect(withRun(start, lost(2)).best).toEqual(start);
    expect(withRun(start, won(5_000)).best.ticks).toBe(1_000);
    expect(withRun(start, won(5_000, 100, 1)).best.shells).toBe(6);
  });

  it("does not modify the record it is given", () => {
    const start = best({ ticks: 1_000, lanes: 20 });
    const copy = { ...start };
    withRun(start, won(10));
    expect(start).toEqual(copy);
  });

  it("keeps the largest shell haul from any run", () => {
    const after = withRun(withRun(emptyBest(), lost(9, 100, 4)).best, won(1, 100, 2));
    expect(after.best.shells).toBe(4);
  });
});

describe("the streak", () => {
  it("starts at one on the first win", () => {
    const { best } = withRun(emptyBest(), won(1_000, 200));
    expect(best.streak).toBe(1);
    expect(best.streakDay).toBe(200);
  });

  it("grows on consecutive days", () => {
    let record = withRun(emptyBest(), won(1_000, 200)).best;
    record = withRun(record, won(1_000, 201)).best;
    record = withRun(record, won(1_000, 202)).best;
    expect(record.streak).toBe(3);
    expect(record.bestStreak).toBe(3);
  });

  it("does not grow twice in one day", () => {
    // Retries are unlimited, so without this a player could farm a streak of
    // thirty in an afternoon and the number would mean nothing.
    let record = withRun(emptyBest(), won(1_000, 200)).best;
    record = withRun(record, won(900, 200)).best;
    record = withRun(record, won(800, 200)).best;
    expect(record.streak).toBe(1);
  });

  it("starts again after a day was missed", () => {
    let record = withRun(emptyBest(), won(1_000, 200)).best;
    record = withRun(record, won(1_000, 201)).best;
    record = withRun(record, won(1_000, 205)).best;
    expect(record.streak).toBe(1);
    expect(record.bestStreak).toBe(2);
  });

  it("is untouched by a loss", () => {
    // A loss says nothing when retries are unlimited: a player who dies at
    // lane four and wins on the next go has still reached the sea today.
    const record = withRun(emptyBest(), won(1_000, 200)).best;
    const after = withRun(record, lost(4, 200)).best;
    expect(after.streak).toBe(1);
    expect(after.streakDay).toBe(200);
  });

  it("keeps the longest one ever held", () => {
    let record = withRun(emptyBest(), won(1, 1)).best;
    record = withRun(record, won(1, 2)).best;
    record = withRun(record, won(1, 3)).best;
    record = withRun(record, won(1, 90)).best;
    expect(record.streak).toBe(1);
    expect(record.bestStreak).toBe(3);
  });
});

describe("liveStreak", () => {
  it("is nothing at all before the sea has ever been reached", () => {
    expect(liveStreak(emptyBest(), 200)).toBe(0);
  });

  it("holds on the day it was won and the day after", () => {
    // Today counts as unbroken even before anything has been won on it: the
    // day is not over, and a streak that read zero every morning would be
    // telling the player they had lost something they still have.
    const record = best({ streak: 4, streakDay: 200 });
    expect(liveStreak(record, 200)).toBe(4);
    expect(liveStreak(record, 201)).toBe(4);
  });

  it("is gone once a whole day has passed without a win", () => {
    const record = best({ streak: 4, streakDay: 200 });
    expect(liveStreak(record, 202)).toBe(0);
    expect(liveStreak(record, 900)).toBe(0);
  });
});

describe("shareSummary", () => {
  it("names the day and the time for a win", () => {
    const text = shareSummary(won(1_464, 210, 6), 9, 1);
    expect(text).toContain("Scuttle #210");
    expect(text).toContain("24.4s");
    expect(text).toContain("6/9 shells");
  });

  it("names the lane reached for a loss, and still shares", () => {
    const text = shareSummary(lost(17, 210, 4), 9, 0);
    expect(text).toContain("Scuttle #210");
    expect(text).toContain("lane 17/32");
    expect(text).not.toContain("s ·  ");
  });

  it("gives nothing away about the beach itself", () => {
    // The whole appeal of a daily is that everybody arrives unspoiled, so a
    // summary that leaked the lanes would make sharing it an unkindness.
    const text = shareSummary(won(1_464, 210, 6), 9, 3);
    for (const spoiler of ["drift", "still", "towel", "walker", "seed"]) {
      expect(text.toLowerCase()).not.toContain(spoiler);
    }
  });

  it("mentions a streak only once it is more than today", () => {
    expect(shareSummary(won(1_000, 210), 0, 1)).not.toContain("streak");
    expect(shareSummary(won(1_000, 210), 0, 5)).toContain("5-day streak");
  });

  it("leaves the shells out of a beach that had none", () => {
    expect(shareSummary(won(1_000, 210), 0, 1)).not.toContain("shells");
  });
});

describe("isBest", () => {
  it("accepts a record that has never seen a win", () => {
    expect(isBest({ ticks: null, lanes: 0 })).toBe(true);
  });

  it("accepts a complete record", () => {
    expect(isBest({ ticks: 1_234, lanes: 32 })).toBe(true);
  });

  it("rejects anything a corrupt store might hold", () => {
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

describe("normalizeBest", () => {
  it("reads a record written before shells and streaks existed", () => {
    // The whole point of not bumping the storage key: somebody who set a real
    // personal best yesterday keeps it today.
    expect(normalizeBest({ ticks: 1_464, lanes: 32 })).toEqual({
      ticks: 1_464,
      lanes: 32,
      shells: 0,
      streak: 0,
      streakDay: null,
      bestStreak: 0,
    });
  });

  it("leaves a complete record exactly as it found it", () => {
    const full = best({
      ticks: 900,
      lanes: 32,
      shells: 7,
      streak: 3,
      streakDay: 204,
      bestStreak: 5,
    });
    expect(normalizeBest(full)).toEqual(full);
  });

  it("refuses to believe a streak with no day attached to it", () => {
    // A count without a date cannot be told from a stale one, so it starts
    // again rather than claiming a run it may not have.
    const orphan = normalizeBest({ ticks: null, lanes: 3, streak: 9 });
    expect(orphan.streak).toBe(0);
    expect(orphan.streakDay).toBeNull();
  });

  it("falls back rather than throwing on nonsense in the new fields", () => {
    const messy = normalizeBest({
      ticks: 100,
      lanes: 4,
      shells: Number.NaN as number,
      streak: -2 as number,
      streakDay: 200,
    });
    expect(messy.shells).toBe(0);
    expect(messy.streak).toBe(0);
  });
});
