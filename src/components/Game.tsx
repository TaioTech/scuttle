"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { beachFor } from "@/lib/board";
import { TICK_MS } from "@/lib/constants";
import { drainTicks } from "@/lib/loop";
import { dayNumber, seedForDay } from "@/lib/rng";
import { drawFrame, fitView, type View } from "@/lib/render";
import { createSim, type Input, stepSim } from "@/lib/sim";
import Controls, { type Control } from "./Controls";

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
  const [result, setResult] = useState<number | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const distanceRef = useRef<HTMLSpanElement>(null);
  const held = useRef({ left: false, right: false, forward: false });
  // A tap can begin and end inside one frame on a slow device. Latching it
  // guarantees the press survives to be seen by at least one tick.
  const tapped = useRef(false);

  const hold = useCallback((control: Control, down: boolean) => {
    held.current[control] = down;
    if (control === "forward" && down) tapped.current = true;
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

    const beach = beachFor(seedForDay(day));
    let previous = createSim();
    let current = previous;
    let pending = 0;
    let last = performance.now();
    let frame = 0;

    let size = { width: 0, height: 0 };
    let view: View = fitView(1, 1);

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
      }

      if (distanceRef.current) {
        distanceRef.current.textContent = String(current.furthest);
      }

      drawFrame(
        ctx,
        view,
        beach,
        previous,
        current,
        current.alive ? pending / TICK_MS : 1,
        size,
      );

      if (current.alive) frame = requestAnimationFrame(loop);
      else setResult(current.furthest);
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
    setResult(null);
    setRun((id) => id + 1);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-baseline justify-between px-4 py-3 text-xs tracking-wide text-muted">
        <span className="font-mono">
          <span ref={distanceRef} className="text-foreground">
            0
          </span>{" "}
          lanes
        </span>
        <span className="font-mono">
          {day === null ? "beach —" : `beach #${day}`}
        </span>
      </header>

      <div className="relative min-h-0 flex-1">
        <canvas ref={canvasRef} className="block h-full w-full touch-none" />

        {result !== null && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background/85 px-6 text-center">
            <p className="text-sm text-muted">Caught on the sand</p>
            <p className="font-mono text-4xl text-accent">{result}</p>
            <p className="text-sm text-muted">
              {result === 1 ? "lane crossed" : "lanes crossed"}
            </p>
            <button
              type="button"
              onClick={restart}
              className="mt-2 rounded border border-line px-5 py-2 text-sm text-foreground transition-colors hover:border-accent hover:text-accent"
            >
              Again
            </button>
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
