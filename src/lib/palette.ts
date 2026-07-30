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
  sea: "#0b2734",
  seaFoam: "#4d8794",
  /** The line between one lane and the next. */
  line: "#413021",

  /**
   * The tide line: wet sand between the dry beach and the surf.
   *
   * Sand that has been under water, so it reads as a cooler, darker version of
   * the safe strip rather than as a third kind of thing. It has to be legible as
   * somewhere to stand at a glance, because it is the last rest before the water
   * and the tide is in the business of taking it away.
   *
   * Two tones alternating by row, for the same reason {@link PALETTE.sand} has
   * them: this band can be six lanes deep, and six identical lanes read as one
   * slab. A player who cannot count the rows left cannot decide whether to
   * spend a wave cycle waiting, which is the whole decision the tide line
   * exists to pose. A hairline rule was tried first and was invisible at the
   * one device pixel it gets.
   */
  tideLine: ["#1f2126", "#272a30"] as [string, string],

  /**
   * The rule between two wet lanes, and between two surf lanes.
   *
   * The sand's warm brown rule is invisible against either, and a band without
   * rules is a slab rather than a set of lanes. The tide line can be six lanes
   * deep, and a player who cannot count them cannot plan a crossing — they can
   * only guess how much beach is left, which is the one thing the fixed-length
   * board exists to stop being a guess.
   */
  waterLine: "#39404a",

  /**
   * The surf: calm between sets, and the water of a breaking wave.
   *
   * `surfWash` states the push zone exactly, the same rule every hazard's art
   * follows — the lane is drawn washed for precisely the ticks it will carry a
   * crab, edge to edge, with no lip of foam extending past the effect or any
   * part of the effect left undrawn. A wave you can see is a wave you can time.
   *
   * Calm surf is deliberately a good deal lighter than {@link PALETTE.sea}. The
   * two started close enough to be indistinguishable, which put the finish line
   * somewhere the player had to infer: a run is won by reaching the water, and
   * being unsure which water is the winning one is the worst possible thing to
   * be unsure about with the whole run behind you.
   */
  surf: "#1c4552",
  surfWash: "#4a8494",
  surfCrest: "#8fc4cf",

  /**
   * A crab that a wave has hold of, and cannot be killed.
   *
   * Pale and cool rather than orange: the immunity is a rule the player is meant
   * to be able to see rather than one they have to infer from surviving
   * something that looked fatal.
   */
  crabCarried: "#bfe3ea",
  crabCarriedLimb: "#7fb3c1",
  crabCarriedShell: "#e8f6f9",

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

  /**
   * A shell worth going out of the way for.
   *
   * Deliberately outside the family every hazard is drawn from. The walkers and
   * towels are muted greys and tans on purpose, so that the only bright thing
   * on the beach is the crab and the player always knows where they are. A
   * shell is allowed to be the second bright thing because it is the only other
   * thing they are ever asked to aim at — but it is pink rather than orange, so
   * a glance can never mistake it for the crab.
   */
  shell: "#fbcfe8",
  shellRidge: "#f472b6",

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
