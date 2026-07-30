# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

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

### Fixed

- The beach no longer vanishes from behind the result screen. The loop stops
  when a run ends, so any resize after that cleared the canvas — `measure`
  assigns to `canvas.width`, which wipes it — and nothing was left to draw the
  next frame. On a phone that fires when the URL bar collapses, not only on
  rotation. Resizing now repaints the final frame.

### Changed

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
