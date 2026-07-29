"use client";

import type { PointerEvent } from "react";

/** The three things a player can press. There is nothing else. */
export type Control = "left" | "right" | "forward";

type ControlsProps = {
  /** Called on every press and release, including releases off the button. */
  onHold: (control: Control, down: boolean) => void;
};

/**
 * Left, forward, right, across the bottom of the screen.
 *
 * Three targets on one row, each a third of the width and tall enough to hit
 * without looking, so the whole game is reachable by one thumb on a phone held
 * in one hand. Nothing here needs a swipe, a drag, or two fingers at once.
 *
 * Presses go straight out through {@link ControlsProps.onHold} into a ref the
 * game loop reads. Holding a button is a sixty-times-a-second event and putting
 * it in React state would re-render the tree on every frame of it.
 */
export default function Controls({ onHold }: ControlsProps) {
  return (
    <div className="grid grid-cols-3 gap-px bg-line select-none">
      <Button control="left" label="Left" glyph="◀" onHold={onHold} />
      <Button control="forward" label="Forward" glyph="▲" onHold={onHold} />
      <Button control="right" label="Right" glyph="▶" onHold={onHold} />
    </div>
  );
}

function Button({
  control,
  label,
  glyph,
  onHold,
}: {
  control: Control;
  label: string;
  glyph: string;
  onHold: ControlsProps["onHold"];
}) {
  // Capturing the pointer means a thumb that slides off the button still
  // releases it. Without that, sliding off leaves the crab walking sideways
  // with nothing pressed.
  const down = (event: PointerEvent<HTMLButtonElement>) => {
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Capture is a refinement, not the mechanism. If a browser refuses it,
      // the press still has to register — losing the button entirely because
      // the nicety failed is the worse of the two outcomes.
    }
    onHold(control, true);
  };

  return (
    <button
      type="button"
      aria-label={label}
      className="touch-none bg-background py-7 text-2xl text-muted transition-colors duration-75 active:bg-sand active:text-accent"
      onPointerDown={down}
      onPointerUp={() => onHold(control, false)}
      onPointerCancel={() => onHold(control, false)}
      onLostPointerCapture={() => onHold(control, false)}
      onContextMenu={(event) => event.preventDefault()}
    >
      {glyph}
    </button>
  );
}
