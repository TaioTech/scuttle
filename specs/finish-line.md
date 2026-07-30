# Scuttle: the finish line

> **Status**: Draft
> **Extends**: [`scuttle.md`](scuttle.md) — settles its Open Question #3
> **Date**: 2026-07-29

## Summary

Scuttle currently has no end. `laneAt` is defined for every row, so the beach
runs on forever and the only possible result is how far you got before you died.
That was correct for a movement prototype and it is wrong for a game: a daily
that cannot be finished has no shared moment in it, because nobody ever arrives
anywhere.

This gives the beach a length. The crab starts on the promenade, crosses the dry
sand, the tide line and the surf, and reaches the sea. Reaching it is winning,
and it ends the day's run. The score becomes how long it took, with shells
scattered through the dangerous lanes as an optional second thing to chase.

The parent spec already assumed most of this — Open Question #3 settles on the
sea being a win, and a collectible in the risky lanes is already in scope. What
is genuinely new here is the time-based score, and the decision that the beach
is a fixed length rather than a generated one.

---

## Scope

### In Scope

- **A beach of fixed length**, identical every day. The seed decides what is in
  the lanes; it does not decide how many there are.
- **A win.** Reaching the sea ends the run, successfully, and shows a time.
- **A time-based score**, measured in simulation ticks and displayed in seconds.
- **Shells**: optional pickups in the dangerous lanes, tracked as a separate
  count rather than folded into the time.
- **Two result shapes.** A run either ends in the sea with a time, or ends on
  the sand with a distance. Both are shareable.
- **The three bands** the parent spec describes: dry sand, the tide line, the
  surf. The surf carries rather than kills.

### Out of Scope

- **Levels.** Considered and rejected below.
- **A global board.** Deferred in [`shared-scores.md`](shared-scores.md).
- **Difficulty settings.** One beach a day, the same one for everybody, is the
  premise.

### Why not levels

Levels and a seeded daily pull in opposite directions. The daily's whole appeal
is that there is one beach today and everyone is on it — that is what makes a
time worth comparing and a result worth sharing. Splitting the run into levels
either means several seeded beaches a day, which dilutes the one shared thing
into several smaller ones, or it means a progression that persists across days,
which is a different game with a different reason to come back. A single beach
with three bands already gives the run a shape, an escalation, and an end.

---

## The board

The beach is a fixed number of rows, the same number every day, in four parts
from shore to sea:

- **The promenade.** Row zero and everything behind it, always safe. Where the
  crab starts and where the camera stops.
- **The dry sand.** The hazard band that exists today: walkers who drift and
  wrap, towels and sunbathers that do not move, a safe lane at a regular
  interval to break the rhythm. This is where the umbrellas, the frisbee and the
  dog belong when they arrive.
- **The tide line.** A band of wet sand that is safe to stand on — the breather
  before the last push. It narrows as the tide advances, which is the parent
  spec's escalation showing up as a change in the board's shape.
- **The surf.** Water. Waves do not kill; they carry the crab back toward shore.
  Crossing it is a timing problem against the gaps between sets, and it is the
  band where a run is most often lost by being pushed into something rather than
  by touching it.

The sea is the row past the last surf lane. Touching it wins.

Fixed length matters more than it looks. A generated length would make two days'
times incomparable and a personal best meaningless, and it would turn "did you
beat it" from a fact everyone shares into a question about which beach you got.

---

## Scoring

**The score is time, and time is ticks.** The simulation already counts them and
already refuses to read a clock; the timer is that count, started on the
player's first input rather than on load, so a slow first paint cannot cost
anyone a second. Seconds are a display concern — the renderer divides, the
simulation never does.

Starting on first input rather than on load matters for a second reason: it lets
a player look at the day's beach before committing to it, which is a real part
of a game about reading lanes.

**Shells are counted, not converted.** They sit in the lanes worth avoiding, so
taking one is a decision to spend time and risk on something optional. The
result reports them alongside the time — `41.2s · 6/9 shells` — rather than
folding them into it.

The alternative is to make each shell subtract a few seconds, producing a single
comparable number. It is tempting and I do not recommend it: the exchange rate
between a shell and a second is pure invention, it will be re-tuned forever, and
it collapses two legible axes into one number nobody can decompose. Two players
can already tell who was faster and who was thorough; making them argue about a
conversion rate adds nothing. This is recorded as an open question rather than
settled, because it is a taste call and it is reversible.

A failed run has no time. It reports the distance reached, as it does today.

---

## The tide, and why it should advance with time

The parent spec makes the tide the difficulty curve. There is a real choice in
what drives it, and it decides whether the time score has any teeth:

- **Driven by progress**, the board escalates as the crab moves up the beach. A
  cautious player can then stand on a safe lane indefinitely at no cost, and the
  only thing punishing them is the timer — which they may not care about.
- **Driven by time**, the board escalates as the run goes on. Standing still
  costs something concrete: the water is coming, and the safe strip you were
  planning to rest on is narrower than it was.

Time-driven is the better game and it is what this spec assumes. It gives the
clock stakes beyond the scoreboard, and it makes the surf crossing genuinely
urgent rather than merely fiddly.

It does not compromise determinism. Two devices given the same inputs on the
same day still produce the same run, tick for tick, because the tide is a
function of the tick count and nothing else. Two players who play *differently*
see different boards — but that is already true the moment one of them moves
left and the other moves right.

---

## Acceptance Criteria

1. The beach has a fixed number of rows, the same on every day of the year, and
   the seed changes only what occupies them.
2. Reaching the sea ends the run as a win and shows the time taken.
3. The timer counts simulation ticks, starts on the player's first input, and is
   converted to seconds only for display. Nothing in `lib/` reads a clock.
4. Two devices given the same day and the same input sequence produce the same
   finishing time, to the tick.
5. Shells appear only in lanes that carry a hazard, are optional in every case,
   and their number and placement come from the day's seed.
6. Collecting every shell is possible on every seed — a shell is never placed
   where it cannot be reached and left alive.
7. A failed run reports distance and no time; a won run reports time and shells.
   Both can be copied as a spoiler-free summary naming the day.
8. The tide advances as a function of the tick count, narrows the tide line, and
   extends the surf's reach up the beach.
9. A wave moves the crab toward shore and does not end the run.
10. A crab being carried by a wave cannot be killed. Hazards are inert for the
    duration of the push and for a short, tunable beat after it lands. This is
    what "carries rather than kills" has to mean to stay fair: without it the
    wave does not kill you, it simply arranges for the beach to do it, and the
    player experiences a death they had no input into. The immunity is visible —
    a carried crab reads as carried — so it is a rule the player can see rather
    than a leniency they have to infer.
11. The surf's visible extent equals its push zone exactly, the same rule every
    hazard's art follows. What you see is what acts on you, in every band, with
    no exceptions a player would have to learn.
12. The frame rate does not change any of the above. A device rendering at half
    the rate finishes the same run with the same time.

---

## Gotchas

- **The timer is the determinism invariant, restated.** The most natural way to
  write a stopwatch is the one thing this codebase forbids. It is a tick count
  that lives in the simulation state, and any use of `Date`, `performance.now`
  or a frame delta to measure it puts two devices on different clocks and makes
  a shared time meaningless. `AGENTS.md` already says nothing in `lib/` may read
  a clock; this is the feature most likely to tempt someone into it.

- **A fixed-length beach makes every lane load-bearing.** Today an unfair lane
  costs a player some distance. When the beach has an end and a time attached,
  the same lane costs them the day's run — and unlike now, they cannot simply
  try again. The crossability guarantee in `placeHazards` becomes more important
  than it already is, not less.

- **Shell placement needs its own reachability guarantee.** It is not enough
  that a lane is crossable: a shell sitting inside the only viable gap turns an
  optional pickup into a mandatory hazard, and a shell in a drift lane needs to
  be reachable at some phase of the cycle rather than in principle. This wants a
  test in the shape of the existing "holds every lane crossable across many
  days" test.

- **The surf inherits the swept-collision problem, and adds one.** Waves both
  move and move the player. Resolving a wave's push and a hazard's sweep in the
  wrong order lets a crab be pushed through something solid. The order has to be
  decided once, written down, and tested with a fast wave and a tight gap.

- **Time-driven escalation punishes hesitation, which is the point and also the
  risk.** If the tide advances too quickly the game stops being about reading
  lanes and starts being about rushing them, which is the opposite of what the
  committed forward step is for. Expect this to be the number that takes the
  longest to get right.

- **Changing the band lengths changes every past day.** The same warning that
  applies to `STILL_LANE_CHANCE` applies here, and harder: the number of rows in
  each band is now part of what a day *means*. Settle it before the first ship
  with a real result attached to it.

---

## Implementation notes

Sequenced so each step is playable and none of them requires the next one.

1. **End the beach.** Band lengths become constants; `laneAt` gains a sea row
   past the last one and returns it for anything beyond. Winning is the crab
   reaching that row. At this point the game is finishable and scored by nothing
   in particular, which is enough to find out whether the length feels right.
2. **Add the tick timer** to the simulation state, started on first input,
   stopped on the win. Display it. This is small and it is the thing that makes
   the length tunable, because now the beach has a duration and not just a size.
3. **Add the tide** as a function of the tick that shifts band boundaries. The
   tide line narrows; the surf reaches further.
4. **Add the surf band** with waves that carry. This is the largest single piece
   and it is the one with the collision ordering question in it.
5. **Add shells**, seeded per lane, with the reachability guarantee and its test.
6. **Rework the result screen** to handle both outcomes and produce the copyable
   summary.

Steps 1 and 2 together are enough to answer the question that prompted this —
whether the game is better with an end — and they are worth doing and playing
before committing to the rest.

---

## Open Questions

| # | Question | Context | Decision |
|---|----------|---------|----------|
| 1 | How long is the beach? | It has to be long enough that reaching the sea feels earned and short enough that one life does not make the whole thing miserable. Purely a tuning question, and it cannot be answered without playing it. | **Provisionally thirty-two lanes**, 2026-07-29, chosen to be played against rather than reasoned about. Expect to move it. It is one constant and moving it is free until a real result is attached to a day. |
| 2 | Do shells convert into time? | A single number is more comparable; two numbers are more legible and need no invented exchange rate. | **Decided: counted separately**, 2026-07-29. The result reads as a time and a shell count. The exchange rate between a shell and a second would be invention, would be re-tuned forever, and would collapse two legible axes into a number nobody can decompose. |
| 3 | Does the tide advance with time or with progress? | Decided in favour of time above, because it gives the clock stakes and punishes camping. | **Decided: time-driven**, 2026-07-29. Standing still costs something concrete, and the clock has stakes beyond the scoreboard. Determinism is unaffected — the tide is a function of the tick count. |
| 4 | Is the one-run-a-day limit enforced once there is something to beat? | The parent spec's Open Question #2 gets sharper here: a run you can lose in four seconds to a lane you misread is a harsher thing to ration than a distance score. | **Decided: not until the tide exists**, 2026-07-29. Enforcing it now makes every tuning pass a twenty-four hour feedback loop on a game whose difficulty curve is not built. It ships with the tide. |
| 5 | What does the shared summary look like for a loss? | A win has a time worth posting. A loss has a distance, and posting it is less appealing, which may matter for whether anyone shares at all. | **Decided: both outcomes share**, 2026-07-29. A loss reads as the day and the lane reached. With one life most runs are losses, and a share action that only appears on a win is one most players never see and cannot learn to expect. |
