# Scuttle

> **Status**: Largely built as of 2026-07-31. Outstanding: the two pursuing
>   hazards (the dog, and the frisbee — built, played and pulled; see
>   [`sprites.md`](sprites.md) questions 6 and 7) and the one-run-a-day limit,
>   deliberately unenforced while the game is still being tuned.
> **Dependencies**: none outstanding. This was written expecting
>   `TaioTech/app-template`, which still does not exist — the scaffolding was
>   copied from the hub's conventions instead, and nothing here waits on it.
> **Date**: 2026-07-29

## Summary

Scuttle is a lane-crossing arcade game for the phone: a crab crossing a beach,
from the dry sand where the people are, down through the tide line, and into the
surf. It is Frogger's shape with one mechanic changed — crabs walk sideways, so
moving across the beach is fast and fluid while moving down it is slow and
committed.

Like Chroma it runs one seeded round a day, identical for every player and
derived from the date, so it needs no backend. Unlike Chroma it is a game of
skill rather than a puzzle: the day's run is the same set of obstacles for
everyone, and what varies is how far you get.

It ships as its own repo and deployment. The hub gains one entry in
`src/lib/projects.ts` and nothing else.

---

## Scope

### In Scope

- **Sideways-biased movement.** Lateral movement is quick and effectively
  continuous; forward and back are slower, discrete, committed steps. This
  asymmetry is the game — it turns every lane into a choice between crossing at
  the nearest gap and sliding along the lane to a better entry point.
- **Three lane bands, shore to sea.** Dry sand carries the human hazards:
  sunbathers and towels as static blockers, umbrellas that plant themselves into
  a lane mid-run, a frisbee that arcs across two lanes at once, and a dog that
  tracks the player rather than staying in its lane. The tide line is wet sand —
  the safe strip. The surf is water: waves do not kill, they carry, pushing the
  player back toward shore, so the crossing is timed against the gaps between
  sets.
- **The tide as the difficulty curve.** The tide advances across the run: lanes
  shift up the beach, the safe strip narrows, and the surf reaches further in.
  Escalation comes from the board changing shape rather than from everything
  moving faster.
- **A telegraphed overhead threat.** Seagulls, announced by a shadow that grows
  on the sand before the bird arrives — a hazard that ignores lane structure in
  a game otherwise built entirely on it, and one that can be read and avoided
  rather than merely reacted to.
- **Three buttons.** Left, right, and forward. No swipes, no virtual stick, no
  diagonal. The control scheme mirrors the movement asymmetry: the two lateral
  controls are the ones held, the forward control is the one committed.
- **A collectible in the risky lanes** — shells, dropped food — giving a reason
  to cross where it is dangerous rather than always at the safest gap.
- **One seeded run per day.** The day's obstacle pattern derives from the date,
  identical on every device with no server involved. One life. The result is how
  far down the beach the player got, and it is shareable spoiler-free.
- **Phone-first and offline** after first load, on the shared TaioTech dark
  palette, with a link back to the hub. All inherited from the app template.

### Out of Scope

- **Any backend, account, or leaderboard.** Same reasoning as Chroma: a global
  ranking needs an identity and a server, which is what the seeded-daily design
  exists to avoid.
- **Practice mode and unlimited retries**, for the first ship. One run a day is
  what makes a shared distance mean anything. This is the likeliest thing to
  revisit after playtesting, and it is called out as an open question rather
  than settled.
- **Sound.** Not needed to find out whether the core is fun, and mobile web
  audio is a tuning cost of its own.
- **Sprite art or an artist.** The first build should reach playable on shapes
  and the shared palette. Whether it needs real art is a question to answer once
  it is fun, not before.
- **Anything in the hub repo** beyond the project index entry.

---

## Acceptance Criteria

1. Lateral movement is materially faster and finer-grained than forward or
   backward movement, and the difference is large enough that repositioning
   within a lane is a real tactic rather than a rounding error.
2. A forward step, once begun, completes — it cannot be cancelled mid-step. This
   is what makes committing to a gap a decision.
3. The dry-sand band presents at least: a static blocker, a hazard that crosses
   more than one lane at once, and a hazard that pursues the player rather than
   following a fixed lane path.
4. Contact with a surf wave moves the player back toward shore. It does not end
   the run.
5. The tide advances over the course of a run, and its advance changes the
   playable shape of the board — the safe strip narrows and the water reaches
   further up the beach.
6. Difficulty escalation is legible as the tide advancing, not as a global speed
   multiplier.
7. The overhead threat is announced on the sand before it can hit, with enough
   lead time that an alert player can move out of it.
8. The entire game is playable with three controls, one-thumbed, on a phone held
   in one hand. No input requires a swipe, a drag, or simultaneous presses.
9. The day's obstacle pattern is fully determined by the calendar day. Two
   devices playing on the same day, offline, face the same run.
10. A complete run is playable with the device offline after first load.
11. A run ends on a single failure. Once the day's run is over, the game shows
    the result and does not offer another until the day rolls over.
12. The result records how far the player got, and the player can copy a summary
    that names the day and that distance.
13. A streak and a personal best are kept on the device, and losing local
    storage costs them without ever blocking play.
14. Frame-rate variation between devices does not change the difficulty of a
    run — a slower device must not make the game easier or harder, only less
    smooth.
15. The hub's index lists Scuttle with a working link to its deployment, added
    by appending one object to the existing project list.

---

## Implementation Steps

### Movement

- Lateral input is held and produces smooth motion along the current lane.
  Forward input is a discrete committed step into the next lane. There is no
  backward: an earlier draft of this spec offered retreat as a slow, costly
  option, which contradicted the three-button scope above and AC #8 in the same
  document. Resolved on 2026-07-29 in favour of three buttons. A step you cannot
  take back is more committing when there is no retreat at all, and a misread
  lane costing the run is the game working rather than failing.
- The step being uninterruptible is what gives the game its tension. It also
  means collision has to be resolved against the step's whole path, not only its
  endpoint, or a fast hazard will pass through a stepping crab.

### The board and the tide

- Lanes are described as data — occupancy, direction, speed, spacing — so a
  day's run is a generated sequence of lane configurations rather than
  hand-placed obstacles.
- The tide is a single value that advances with progress and feeds back into
  lane layout. One number driving the board's shape keeps escalation coherent
  and tunable from one place.

### Determinism

- Everything that varies within a run comes from the day's seed. Nothing samples
  an unseeded random source, and nothing depends on wall-clock timing, or two
  devices will diverge partway through a run that is supposed to be identical.
- Simulation advances on a fixed timestep independent of render rate, so a
  device that renders at half the frame rate plays the same game.

### Result and sharing

- One end-of-run view: distance reached, the day's number, the streak, and the
  copy action. Text only, as with Chroma.

---

## File Summary

### New Files

Scuttle's own repository, generated from `TaioTech/app-template`. Its internal
layout is a matter for that repo's plan.

| Path | Purpose |
|------|---------|
| `TaioTech/scuttle` (new repo) | The game, deployed to its own subdomain |

### Modified Files

| Path | Changes |
|------|---------|
| `src/lib/projects.ts` | One appended `Project` object. No type change. |

### Docs

| Path | Changes |
|------|---------|
| `CHANGELOG.md` | Entry under `## [Unreleased]` for the index addition |
| `AGENTS.md` | No change |

---

## Gotchas

- **This one cannot be specified to "fun".** Chroma's quality falls out of
  getting the colour maths right; Scuttle's falls out of tuning — step duration,
  lane speeds, gap sizes, tide rate, seagull lead time. Expect the first
  playable build to feel wrong, and expect the work after that to be numbers
  rather than features. Budget for it rather than treating it as overrun.
- **A seeded daily run and a real-time game are in tension.** Determinism
  requires a fixed-timestep simulation decoupled from rendering. Bolting that on
  after the fact means rewriting the loop, so it is a day-one decision.
- **The committed forward step needs swept collision.** Checking only the
  destination cell lets a fast hazard tunnel through the crab mid-step. This is
  the classic version of this bug and it will show up as "I definitely got hit
  by nothing".
- **The dog is the hardest hazard to make fair.** A pursuer that is too good is
  unavoidable and reads as unfair; too poor and it is scenery. It probably needs
  a rule that makes it readable — committing to a direction for a beat, or
  losing interest — rather than pure homing.
- **Waves that carry rather than kill can strand a player.** If the surf pushes
  someone back into a lane that has since closed, they die to something they
  could not have avoided. The wave's push and the lane layout have to be
  considered together.
- **One life plus one run a day is harsh.** It is the right call for making a
  shared distance mean something, and it is also the single most likely thing to
  drive people away. Watch it in playtesting.

---

## Done Checklist

- [ ] Matches AC #1–#14 in the Scuttle repo
- [ ] Matches AC #15 in this repo
- [ ] Two devices, both offline, play an identical run on the same day (AC #9)
- [ ] The same day's run played on a device throttled to a low frame rate
      presents the same difficulty (AC #14)
- [ ] Played on a real phone, one-handed, by someone who did not build it
- [ ] `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build` pass
- [ ] Hub index and the new project page looked at in a browser
- [ ] `CHANGELOG.md` entry added under `## [Unreleased]`

---

## Open Questions

| # | Question | Context | Decision |
|---|----------|---------|----------|
| 1 | Is the app called Scuttle? | Working title. Alternatives raised: Sidestep, Low Tide, Undertow, Highwater. The slug is permanent once shipped and linked. | **Decided: Scuttle**, 2026-07-29. The repo is `TaioTech/scuttle` and it deploys to `scuttle.taiotech.com`. Settled before implementation precisely because the slug cannot move afterwards. |
| 2 | One run a day, or unlimited with a daily that counts? | One run makes a shared distance meaningful but is unforgiving for an arcade game, where failure is frequent and often instant. Chroma's puzzles fail gently; this does not. | **Decided: one run a day at ship, unlimited until then**, 2026-07-29. Scarcity is the shared premise and stays the target, but a prototype that can be played once a day cannot be tuned, and difficulty is still flat because the tide does not exist. The limit lands with the tide, not before. |
| 3 | What is the win condition — is there one? | Reaching the sea could end the run as a win, or could loop into a harder beach for an endless distance score. | **Decided: the sea is a win**, 2026-07-29, after the movement prototype played well and its endlessness became the thing missing from it. The beach is a fixed length, the score is time, and shells are an optional second axis. Specified in [`finish-line.md`](finish-line.md). |
| 4 | Does the player carry anything? | The hermit-crab framing — crossing to find a bigger shell — gives the run a reason and a possible carried-object mechanic. It may be flavour only. | Deferred. Flavour first; revisit only if the run needs another decision layer. |
| 5 | Does a collected shell do anything mechanically? | Pure score, or something that changes a run — one hit absorbed, say. | **Decided: pure score**, 2026-07-29. A shell is a number and a risk and nothing else. One life stays one life, so a player always knows exactly what dying costs, and a shared distance stays comparable between two people who spent their shells differently. |
| 6 | Is there a persistent high score board beyond AC #13's personal best? | Raised 2026-07-29 after the movement prototype played well. The interesting version is a score service shared across TaioTech apps rather than one owned by Scuttle, which reverses the no-backend decision above and needs identity and anti-cheat to be worth having. | **Deferred**, 2026-07-29. Written up in [`shared-scores.md`](shared-scores.md). The device-local personal best in AC #13 is unaffected and still in scope. |
