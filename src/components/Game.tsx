"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { beachFor, shellCount } from "@/lib/board";
import { BEACH_LANES, STEP_HAPTIC_MS, TICK_MS } from "@/lib/constants";
import {
  bestSnapshot,
  recordRun,
  serverBestSnapshot,
  subscribeBest,
} from "./bestStore";
import { flushLedger, submitRun } from "./ledgerStore";
import { drainTicks } from "@/lib/loop";
import { dayNumber, seedForDay } from "@/lib/rng";
import { drawFrame, fitView, type View } from "@/lib/render";
import {
  createSim,
  formatElapsed,
  type Input,
  roamersOf,
  shellsTaken,
  stepSim,
} from "@/lib/sim";
import { liveStreak, type Run, shareSummary } from "@/lib/records";
import Controls, { type Control } from "./Controls";

/** How a run ended, the numbers worth showing for it, and whether it was a best. */
type Result = Run & {
  improved: boolean;
  /** How many shells the day's beach was holding, so the count has a total. */
  totalShells: number;
  /** The streak as it stands after this run. */
  streak: number;
};

/**
 * A short buzz at the moment a step commits.
 *
 * Feature-detected rather than assumed: Safari on iOS does not implement the
 * Vibration API at all, so on an iPhone this is simply nothing happening. It is
 * wrapped because a browser that has the method can still refuse the call.
 */
function thump(): void {
  try {
    navigator.vibrate?.(STEP_HAPTIC_MS);
  } catch {
    // A device that will not buzz is not a reason to drop a frame.
  }
}

/**
 * The whole game: a canvas, three buttons, and the loop between them.
 *
 * This is the only file that knows what time it is. Everything with a rule in
 * it — the beach, the movement, the collisions — is pure and lives under
 * `lib/`, and all this does is turn elapsed milliseconds into a count of ticks,
 * hand the buttons to each one in turn, and draw the result.
 */
export default function Game() {
  const day = useToday();
  const [run, setRun] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [copied, setCopied] = useState(false);

  // Derived rather than stored: the day's shell count is a pure function of the
  // day, and a second copy of it is a second thing that can be wrong.
  const totalShells = day === null ? 0 : shellCount(seedForDay(day));

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const distanceRef = useRef<HTMLSpanElement>(null);
  const clockRef = useRef<HTMLSpanElement>(null);
  const shellRef = useRef<HTMLSpanElement>(null);

  const best = useSyncExternalStore(
    subscribeBest,
    bestSnapshot,
    serverBestSnapshot,
  );
  const held = useRef({ left: false, right: false, forward: false });
  // A tap can begin and end inside one frame on a slow device. Latching it
  // guarantees the press survives to be seen by at least one tick.
  const tapped = useRef(false);

  const hold = useCallback((control: Control, down: boolean) => {
    held.current[control] = down;
    if (control === "forward" && down) tapped.current = true;
  }, []);

  // A day that never reached the hub goes again when the player comes back.
  // Safe to repeat: the ledger keys on player, game and day, and what is sent
  // is the day's best, so a duplicate lands on the same row with the same
  // numbers.
  useEffect(() => {
    flushLedger();
  }, []);

  useEffect(() => {
    const control = (key: string): Control | null => {
      if (key === "ArrowLeft" || key === "a") return "left";
      if (key === "ArrowRight" || key === "d") return "right";
      if (key === "ArrowUp" || key === "w" || key === " ") return "forward";
      return null;
    };

    const down = (event: KeyboardEvent) => {
      const pressed = control(event.key);
      if (!pressed) return;
      event.preventDefault();
      if (!event.repeat) hold(pressed, true);
    };
    const up = (event: KeyboardEvent) => {
      const pressed = control(event.key);
      if (pressed) hold(pressed, false);
    };

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [hold]);

  useEffect(() => {
    if (day === null) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const seed = seedForDay(day);
    const beach = beachFor(seed);
    let previous = createSim();
    let current = previous;
    let pending = 0;
    let last = performance.now();
    let frame = 0;

    let size = { width: 0, height: 0 };
    let view: View = fitView(1, 1);

    const paint = () => {
      drawFrame(
        ctx,
        view,
        beach,
        previous,
        current,
        current.alive ? pending / TICK_MS : 1,
        size,
        roamersOf(current),
      );
    };

    const measure = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      // Capped because a 4x device pixel ratio quadruples the fill cost for a
      // page made entirely of flat rectangles.
      const ratio = Math.min(window.devicePixelRatio || 1, 3);
      canvas.width = Math.round(rect.width * ratio);
      canvas.height = Math.round(rect.height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      size = { width: rect.width, height: rect.height };
      view = fitView(rect.width, rect.height);
      // Assigning to canvas.width clears the canvas, and once the run has
      // ended there is no loop left to draw the next frame. Without this the
      // beach vanishes from behind the result the first time anything resizes
      // — which on a phone is the URL bar collapsing, not an edge case.
      paint();
    };

    const loop = (now: number) => {
      const drain = drainTicks(pending, now - last);
      last = now;
      pending = drain.pending;

      for (let i = 0; i < drain.ticks; i += 1) {
        const input: Input = {
          left: held.current.left,
          right: held.current.right,
          forward: held.current.forward || tapped.current,
        };
        tapped.current = false;
        previous = current;
        current = stepSim(current, input, beach);
        // The instant the step begins, not when the button was pressed: the
        // press might have been buffered, and what the player is being told is
        // that control has just left them.
        if (previous.step === null && current.step !== null) thump();
      }

      // Written straight to the DOM rather than through state: these change on
      // most of sixty ticks a second, and re-rendering the tree that often to
      // update two numbers is the whole frame budget spent on nothing.
      // Capped because `furthest` is a row and the sea is a row: a won run
      // would otherwise report thirty-three of thirty-two lanes crossed.
      if (distanceRef.current) {
        distanceRef.current.textContent = String(
          Math.min(current.furthest, BEACH_LANES),
        );
      }
      if (clockRef.current) {
        clockRef.current.textContent = formatElapsed(current.elapsed);
      }
      if (shellRef.current) {
        shellRef.current.textContent = String(shellsTaken(current));
      }

      paint();

      if (current.alive && !current.won) {
        frame = requestAnimationFrame(loop);
      } else {
        const finished: Run = {
          won: current.won,
          lanes: Math.min(current.furthest, BEACH_LANES),
          elapsed: current.elapsed,
          shells: shellsTaken(current),
          day,
        };
        const improved = recordRun(finished);
        // After the local write, and never awaited: the record on this device
        // is the source of truth for every screen here, and the hub hearing
        // about the day is additive. A submission that fails is silent.
        submitRun(finished);
        setResult({
          ...finished,
          improved,
          totalShells: shellCount(seedForDay(day)),
          streak: liveStreak(bestSnapshot(), day),
        });
      }
    };

    // A backgrounded tab stops receiving frames, so the first frame after
    // coming back reports however long the phone was in a pocket. The clamp in
    // the loop would cap that at a quarter second of beach the player never
    // saw; resetting the clock means they lose none of it.
    const resume = () => {
      if (!document.hidden) last = performance.now();
    };

    const observer = new ResizeObserver(measure);
    observer.observe(canvas);
    document.addEventListener("visibilitychange", resume);

    measure();
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("visibilitychange", resume);
    };
  }, [day, run]);

  const restart = () => {
    held.current = { left: false, right: false, forward: false };
    tapped.current = false;
    setCopied(false);
    setResult(null);
    setRun((id) => id + 1);
  };

  /**
   * Copies the day's summary, falling back to the share sheet on a phone.
   *
   * The clipboard is tried first because it works the same everywhere and asks
   * nothing of the player. `navigator.share` is nicer on a phone but it is
   * gated on a user gesture, absent on desktop, and rejects when the sheet is
   * dismissed — which is not a failure worth telling anybody about.
   */
  const share = async () => {
    if (result === null) return;
    const text = shareSummary(result, result.totalShells, result.streak);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      try {
        await navigator.share?.({ text });
      } catch {
        // A dismissed share sheet and a refused clipboard look identical from
        // here, and neither is worth interrupting the player over.
      }
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-baseline justify-between gap-3 px-4 py-3 text-xs tracking-wide text-muted">
        <span className="font-mono">
          <span ref={distanceRef} className="text-foreground">
            0
          </span>
          <span className="text-muted">/{BEACH_LANES}</span> lanes
        </span>
        <span ref={clockRef} className="font-mono tabular-nums text-foreground">
          0.0s
        </span>
        <span className="font-mono">
          {/* Shown only once the day is known, because the total comes from the
              day's seed and "0/—" is worse than waiting a frame for it. */}
          {totalShells > 0 && (
            <span className="text-shell">
              <span ref={shellRef}>0</span>/{totalShells}{" "}
            </span>
          )}
          {day === null ? "beach —" : `#${day}`}
        </span>
      </header>

      <div className="relative min-h-0 flex-1">
        <canvas ref={canvasRef} className="block h-full w-full touch-none" />

        {result !== null && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/85 px-6 text-center">
            <p className="text-sm text-muted">
              {result.won ? "Reached the sea" : "Caught on the sand"}
            </p>
            <p className="font-mono text-4xl text-accent">
              {result.won ? formatElapsed(result.elapsed) : result.lanes}
            </p>
            <p className="text-sm text-muted">
              {result.won
                ? `all ${BEACH_LANES} lanes`
                : result.lanes === 1
                  ? "lane crossed"
                  : "lanes crossed"}
            </p>

            {result.totalShells > 0 && (
              <p className="font-mono text-sm text-shell">
                {result.shells}/{result.totalShells} shells
              </p>
            )}

            {/* A first run has nothing to be measured against, and "best 0
                lanes" is a fact nobody needed. */}
            {result.improved ? (
              <p className="font-mono text-xs tracking-wide text-accent">
                new best
              </p>
            ) : (
              <p className="font-mono text-xs tracking-wide text-muted">
                {result.won
                  ? best.ticks !== null && `best ${formatElapsed(best.ticks)}`
                  : best.lanes > 0 &&
                    `best ${best.lanes} ${best.lanes === 1 ? "lane" : "lanes"}`}
              </p>
            )}

            {/* A streak of one is just today, and saying so out loud makes the
                number look like something being lost rather than started. */}
            {result.streak > 1 && (
              <p className="font-mono text-xs tracking-wide text-muted">
                {result.streak}-day streak
              </p>
            )}

            <div className="mt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={restart}
                className="rounded border border-line px-5 py-2 text-sm text-foreground transition-colors hover:border-accent hover:text-accent"
              >
                Again
              </button>
              <button
                type="button"
                onClick={share}
                className="rounded border border-line px-5 py-2 text-sm text-foreground transition-colors hover:border-accent hover:text-accent"
              >
                {copied ? "Copied" : "Share"}
              </button>
            </div>
          </div>
        )}
      </div>

      <Controls onHold={hold} />
    </div>
  );
}

/**
 * Which day it is, on the client only.
 *
 * The page is prerendered, so a date read while rendering would be whichever
 * day the deploy happened on — and reading it during the first client render
 * instead would disagree with the HTML that was already sent. Both problems go
 * away by treating the calendar as the external system it is: the server
 * snapshot is nothing, the client snapshot is today, and it does not change
 * under a run in progress.
 */
function useToday(): number | null {
  return useSyncExternalStore<number | null>(
    () => () => {},
    () => dayNumber(new Date()),
    () => null,
  );
}
