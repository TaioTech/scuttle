/**
 * The colours the canvas draws with.
 *
 * These mirror the tokens in `globals.css` rather than reading them back out
 * of the document: a canvas cannot resolve a CSS custom property, and looking
 * them up on every frame to hand them straight back would be a lot of ceremony
 * for a palette that is fixed and dark-only anyway. The two lists are short and
 * they have to be edited together.
 */
export const PALETTE = {
  /** Behind everything, including the letterbox either side of the board. */
  background: "#09090b",

  /**
   * Dry sand: a lane with something in it, in two barely different tones.
   *
   * Consecutive hazard lanes alternate between them. Without that, three lanes
   * in a row read as one dark field with hazards scattered at various heights,
   * and the player cannot answer the only question that matters before a step:
   * which of those things is in the lane I am about to land in.
   */
  sand: ["#17130f", "#1e1813"] as [string, string],
  /** The strip between the hazard lanes, and the promenade the crab starts on. */
  safe: "#2a2119",
  /** The line between one lane and the next. */
  line: "#413021",

  /**
   * Towels and sunbathers.
   *
   * Warmer and calmer than the walkers, but not dimmer — a blocker that reads
   * as scenery is one the player walks into once and blames the game for.
   */
  still: "#7c7268",
  /** Beachgoers walking the sand. Brighter, because they are the timing. */
  drift: "#a1a1aa",

  /** The crab, standing. */
  crab: "#f97316",
  /** The crab, mid-step and unable to do anything about it. */
  crabStepping: "#fdba74",
} as const;
