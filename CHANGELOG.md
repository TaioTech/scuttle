# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

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
