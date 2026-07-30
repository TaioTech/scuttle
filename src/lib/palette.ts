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

  /**
   * The sea, and the wet line where it meets the sand.
   *
   * The only cool colour on a beach made entirely of warm ones, so the end of
   * the run is legible from as far up the beach as it can be seen. A player who
   * cannot tell how much is left cannot decide whether to take a risk.
   */
  sea: "#123240",
  seaFoam: "#3d6d78",
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

  /**
   * Towels, and the stripes and sunbathers on them.
   *
   * Three tones rather than one so a blocker reads as an object with parts.
   * They stay close together on purpose: a towel that competes with a walker
   * for attention costs the player the only judgement that matters, which is
   * which lane the bright thing is in.
   */
  stillStripe: "#94897d",
  stillBody: "#a2988c",

  /** Beachgoers: the darker legs beneath, the lit head above. */
  driftLeg: "#6e6e78",
  driftHead: "#c4c4cc",
  /**
   * The mass a group of beachgoers occupies, drawn under the figures.
   *
   * Load-bearing rather than decorative, and the reason this treatment is not
   * simply prettier figures on sand. A hazard kills across its whole width, but
   * separate figures show daylight between them and a player reads that
   * daylight as a gap to cross. A first attempt used a subtle shadow and it
   * was invisible against sand this dark, which is worse than useless: it
   * looked considered while telling the player nothing.
   *
   * So the extent is stated plainly. This spans the collision box exactly and
   * the figures sit on top of it — dim enough that the walkers still carry the
   * lane's character, bright enough that the box is never in doubt.
   */
  driftMass: "#3f3f46",

  /** The crab, standing. */
  crab: "#f97316",
  /** The crab, mid-step and unable to do anything about it. */
  crabStepping: "#fdba74",
  /**
   * The crab's legs, claws and eyestalks, and the lit top of its shell.
   *
   * Precomputed rather than derived from {@link PALETTE.crab} at draw time.
   * Colour arithmetic sixty times a second to produce two fixed values is cost
   * for nothing, and a literal is a thing a tuning pass can actually see.
   */
  crabLimb: "#c2410c",
  crabShell: "#fb923c",
  /** The same two, for the lighter crab of a committed step. */
  crabSteppingLimb: "#f97316",
  crabSteppingShell: "#fed7aa",
} as const;
