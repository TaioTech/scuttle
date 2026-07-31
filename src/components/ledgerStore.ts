import {
  type DayBest,
  normalizeDays,
  pendingDays,
  settle,
  submissionFor,
  submittableDay,
  withRunToday,
} from "@/lib/ledger";
import type { Run } from "@/lib/records";

/**
 * Reporting a day to the hub's ledger, and the only code that talks to it.
 *
 * This lives outside `lib/` for the same reason `bestStore.ts` does: the
 * network and `localStorage` are surroundings, not rules. What a submission
 * contains is decided in `lib/ledger.ts` and tested without any of this.
 *
 * The contract is documented once, in the hub's `docs/PROFILE_INTEGRATION.md`.
 * The boundary it draws is the thing to hold on to here: **the hub owns the
 * ledger, this app writes to it and never reads from it.** `scuttle.best.v1`
 * remains the source of truth for every screen this game draws. Losing the
 * ledger costs the profile on the hub and never the game — so every operation in
 * this file swallows its failures, and nothing the player does waits on one.
 */

/** Versioned separately from the record, because it is a separate shape. */
const KEY = "scuttle.ledger.v1";

/**
 * Where the ledger lives.
 *
 * Overridable because cross-subdomain identity cannot be exercised on a preview
 * deployment at all — `vercel.app` is on the Public Suffix List, so no cookie
 * spans it — which leaves local hostnames under a shared parent, or production.
 * The hub's README carries the `/etc/hosts` setup for the local case.
 */
const ENDPOINT = `${
  process.env.NEXT_PUBLIC_LEDGER_ORIGIN ?? "https://taiotech.com"
}/api/results`;

function read(): DayBest[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw === null) return [];
    return normalizeDays(JSON.parse(raw) as unknown);
  } catch {
    return [];
  }
}

function write(days: readonly DayBest[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(days));
  } catch {
    // Storage full, disabled, or refused in a private window. The player keeps
    // playing; the hub just never hears about it.
  }
}

/**
 * Sends one day, and clears it from the queue only if the hub took it.
 *
 * Every non-200 is treated identically on purpose — a 400, a 403 and a 503 are
 * all "it did not land", and a game that told them apart would be encoding the
 * hub's internals into itself. It stays queued and goes again on the next load.
 */
async function post(entry: DayBest): Promise<void> {
  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      // The single most important line in the integration. Without it the
      // browser omits the session cookie, so every submission mints a brand new
      // anonymous player and the profile fragments into one-day slivers — with
      // nothing erroring anywhere to say so.
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(submissionFor(entry)),
      // A run often ends with the player closing the tab. This lets the request
      // outlive the page rather than being cancelled on unload.
      keepalive: true,
    });

    if (!response.ok) return;
    write(settle(read(), entry));
  } catch {
    // Offline, DNS failure, or the hub simply not there. Stays queued.
  }
}

/**
 * Records a finished run for the hub, after the local write has already
 * happened.
 *
 * Returns nothing and is never awaited: play does not wait on a submission and
 * a failure is silent to the player mid-run. What is sent is the day's best so
 * far rather than this run, which is what makes a duplicate harmless.
 */
export function submitRun(run: Run): void {
  if (!submittableDay(run.day)) return;

  const days = withRunToday(read(), run);
  write(days);

  const today = days.find((entry) => entry.day === run.day);
  if (today) void post(today);
}

/**
 * Sends anything that never made it, oldest day first.
 *
 * Called on load rather than on a timer or a connectivity event: a retry that
 * costs nothing and happens when the player was coming back anyway is the whole
 * of what rule 4 asks for, and a background scheduler would be a moving part
 * added to a path that is allowed to fail.
 */
export function flushLedger(): void {
  for (const entry of pendingDays(read())) void post(entry);
}
