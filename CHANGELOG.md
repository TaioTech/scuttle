# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Reporting to the TaioTech hub's player-profile ledger, making Scuttle its
  first consumer. When a run resolves, the day's best — lanes crossed, the
  crossing time when the sea was reached, and the shells picked up — is sent to
  the hub, where the shells go on a profile spanning every game in the arcade. The
  contract is the hub's `docs/PROFILE_INTEGRATION.md` and is linked to rather
  than restated, because a contract copied into four repos drifts in four
  directions.
- A per-day best, kept separately from the personal best on the device. The
  local record is a lifetime high-water mark and the ledger wants the day's, and
  submitting the former would attribute shells to days they were not found on
  and inflate a profile total that sums across days. Submitting the day's own best
  is also what makes a duplicate or retried submission harmless by construction
  rather than by bookkeeping.
- A queue for submissions that could not be sent, retried when the game is next
  opened. Play never waits on the ledger and a failure is silent to the player
  mid-run: with the service genuinely unreachable a run plays start to finish
  unchanged, and what could not be sent is not lost from the device either.

- This repository. Phase 1 was built inside the TaioTech hub repository at
  `scuttle/` because this one did not exist yet; it now lives here with that
  history intact, and deploys to scuttle.taiotech.com.
- Phase 1 of the game: sideways-biased movement, one band of seeded dry-sand
  lanes, and three buttons. Enough to find out whether the asymmetry is fun,
  and deliberately nothing else — see the spec for what is still missing.
- A fixed-timestep simulation decoupled from rendering. `stepSim` advances
  exactly one tick and takes no frame delta, so a device that renders at half
  the rate plays the same run; the renderer interpolates between the last two
  ticks so a faster screen still looks smooth. Taken as a day-one decision
  because retrofitting it means rewriting the loop.
- Swept collision along the whole path of a committed forward step, rather than
  a test at its destination. Checking the endpoint alone lets a fast hazard pass
  clean through a stepping crab, which a player experiences as being hit by
  nothing.
- Seeded lane generation from the local calendar date, with every gap given its
  minimum width before any surplus is shared out — so an uncrossable lane is not
  something a seed is able to produce. Hazard positions are a closed form of the
  tick rather than an accumulation, so a long run cannot drift out of true.
- Three full-height controls across the bottom of the screen, playable
  one-thumbed. Forward is edge-triggered inside the simulation rather than
  trusted to the input layer, so holding it crosses one lane and not the beach.
- Sixty-one tests covering the seeded generation, the movement rules, the swept
  collision, and frame-rate independence.

- The beach has an end. It is thirty-two lanes on every day of the year — only
  what is in them varies — and the row past the last one is the sea. Reaching
  it wins and ends the run. `laneAt` answers `sea` for everything beyond the
  shoreline, so a crab that overshoots is in the water rather than off the end
  of a beach that stopped being generated.
- A clock, counted in simulation ticks and started on the player's first input
  rather than on load. Ticks because the simulation is forbidden a clock and
  because a time measured in anything else is a time two devices can disagree
  about; started on first input so a slow first paint costs nobody a second,
  and so the day's beach can be read before it is committed to.
- A result that knows which kind of ending it was: a time for a run that
  reached the sea, a distance for one that ended on the sand.
- Thirty-two lanes is a first guess and is meant to be moved. It is the run's
  length, and a run's length cannot be reasoned about, only played.
- A short vibration the instant a forward step commits. The game is about a
  decision that cannot be taken back, and on a phone a physical thump says so
  more directly than the colour change does. Fired when the step begins rather
  than when the button was pressed, because the press may have been buffered
  and what the player is being told is that control has just left them. Safari
  on iOS does not implement the Vibration API, so on an iPhone this is nothing
  happening.
- A personal best kept on the device: fewest ticks to the sea, and the furthest
  lane ever reached. Comparable across days only because the beach is a fixed
  length. The rules for what counts as a record are pure and tested; the
  storage is an external store read through `useSyncExternalStore`, like the
  calendar date and for the same reason — the page is prerendered and the
  record does not exist on the server. A record that is missing, corrupt, or
  written by an older build is discarded rather than trusted, and a browser
  that refuses storage costs the player their record and never their game.
- `CLAUDE.md`, importing `AGENTS.md` rather than restating it. Claude Code does
  not read `AGENTS.md` on its own, so without this none of the architecture
  rules or gotchas reached the agent working in the repo.
- `.claude/launch.json`, so the dev server can be started and the game driven in
  a browser for the visible-surface half of the definition of done.
- `specs/finish-line.md`, which gives the beach an end. The prototype played
  well enough that its endlessness became the thing wrong with it, so the spec
  settles the parent's Open Question #3: a fixed-length beach, the sea as a win,
  time as the score, and shells as an optional second axis.
- `specs/sprites.md`, the art still owed: the umbrella, the frisbee, the dog,
  the seagull's shadow, the tide line, the surf and shells. It carries forward
  the two rules phase 1 learned by breaking them — animation derives from the
  tick, and art never states less than the box it kills from — and records the
  migration to authored pixel art as deferred rather than rejected.
- `specs/shared-scores.md`, recording a persistent cross-app score service as a
  deliberately deferred idea rather than letting it quietly not happen. It
  reverses the no-backend decision and needs identity and anti-cheat to be worth
  having, neither of which is warranted by one game.
- An opening ramp on the beach. Every row used to be generated by identical
  rules, so the second lane of a run was drawn from the same distribution as the
  twenty-ninth — and because a player meets the opening on every single run and
  the far end of the beach perhaps once, an ordinary lane placed at row two read
  as a brutal one. `laneStrength` now interpolates a lane's ceilings from
  nothing at the first lane to full by `RAMP_LANES`, lowering hazard count,
  drift speed and hazard width. Fewer hazards is the lever that matters: the
  layout hands every gap its minimum and shares the surplus among however many
  gaps there are, so dropping a lane from three hazards to two widens every
  remaining gap considerably. It raises no floors, so a ramped lane is drawn
  from a strict subset of what that row could otherwise have produced and no
  seed can make an early lane harder than a late one. The beach past the ramp
  is bit-identical to what it was.
- The tide, and with it the beach's three bands. The dry sand is unchanged; past
  it lies the tide line — wet sand, safe to stand on — and past that the surf.
  The tide advances as a function of the run's clock, moving the water's leading
  edge from three lanes out to nine and narrowing the tide line to nothing. It
  is not a speed multiplier and nothing gets faster: the escalation is the board
  changing shape, so a fast run gets a breather before the last push and a slow
  one arrives at the water with nowhere left to rest.
- The surf, which carries rather than kills. A surf lane washes on a cycle,
  lanes nearer the sea breaking first so a set reads as a wave running
  shoreward, and a wave takes a crab standing in it one lane back toward shore.
  The washed rectangle is exactly the push zone, drawn from the same predicate
  that does the pushing. A carried crab is immune for the whole ride and a beat
  past it, and is drawn pale so the immunity is a rule the player can see rather
  than one they infer from surviving something that looked fatal.
- Shells: seeded, optional pickups lying in the lanes worth avoiding, counted
  separately from the time rather than converted into it. The reachability
  guarantee AC #6 asks for is structural, like the crossability one. A drifting
  lane's hazards sweep the whole board, so every point on it is under a gap at
  some phase and any position is reachable; a still lane's never move, so its
  shell is placed inside one of the lane's actual gaps, offset from that gap's
  centre by a *fraction of the room available* rather than a fixed distance —
  which is what makes it impossible for the offset to bury the shell however
  narrow the gap. Dead centre would put a shell exactly where a player crossing
  that gap already stands, and a pickup costing nothing is not an optional risk.
  Drawn pink: outside the muted family every hazard uses, and not the crab's
  orange, so a glance can never confuse the two. Collected shells are a bitmask
  per row rather than a running total, because a wave can carry the crab back
  over ground it has already taken and a shell must not be worth two.
- A result that handles both outcomes and a share that works for either. A win
  copies a time, a loss copies the lane it ended on, and neither says anything
  about what was in the lanes — a summary that leaked the beach would make
  sharing it an unkindness. A loss shares because with one life most runs are
  losses, and a share action that only appears on a win is one most players
  never see and never learn to expect. The clipboard is tried first and the
  phone's share sheet is the fallback, and a dismissed sheet is not an error
  worth reporting.
- A streak, kept beside the personal best: consecutive days the sea was
  reached. Stored with the day it was last true, because a streak is not a
  number — a count with no date cannot be told from a stale one, and a run of
  three that ended a month ago would go on claiming to be three. It does not
  grow twice in one day, since retries are unlimited and a streak that could be
  farmed in an afternoon would mean nothing. A loss does not break it, for the
  same reason: a player who dies at lane four and wins on the next go has still
  reached the sea today.
- A live shell count in the header, next to the day.
- The build's commit stamped into the corner of the page. A preview URL, a
  production domain and a dev server all look identical, so "it still looks like
  the old version" is indistinguishable from a stale cache, a protected preview,
  or a branch that was never merged. Vercel's commit variable is used where it
  exists and `git` answers locally; if both fail the build still succeeds with
  `dev`, because a missing stamp must never be the reason a deploy does not go
  out.
- The umbrella, which plants itself into a still lane partway through a run and
  is visibly arriving before it is lethal. It is a flag on a hazard rather than
  a hazard that appears, which is what keeps the crossability guarantee intact:
  the lane is laid out once with every hazard present and every gap at its
  minimum, so an umbrella that has not planted only ever makes a lane wider
  than the guarantee requires. No seed and no moment can produce a lane that
  cannot be crossed.
- The frisbee, which arcs across two lanes at once and is aimed at the band the
  crab was in when it was let go. A frisbee thrown to a seeded row is a hazard
  most runs never meet — the beach is thirty-two lanes and eleven are ever on
  screen — and aiming it stays fair because it crosses in sideways from off the
  board: it is seen coming and dodged by moving, never by having guessed right.
  Its box is drawn around the disc, because the spin makes the disc look
  thinner than it kills from twice a cycle.
- The seagull, announced by a hard-edged patch of shadow that grows on the sand
  before the bird arrives. It locks onto where the crab is standing and then
  that patch is fixed — a shadow that kept following would be a warning about
  something there is no getting out of the way of. The patch is harmless for
  every tick of the warning; only the bird kills. The lead time is a named
  constant with a test measuring it against what the crab can actually do, so a
  later polish pass cannot quietly shorten the warning.
- `roamers.ts`, for hazards that belong to no lane, and a second render pass for
  them. `drawFrame` draws the board exactly as before and then draws roamers in
  continuous board coordinates, so a frisbee is honestly half in one lane and
  half in the next instead of being clipped into whichever row happened to draw
  it, and the crab is still drawn over everything.
- `hasHazards`, asked instead of enumerating the lane kinds that have none. The
  beach went from three kinds to six in one change and every site that had
  spelled out the empty ones was a site that would have silently begun treating
  the surf as solid ground.

### Fixed

- The tide advances on the run's clock rather than on the tick, so a player who
  studies the day's beach before starting is no longer charged a slice of the
  escalation for looking. The timer already waited for the first input for
  exactly that reason; the tide was not waiting with it, and twenty seconds of
  reading silently spent a quarter of the tide. Hazards and waves still move on
  the tick, because a board frozen until first input is one whose rhythms cannot
  be read at all.
- The shoreline foam is drawn on the last row before the sea rather than the
  first row of it. Every lane draws its own upper rule, so asking the sea to
  draw the shoreline put the foam a whole lane out to sea from the line it was
  naming. Invisible while the last beach row was pale sand, and wrong the moment
  the surf arrived — the one thing that mark has to be unambiguous about is
  where winning starts.
- The sea and calm surf are no longer nearly the same colour, and the tide line
  is drawn in two alternating tones like the dry sand. A six-lane band in one
  flat tone reads as a slab rather than as lanes, and a player who cannot count
  the rows left cannot decide whether to spend a wave cycle waiting.

- The beach no longer vanishes from behind the result screen. The loop stops
  when a run ends, so any resize after that cleared the canvas — `measure`
  assigns to `canvas.width`, which wipes it — and nothing was left to draw the
  next frame. On a phone that fires when the URL bar collapses, not only on
  rotation. Resizing now repaints the final frame.

### Removed

- The frisbee, pulled after its first real playthrough. It was aimed at the
  lane the crab was standing in and re-aimed at wherever the player had got to
  every nine seconds, which played exactly as it reads: it chased. Measured over
  four hundred seeds, sixty-seven per cent of throws covered the lane the crab
  stood in and sixty-nine per cent covered the lane it had to step into, and the
  pair it covered was never more than one lane away. It crosses at fifty-six
  board units a second against the crab's forty-six, so there is no outrunning
  it sideways, and the crab cannot step backwards — the only escape was forward,
  through the second lane it also covered.

  That is the dog's specified behaviour rather than the frisbee's, acquired
  without the readability rule the spec demands of a pursuer. Aiming it was a
  real answer to a real problem, which is why this is a removal and not a
  tuning pass: a frisbee thrown at a seeded row is a hazard most runs never
  meet, since only eleven of thirty-two lanes are ever on screen. Both pursuing
  hazards are now one deferred decision, to be answered together under a rule
  that makes a pursuer readable. The seagull is unaffected and remains the only
  roamer; `stepSim` and `roamersOf` no longer take the day's seed, since the
  frisbee was the only thing that wanted it.

### Changed

- `AGENTS.md` and `README.md` no longer describe this repo as having nothing
  behind it. Its own local storage remains the source of truth for its own
  screens — nothing here reads back from the hub — but it is no longer purely
  local-first, and orientation that says otherwise sends the next session down
  the wrong path.
- `specs/shared-scores.md` marked superseded and pointed at the hub's
  `specs/player-profile.md`, rather than continuing to describe a shared score
  service as deferred when one exists and this game writes to it.
- The crab's claws straddle the edge of its shell rather than being held well
  outboard of it. They were solid mass two and a half board units past the box
  on each side, which made the crab read some forty per cent wider than the
  width it dies at, so every gap looked tighter than it was. Tucking them wholly
  inside was tried first and was worse in the way that matters — it turned the
  crab into a rounded rectangle, and the pincers are most of what makes it a
  crab rather than a token. Straddling costs a fraction of a body width of
  overhang and buys the silhouette back. The collision box is unchanged; it was
  never the thing that grew.
- The sunbather on a towel reads as a person rather than a fish. It was a wide
  ellipse with a circle overlapping its edge, which at the size hazards are
  actually drawn came out as one body with a bulge at one end. What was missing
  was not detail but joints: a neck's worth of gap, shoulders wider than the
  waist, and legs that end somewhere.
- Hazards and the crab are drawn as figures rather than flat rectangles.
  Beachgoers are a crowd that strides, blockers are striped towels with someone
  lying on them, and the crab has legs that swing with how fast it is actually
  moving, claws, and eyestalks. Every animation phase is derived from the tick,
  so two devices drawing the same tick draw the same frame.
- A drifting hazard is drawn on a dim band spanning its collision box. Separate
  figures show daylight between them and a player reads that daylight as a gap
  to cross, which the flat rectangle never let them do — the art got prettier
  and, for one revision, less honest. The band puts the true extent back.
- `engines.node` is now `>=24`, matching `.nvmrc` and what CI actually runs. It
  previously read `>=20.9`, which is Next's own floor rather than this project's
  target, so a contributor on Node 20 got no warning that they were building on
  something CI never exercises.
- Eight open questions across the three specs are now decisions, taken
  2026-07-29 so the session that builds this inherits decisions rather than
  questions: no backward step, one run a day only once the tide exists, shells
  counted separately and carrying no mechanical advantage, a time-driven tide, a
  crab that cannot be killed while a wave is carrying it, sharing on both
  outcomes, and a surf whose visible extent equals its push zone.
- The spec no longer contradicts itself about backward movement. Scope demanded
  three buttons and Implementation Steps offered a fourth direction; the three
  buttons won.

### Notes

- `MIN_GAP.drift` is derived from the step duration and the fastest lane speed,
  not from the crab's width. A first pass sized it to the crab and produced
  lanes that looked passable and arithmetically were not: the step cannot be
  steered, so the gap slides on underneath a crab that cannot follow it.
- Difficulty is deliberately flat. The spec is explicit that escalation should
  read as the tide advancing rather than as a speed multiplier, and there is no
  tide yet.
- The one-run-a-day limit is not enforced. It is the right call for the shipping
  build and the wrong one for a prototype that exists to be tuned.
