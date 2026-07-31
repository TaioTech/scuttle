import { describe, expect, it } from "vitest";
import {
  type DayBest,
  LEDGER_QUEUE_LIMIT,
  normalizeDays,
  pendingDays,
  settle,
  submissionFor,
  submittableDay,
  withRunToday,
} from "./ledger";
import type { Run } from "./records";

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

/** A day's entry with the given fields and sensible nothing everywhere else. */
const entry = (fields: Partial<DayBest> = {}): DayBest => ({
  day: 100,
  lanes: 0,
  ticks: null,
  shells: 0,
  pending: false,
  ...fields,
});

describe("submittableDay", () => {
  it("accepts a day inside the ledger's range", () => {
    expect(submittableDay(210)).toBe(true);
  });

  it("rejects a day the ledger would reject forever", () => {
    // A clock set before the epoch produces these, and queueing one would mean
    // retrying a guaranteed 400 on every load for good.
    expect(submittableDay(0)).toBe(false);
    expect(submittableDay(-3)).toBe(false);
    expect(submittableDay(100_001)).toBe(false);
    expect(submittableDay(1.5)).toBe(false);
  });
});

describe("withRunToday", () => {
  it("takes a first run as the day's best and marks it unsent", () => {
    const [today] = withRunToday([], lost(7, 100, 2));
    expect(today).toMatchObject({ day: 100, lanes: 7, ticks: null, shells: 2 });
    expect(today.pending).toBe(true);
  });

  it("keeps the furthest lane rather than the latest", () => {
    const days = withRunToday(withRunToday([], lost(9)), lost(4));
    expect(days[0].lanes).toBe(9);
  });

  it("keeps the fastest crossing rather than the latest", () => {
    const days = withRunToday(withRunToday([], won(2_400)), won(3_000));
    expect(days[0].ticks).toBe(2_400);
  });

  it("keeps the most shells taken in one run", () => {
    const days = withRunToday(withRunToday([], lost(3, 100, 5)), lost(3, 100, 1));
    expect(days[0].shells).toBe(5);
  });

  it("does not let a later loss erase the day's crossing", () => {
    const days = withRunToday(withRunToday([], won(2_400)), lost(4));
    expect(days[0].ticks).toBe(2_400);
    expect(days[0].lanes).toBe(32);
  });

  it("marks a settled day unsent again when a better run lands", () => {
    const settled = [entry({ lanes: 4, pending: false })];
    expect(withRunToday(settled, lost(9))[0].pending).toBe(true);
  });

  it("keeps days apart", () => {
    const days = withRunToday(withRunToday([], lost(9, 100)), lost(4, 101));
    expect(days.map((day) => day.day)).toEqual([101, 100]);
    expect(days[1].lanes).toBe(9);
  });

  it("drops the oldest days rather than growing without bound", () => {
    let days: DayBest[] = [];
    for (let day = 1; day <= LEDGER_QUEUE_LIMIT + 5; day += 1) {
      days = withRunToday(days, lost(1, day));
    }
    expect(days).toHaveLength(LEDGER_QUEUE_LIMIT);
    expect(days[0].day).toBe(LEDGER_QUEUE_LIMIT + 5);
  });
});

describe("settle", () => {
  it("clears a day the hub took", () => {
    const sent = entry({ lanes: 9, pending: true });
    expect(settle([sent], sent)[0].pending).toBe(false);
  });

  it("leaves a day that improved while the submission was in flight", () => {
    // Otherwise the better run is marked as sent when the worse one landed,
    // and nothing ever sends it again.
    const inFlight = entry({ lanes: 4, pending: true });
    const improved = withRunToday([inFlight], lost(9));
    expect(settle(improved, inFlight)[0].pending).toBe(true);
  });

  it("leaves other days alone", () => {
    const sent = entry({ day: 100, pending: true });
    const other = entry({ day: 101, pending: true });
    expect(settle([other, sent], sent)[0].pending).toBe(true);
  });
});

describe("pendingDays", () => {
  it("returns only what is owed, oldest first", () => {
    const days = [
      entry({ day: 102, pending: true }),
      entry({ day: 101, pending: false }),
      entry({ day: 100, pending: true }),
    ];
    expect(pendingDays(days).map((day) => day.day)).toEqual([100, 102]);
  });
});

describe("submissionFor", () => {
  it("names the game and carries the day the app derived", () => {
    const submission = submissionFor(entry({ day: 210, lanes: 9, shells: 3 }));
    expect(submission.game).toBe("scuttle");
    expect(submission.day).toBe(210);
  });

  it("puts shells on the profile under their own name", () => {
    expect(submissionFor(entry({ shells: 3 })).collectibles.shells).toBe(3);
  });

  it("counts no win on a day the sea was never reached", () => {
    expect(submissionFor(entry({ lanes: 9 })).collectibles.wins).toBe(0);
  });

  it("counts a win on a day the sea was reached", () => {
    expect(submissionFor(entry({ ticks: 2_400 })).collectibles.wins).toBe(1);
  });

  it("counts one win a day however many times the sea was reached", () => {
    // Retries are unlimited, so a per-run count would let an afternoon
    // manufacture thirty wins and the total would stop meaning anything.
    const twice = withRunToday(withRunToday([], won(2_400)), won(2_000));
    expect(submissionFor(twice[0]).collectibles.wins).toBe(1);
  });

  it("keeps the win once a later loss lands on the same day", () => {
    const thenLost = withRunToday(withRunToday([], won(2_400)), lost(4));
    expect(submissionFor(thenLost[0]).collectibles.wins).toBe(1);
  });

  it("omits the crossing time when the sea was never reached", () => {
    // Absence is what says it was never reached: metrics take finite numbers
    // only, so there is no null and no boolean to say it with.
    expect(submissionFor(entry({ lanes: 9 })).metrics).toEqual({ lanes: 9 });
  });

  it("reports the crossing time when the sea was reached", () => {
    const metrics = submissionFor(entry({ lanes: 32, ticks: 2_400 })).metrics;
    expect(metrics).toEqual({ lanes: 32, ticks: 2_400 });
  });

  it("sends only finite numbers, which is all the ledger accepts", () => {
    const submission = submissionFor(entry({ lanes: 32, ticks: 2_400, shells: 3 }));
    const values = [
      ...Object.values(submission.metrics),
      ...Object.values(submission.collectibles),
    ];
    expect(values.every((value) => Number.isFinite(value))).toBe(true);
  });
});

describe("normalizeDays", () => {
  it("reads a stored queue back", () => {
    const stored = [{ day: 100, lanes: 9, ticks: null, shells: 2, pending: true }];
    expect(normalizeDays(stored)).toEqual(stored);
  });

  it("falls back rather than throwing on anything unrecognised", () => {
    expect(normalizeDays(null)).toEqual([]);
    expect(normalizeDays("nonsense")).toEqual([]);
    expect(normalizeDays({ day: 100 })).toEqual([]);
  });

  it("drops entries that could never be sent", () => {
    const stored = [
      { day: 100, lanes: 9, ticks: null, shells: 2, pending: true },
      { day: 0, lanes: 1, ticks: null, shells: 0, pending: true },
      { day: 101, lanes: -1, ticks: null, shells: 0, pending: true },
    ];
    expect(normalizeDays(stored).map((day) => day.day)).toEqual([100]);
  });

  it("treats a missing pending flag as nothing owed", () => {
    const stored = [{ day: 100, lanes: 9, ticks: null, shells: 2 }];
    expect(normalizeDays(stored)[0].pending).toBe(false);
  });

  it("bounds what it reads back", () => {
    const stored = Array.from({ length: LEDGER_QUEUE_LIMIT + 5 }, (_, i) => ({
      day: i + 1,
      lanes: 1,
      ticks: null,
      shells: 0,
      pending: true,
    }));
    expect(normalizeDays(stored)).toHaveLength(LEDGER_QUEUE_LIMIT);
  });
});
