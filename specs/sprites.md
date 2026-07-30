# Scuttle: the art still owed

> **Status**: Draft
> **Extends**: [`scuttle.md`](scuttle.md) and [`finish-line.md`](finish-line.md) —
>   neither specifies how its hazards and bands should look
> **Date**: 2026-07-29

## Summary

Phase 1 shipped procedural canvas art for what phase 1 has: the crab, drifting
beachgoers, and static towels. Nothing is a sprite and nothing is a flat
rectangle — the crab is a rounded shell with legs that swing in proportion to
its actual speed, drifting hazards are a crowd of striding walkers on a dim
band that states their true width, and static blockers are striped towels with
a sunbather. That approach worked, and this spec is the same approach applied
to everything the parent specs describe but this repo has not built yet: an
umbrella that plants mid-run, a frisbee arcing across two lanes, a pursuing
dog, a seagull whose shadow has to arrive before it does, the tide line, the
surf, and shells.

None of this is built. This document is art direction and constraints, not an
implementation plan for the hazards themselves — the dog's pursuit rule, the
frisbee's exact path, and the tide's rate are gameplay decisions that belong to
`scuttle.md` and `finish-line.md`. What belongs here is what each of those
things has to look like once its mechanic exists, and the two rules that phase
1 learned the hard way and that every future hazard has to obey.

---

## Scope

### In Scope

- Art for the umbrella, the frisbee, the dog, and the seagull's shadow — the
  dry-sand hazards `scuttle.md` specifies and none of which exist yet.
- Art for the tide line and the surf, the two remaining bands from
  `finish-line.md`.
- Art for shells, distinguishable from every hazard at a glance, since one is
  a pickup and the rest are lethal.
- A fix to the sunbather, which already reads badly at playing size.
- The open question of authored pixel art as a future ceiling, recorded rather
  than decided.
- A note on the performance shape of drawing all of this procedurally.

### Out of Scope

- The mechanics behind any of these hazards — whether the dog gives up
  interest, how wide the frisbee's arc is, how fast the tide advances. Those
  are `scuttle.md` and `finish-line.md` questions; this spec assumes whatever
  they decide and asks only what the result should look like.
- Sound, per the parent spec.
- Actually migrating to authored pixel art. Considered below, not started.
- Anything about the crab, the walkers, or the towel's stripes — those are
  built and covered by the invariants below, not by new work.

---

## The two invariants everything here inherits

Phase 1 established these by shipping a bug and then fixing it, not by
reasoning about it in advance, so they are stated as constraints rather than
suggestions.

**Every animation phase is a function of the interpolated tick, and of
nothing else.** The walkers' stride, the crab's gait, and the lightening of a
stepping shell all read the tick that `drawFrame` already interpolates between
two simulated states. None of them keep a counter of their own. A renderer
that counts its own frames drifts out of step with a fixed-timestep
simulation the moment the two disagree about how much time has passed, and two
devices drawing the same tick have to draw the same frame or the "identical
for everyone" premise of a seeded daily stops being true the instant art is on
screen. An umbrella's plant, a frisbee's arc, a shadow's growth, a wave's
crest — all of it is `f(tick)`, not `f(time since I started drawing this)`.

**Art may never be narrower than the collision box it kills from.** This is
restated from `AGENTS.md` because it was not obvious in advance: an early pass
at the drifting hazard drew each walker as a separate figure, which looked
better and was a regression, because the daylight between two people is
daylight a player reads as a crossable gap. `PALETTE.driftMass` exists to
paint the box's true extent underneath the figures for exactly this reason,
and the crab's shell is a filled rounded rectangle rather than the inscribed
ellipse it visually wants to be, for the same reason in reverse — a corner
outside the ellipse but inside the box is a corner the player cannot see
themselves die to. Every hazard below has a moving or irregular shape
(a spinning frisbee, a lunging dog, a wave's foam) and every one of them has to
state its box the same honest way the walkers do, even where the box is not a
simple rectangle — a frisbee's arc, in particular, needs its ground shadow or
footprint to say plainly where it currently kills from, not just where it
currently looks like it is.

---

## Hazards without art yet

**The umbrella.** `scuttle.md` calls it a hazard that "plants itself into a
lane mid-run," which is a different kind of appearance than a towel: a towel
is already there when the lane comes on screen, an umbrella becomes there.
Whatever the mechanic decides about warning, the art has an obligation the
towel never had — a thing that was not lethal a moment ago and now is needs a
moment the player can see, not just a hazard that pops into existence between
one frame and the next. Treat the planting the way the seagull's shadow is
treated below: an event with duration, not an instant. Once planted, an
umbrella is presumably a static blocker like a towel and can likely share the
towel's rendering shape — a canopy instead of a stripe pattern, a pole instead
of a sunbather — but that is a suggestion, not a decision, and depends on
whether the mechanic gives it a footprint that moves.

**The frisbee.** It "arcs across two lanes at once," which means its
collision box is not confined to one row the way every hazard so far has been.
This is new territory for the renderer, which currently draws hazards per-lane
inside a single row's iteration. Whatever shape the arc mechanic takes, the
art needs to communicate which two lanes are currently live and — per the
second invariant — the full extent of what it currently kills from in both.
A spinning disc reads fine at small size; the harder problem is the shadow or
outline that has to carry the honest hitbox the way `driftMass` does, across a
shape that is airborne rather than lane-bound.

**The dog.** It pursues rather than following a fixed lane path, which the
crab does not currently have to compete with — every hazard on screen today
moves in one dimension the player can read at a glance and predict. A pursuer
needs the same legibility the crab's own stepping/standing states give the
player: which way is it about to go, has it committed to a direction, is it
about to change its mind. The crab communicates state through squash, tuck and
colour; the dog will need its own vocabulary for the same purpose, most likely
built the same way — legs that swing off the tick, a body that reads its
current heading rather than facing a fixed direction. What that vocabulary is
depends on the pursuit rule `scuttle.md` flags as still unsettled, so this is
a direction rather than a design.

**The seagull's shadow.** `scuttle.md` is explicit that this is "announced by
a shadow that grows on the sand before the bird arrives," and calls it a
hazard that "can be read and avoided rather than merely reacted to." That
makes the shadow's growth a fairness constraint as much as an art one: if it
grows too fast, or is too dim against a sand this dark to register, the
telegraph is theatre rather than a warning, and the invariant that all art
derives from the tick means the growth rate has to be tunable the same way
`WALKER_GAIT_TICKS` is — a named constant, not a felt number baked into a
draw call. The shadow's shape and edge darkness should read as a single
unambiguous "this patch of sand is about to be hit," using the same
plain-extent-over-decoration lesson `driftMass` already paid for: a soft,
falling-off shadow is prettier and worse, because a player has to be able to
tell where the edge of it actually is under time pressure. Whether the bird
itself needs art before it lands, or whether the shadow alone carries the
whole telegraph, is open — see below.

---

## Bands without art yet

**The tide line.** `finish-line.md` describes it as wet sand, safe to stand
on, narrowing as the tide advances. It needs a colour and texture distinct
from both the dry sand it borders and the surf it borders on the other side —
currently `PALETTE.sand` alternates two close browns and `PALETTE.safe` is a
third, warmer tone used for the promenade and the rhythm-breaking safe lanes;
the tide line needs its own identity rather than reusing `safe`, since a
narrowing band the player is meant to notice shrinking should not share a
colour with a band that never moves. Because the tide is `f(tick)`, the
narrowing itself is just the existing per-row band lookup returning a
different lane kind as the boundary shifts — no new animation model, just a
new palette entry and a lane kind to draw.

**The surf.** Water that carries rather than kills, per `finish-line.md`, and
the band where a run is most often lost by being pushed into something rather
than by touching it. Waves need to communicate two things at once: where the
water currently is (which pushes) and where the gaps between sets are (which
are safe to be caught standing in) — this is the "timing problem" the parent
spec names directly, and the art's whole job is making that timing readable.
A moving foam line with a visible leading edge is the obvious shape; the
harder question, shared with the frisbee, is whether the surf's visual
extent has to equal its push zone at every point along a wave's crest the same
way `driftMass` equals the drift hazard's box, or whether a softer edge is
tolerable here because contact costs distance rather than the run. That is a
fairness question as much as an art one and is listed below as open.

---

## Shells

`scuttle.md` and `finish-line.md` both specify shells as an optional pickup
in the risky lanes, and `finish-line.md` is specific that taking one is a
choice to spend time and risk on something that is not required. The single
hard requirement is that a shell must never be mistakable for a hazard at a
glance, in the same instant a player is deciding whether to step into a lane —
this is a harder bar than "looks different," because everything on the dry
sand so far reads in muted, warm-to-grey tones (`still`, `drift`, `driftLeg`,
`stillStripe`) deliberately close to each other so a blocker and a walker do
not fight for attention. A shell needs to sit outside that family entirely —
brighter, or a different hue altogether, the way the crab's orange already
sits outside it — rather than being a slightly different shade of the same
palette. A simple spiral or fan shape at a size well inside a hazard's height
should read as an object rather than a figure, which is itself part of how it
avoids being confused with a person or a towel corner.

---

## The sunbather is a known rough edge

`drawTowel` in `render.ts` draws a torso as a wide ellipse and a head as a
circle overlapping its edge. At the scale hazards are actually drawn on a
phone screen, the two shapes read as one body with a bulge at one end rather
than a person lying down — closer to a fish than a sunbather. This was not
caught before phase 1 shipped because it is legible enough not to be confused
for a hazard box, which was the bar phase 1 was tuning to; it is not legible
enough to be a person, which is the bar this phase should meet. Worth fixing
alongside whatever else touches `drawTowel` for the umbrella above, since the
umbrella is likely to reuse this function's shape.

---

## Authored pixel art: deferred, not rejected

`scuttle.md` puts "sprite art or an artist" out of scope for phase 1 and says
plainly that whether the game needs real art is a question to answer once it
is fun, not before. Procedural canvas art was chosen for phase 1 because it
needed no artist and no asset pipeline, and it has now been proven out well
enough to extend to everything above with the same technique. It was never
argued to be the better-looking option — authored sprites are very likely the
better ceiling, at the cost of needing an artist and an asset pipeline neither
of which is a technical decision. That trade is unresolved on purpose: nothing
above requires committing to it, because every hazard and band here can be
built procedurally first and re-skinned later if the game earns the
investment. Recorded here so a future session does not read the absence of a
decision as an oversight.

---

## Performance

Every hazard on screen is drawn from scratch every frame, at up to 3x device
pixel ratio (`Game.tsx` clamps higher ratios for exactly this reason). Cost
today scales with the number of hazards in the visible lanes, which is small
and bounded by `DRIFT_COUNT` and `STILL_COUNT`. Adding a frisbee that spans two
lanes, a dog that is drawn regardless of which lane it currently occupies, and
a seagull shadow that persists across several rows all add to that per-frame
total, and none of them are free the way a static rectangle would have been.
This is worth watching once the new hazards exist and worth measuring on a
real phone rather than a dev machine, not worth pre-optimising against now —
phase 1's canvas cost has not been a problem, and speculative batching or
caching before there is a frame budget to defend against would be solving a
problem that may not arrive.

---

## Acceptance Criteria

1. The umbrella has a distinct planting moment on screen, not an instantaneous
   appearance, whatever the mechanic decides its warning should be.
2. The frisbee's rendered extent states which two lanes are currently live and
   the box it currently kills from in both, at every point along its arc.
3. The dog's art communicates its current heading and, if the mechanic gives
   it one, whether it is currently committed to a direction.
4. The seagull's shadow has a named, tunable growth rate and reads clearly
   enough against `PALETTE.sand` that a player can judge its edge under time
   pressure, not merely notice that something is growing.
5. The tide line and the surf each have their own palette identity, distinct
   from `safe`, `sand`, and each other.
6. A shell is visually distinguishable from every hazard at a glance, using a
   colour and shape outside the existing hazard palette family.
7. `drawTowel`'s sunbather reads as a person lying down at the size hazards are
   actually drawn on a phone screen.
8. Every new animation phase — umbrella plant, frisbee spin, dog gait, shadow
   growth, wave crest — is a pure function of the interpolated tick, with no
   renderer-local counter and no read of the wall clock.
9. Every new hazard's rendered extent is never narrower than its collision
   box, restated per hazard the way `driftMass` restates it for the drift
   lane.
10. None of the above changes what any existing hazard looks like or how it
    is generated — this phase is additive art for things that do not draw yet.

---

## Gotchas

- **The frisbee and the dog break the one-hazard-one-lane assumption
  `drawFrame` currently makes.** The render loop iterates lanes and draws each
  lane's hazards inside that row's slice of the loop. A hazard that spans two
  lanes or moves between them needs to be drawn without becoming visually
  attached to only one of them — this is a structural change to how `drawFrame`
  walks the board, not just a new draw function, and it is worth settling
  before either hazard's art is started rather than discovering it mid-way.

  **Settled on 2026-07-30: two passes, and a second kind of hazard.** The board
  is drawn in one pass exactly as before — floors, rules, shells and the
  hazards that belong to a row. Anything not lane-bound is a *roamer*, carries
  its own position in continuous board coordinates rather than a row index, and
  is drawn in a second pass after every lane and before the crab. Roamers are
  therefore never clipped to a row's slice and never inherit a lane's identity,
  which is what lets a frisbee be honestly half in one lane and half in the
  next. The two passes also give the draw order the game needs for free: a
  thing in the air is drawn over the sand it is about to land on, and the crab
  is drawn over everything, so the player never loses track of themselves.
- **The seagull's shadow is the one place art and fairness are the same
  question.** A shadow that looks better by growing subtly is a worse warning,
  the same trade `driftMass` already lost once to a "prettier and wrong"
  first draft. Do not let a visual polish pass quietly erode the lead time
  acceptance criterion in `scuttle.md`.
- **Shell placement and shell art are different problems that will get
  confused.** `finish-line.md` already flags that a shell must be reachable
  wherever it is seeded — that is a placement and reachability question for
  `board.ts`, not for this spec. This document only owns what a shell looks
  like once it exists somewhere reachable.
- **Reusing `drawTowel`'s shape for the umbrella inherits its current bug.**
  Fix the sunbather before building the umbrella on top of the same function,
  or the fix has to happen twice.

---

## Open Questions

| # | Question | Context | Decision |
|---|----------|---------|----------|
| 1 | Does the umbrella's planting moment need its own telegraph, the way the seagull's shadow does, or is an instant appearance with a short grace period enough? | Both are "something becomes lethal that was not," but the parent spec only demands a telegraph for the overhead threat by name. | Pending — depends on how forgiving the plant mechanic is meant to be |
| 2 | Does the surf's visual extent have to equal its push zone exactly, the way `driftMass` equals the drift hazard's box? | Contact with a wave costs distance, not the run, which is a materially different stake than every other hazard's box. A softer edge may be honest enough where the consequence is softer. | **Decided: exact**, 2026-07-29. One rule across the whole game — what you see is what acts on you. Water loses some softness, and in exchange no player ever has to learn that one band lies slightly and the others do not. |
| 3 | Does the seagull itself need art before it lands, or does the shadow alone carry the whole telegraph? | The parent spec names the shadow specifically; it does not say whether the bird is seen arriving. | Pending |
| 4 | Should the umbrella and towel share a draw function, or diverge once the umbrella's planting behaviour is known? | They look likely to share a shape today, but the planting animation may pull them apart enough that a shared function fights both callers. | Pending — revisit once the umbrella's mechanic exists |
| 5 | Is procedural art the permanent direction, or the first phase of a migration to authored pixel art? | `scuttle.md` puts this out of scope until the game is known to be fun. Procedural has now been proven out twice (crab, walkers) and costs no artist. | Deferred, per `scuttle.md`. Not reopened by this spec. |
| 6 | Does the pursuing hazard ship at all? | `scuttle.md` AC #3 asks for "a hazard that pursues the player rather than following a fixed lane path". Built once and pulled on 2026-07-30. | **Deferred**, 2026-07-30. It is the only hazard that needs persistent state in `SimState` — the frisbee and the seagull are closed forms of the run's clock and cost the simulation nothing. It also raised a fairness question the others do not: a pursuer sharing a row with walkers is double jeopardy that `placeHazards` cannot account for, since the crossability guarantee only knows what is *in* a lane. Snapping it to a safe lane answers that and is a real design (the breather stops being free), so this is a scope call rather than a dead end. AC #3 is unmet until it lands. |
