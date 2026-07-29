# Scuttle — Implementation Plan

> **Spec**: `specs/scuttle.md`
> **Created**: 2026-07-29
> **Note**: written while phase 1 was staged inside the hub repository. Phase 0
> is now resolved — this repository exists and the code lives here — so the
> staging discussion below reads as history, not as a live constraint.
> **Scope of this plan**: Phase 1 only — the movement prototype. Later phases
> are sketched at the end so the phase-1 shapes do not have to be undone.

## Summary

Phase 1 answers one question: is sideways-biased movement fun? It builds the
crab, one band of seeded dry-sand lanes, three buttons, and a fixed-timestep
simulation — and nothing else. Tide, surf, seagulls, the dog, the frisbee,
collectibles, results, streaks and sharing are all later phases, left out
because each one adds a variable that makes the movement harder to judge.

The approach is a pure simulation module with no knowledge of time, rendering,
or the DOM. It advances one fixed tick at a time from a seed and an input
snapshot. A thin client component owns the `requestAnimationFrame` accumulator,
feeds ticks in, and draws the resulting state to a canvas. Everything the
simulation needs to know about the day's board is derived on demand from the
seed and the row index, so nothing is stored, nothing is mutated, and the same
tick always produces the same board.

## Progress

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 0: Staging the repo | Resolved | Staged at `scuttle/` in the hub, then extracted with history into `TaioTech/scuttle` |
| Phase 1a: Determinism core | Complete | Seed, RNG, lane generation |
| Phase 1b: Simulation | Complete | Fixed-timestep step function, movement rules, swept collision |
| Phase 1c: Presentation | Complete | Canvas renderer, three-button controls, RAF loop |
| Phase 1d: Gates | Complete | typecheck, lint, test, build |
| Phase 2+: The rest of the beach | Not Started | Out of scope for this plan |

**Last updated**: 2026-07-29
**Current phase**: Phase 1 complete, awaiting playtest
**Blocked**: No

All four gates pass in this repository, which now owns the code. Phase 1 has
been played in a browser at phone size, not only compiled.

## Phase 0: where the code lives

The spec assumes Scuttle ships from `TaioTech/scuttle`, generated from
`TaioTech/app-template`. Neither repository exists. `app-template` was never
created, and the GitHub credentials in this session cannot create repositories
— the API refuses with a permissions error, so this is not something a retry
fixes.

The code is therefore staged at `scuttle/` in this repository, on the feature
branch, as a complete standalone application: its own `package.json`, its own
four gates, its own CI workflow, its own `AGENTS.md`. It imports nothing from
the hub and the hub imports nothing from it.

This mirrors what `docs/WORKSHOP.md` already says about the specs themselves —
staged here because their repos do not exist, travelling to those repos when
they do. Migration is a directory copy and a `git init`; the README in
`scuttle/` carries the exact commands.

Two hub files change to keep the hub's own gates honest while the directory is
staged, and both revert on migration:

- `eslint.config.mjs` ignores `scuttle/**`, so the hub's lint gate does not
  lint a nested project with its own config.
- `tsconfig.json` excludes `scuttle/**`, for the same reason.

The hub's CI gains a second job that runs Scuttle's four gates from `scuttle/`.
Staged code with no CI rots; the job is ten lines and is deleted along with the
directory.

Because `app-template` does not exist, Scuttle's scaffolding is copied from
this repo's conventions instead: the same `.editorconfig`, `.nvmrc`, ESLint
flat config, `tsconfig.json`, Tailwind v4 setup, dark palette tokens, and CI
shape. The one addition is Vitest, which the hub does not have and the spec's
done checklist requires.

## Files

### Phase 0

| Action | Path | Purpose |
|--------|------|---------|
| Modify | `eslint.config.mjs` | Ignore the staged `scuttle/` project |
| Modify | `tsconfig.json` | Exclude the staged `scuttle/` project |
| Modify | `.github/workflows/ci.yml` | Second job running Scuttle's gates |
| Create | `scuttle/` scaffolding | `package.json`, configs, `AGENTS.md`, `README.md`, `CHANGELOG.md` |

### Phase 1a — determinism core

| Action | Path | Purpose |
|--------|------|---------|
| Create | `scuttle/src/lib/constants.ts` | Every tunable number, in one place |
| Create | `scuttle/src/lib/rng.ts` | Day seed from a calendar date; seeded PRNG |
| Create | `scuttle/src/lib/board.ts` | Lane layout derived from seed and row index |

### Phase 1b — simulation

| Action | Path | Purpose |
|--------|------|---------|
| Create | `scuttle/src/lib/collision.ts` | Swept AABB test |
| Create | `scuttle/src/lib/sim.ts` | State shape and the fixed-timestep step function |
| Create | `scuttle/src/lib/loop.ts` | Elapsed milliseconds to a count of whole ticks |

### Phase 1c — presentation

| Action | Path | Purpose |
|--------|------|---------|
| Create | `scuttle/src/lib/palette.ts` | Canvas colours, mirroring the CSS tokens |
| Create | `scuttle/src/lib/render.ts` | Draws an interpolated state to a 2D context |
| Create | `scuttle/src/components/Game.tsx` | The RAF accumulator, canvas, and input refs |
| Create | `scuttle/src/components/Controls.tsx` | Three buttons, pointer and keyboard |
| Create | `scuttle/src/app/page.tsx` | Server component; mounts the game |
| Create | `scuttle/src/app/layout.tsx` | Fonts, metadata, dark shell |
| Create | `scuttle/src/app/globals.css` | Shared palette tokens plus sand tones |
| Create | `scuttle/src/app/icon.svg` | Favicon |

### Phase 1d — tests

| Action | Path | Purpose |
|--------|------|---------|
| Create | `scuttle/src/lib/rng.test.ts` | Seed stability and spread |
| Create | `scuttle/src/lib/board.test.ts` | Determinism and guaranteed passability |
| Create | `scuttle/src/lib/collision.test.ts` | Sweep catches what a point test misses |
| Create | `scuttle/src/lib/sim.test.ts` | Movement rules, commitment, frame-rate independence |

## Phases

### Phase 1a: Determinism core

**Goal**: The day's board is a pure function of the calendar date and the row
index. Nothing is stored, nothing is mutated, nothing samples an unseeded
source.

- [x] `dayNumber(date)` — days since a fixed epoch, from the device's local
      calendar date, so a run belongs to the day the player is living in
- [x] `seedForDay(dayNumber)` and a SplitMix32-style `createRng(seed)`
- [x] `laneAt(seed, row)` — derives one lane from a per-row sub-seed, so lanes
      can be generated on demand at any row without walking from row 0
- [x] Lane placement that guarantees a passable gap by construction: every gap
      starts at the minimum and only ever grows

**Gate**: `npm run typecheck`, `npm run test`.

---

### Phase 1b: Simulation

**Goal**: A pure `stepSim(state, input)` that advances exactly one fixed tick,
never reads a clock, and resolves collision along the whole path travelled.

- [x] Hazard positions are computed from the tick number rather than
      accumulated, so no drift is possible over a long run
- [x] Lateral movement: continuous, held, clamped to the board
- [x] Forward step: fixed number of ticks, one lane, uncancellable, and lateral
      input is refused for its duration
- [x] Forward input is edge-triggered, not held — a held button does not
      auto-repeat into a second lane
- [x] Swept AABB collision between the player's and each hazard's tick-start
      and tick-end boxes, tested against both lanes the player spans mid-step
- [x] Wrapping hazards are tested as two images so the wrap cannot open a hole

**Gate**: `npm run typecheck`, `npm run test`.

---

### Phase 1c: Presentation

**Goal**: The simulation is visible and playable one-thumbed on a phone, and
the render rate has no influence on the run.

- [x] Accumulator loop: clamp the frame delta, drain whole ticks, keep the
      remainder as an interpolation alpha
- [x] Render interpolates between the previous and current state, so a
      120 Hz screen looks smooth without the simulation knowing
- [x] Fixed number of visible lanes, letterboxed, so no device sees further
      down the beach than another
- [x] Three full-height buttons across the bottom; pointer events into a ref,
      never into React state, so no frame causes a re-render
- [x] Arrow keys mapped to the same input for desktop testing

**Gate**: `npm run lint`, `npm run build`.

---

### Phase 1d: Gates

- [x] `npm run typecheck`
- [x] `npm run lint`
- [x] `npm run test`
- [x] `npm run build`
- [x] Hub's own four gates still pass

## Decisions

| Decision | Rationale |
|----------|-----------|
| Staged at `scuttle/` in the hub rather than its own repo | `TaioTech/scuttle` could not be created with the credentials available to the building session; staging kept the work reviewable and it moved out intact once a session with repository-creation rights ran the extraction |
| "One lane of dry-sand hazards" read as one *band*, not one row | A single row is a two-step game, which cannot show whether the asymmetry is fun. The dry sand band is present with many lanes; the tide line and surf bands are absent |
| Lanes continue indefinitely rather than ending at a sea | Phase 1 has no surf to reach. An open-ended beach gives as many crossings as the player survives, which is what makes the movement judgeable |
| Every fourth lane is safe | Gives a rhythm of three crossings and a breath, and creates the situation the asymmetry exists for: standing safe, sliding sideways, choosing an entry |
| Both still and drifting hazard lanes | Still lanes reward sliding to a gap; drifting lanes reward timing. The asymmetry is only interesting when both readings are in play |
| No difficulty ramp | The spec is explicit that escalation should read as the tide advancing, not as a speed multiplier. With no tide in phase 1, a flat board is the honest option and makes tuning legible |
| Unlimited retries of the day's run | The daily lock exists to make a shared distance mean something. Phase 1 has no sharing and no result screen, and a movement prototype that can be played once a day cannot be tuned |
| Lateral input is refused during a forward step | The clearest reading of "committed": the step commits to a line, not just to a destination. It also makes the swept path a straight segment, which is easier to reason about and to draw |
| Canvas rather than DOM | Smooth sub-pixel motion for a dozen shapes without a node per hazard, and the interpolation stays in one function |
| Vitest | The spec's done checklist names `npm run test`. Vitest needs no Babel config and runs the pure modules directly |
| The simulation takes a `Beach` rather than a seed | Forced by the first test run: a forward step always crosses a lane with something in it, so measuring the step on the real beach mostly measured dying. It is also where the tide attaches later — a tide shifts which row is which, which is a different beach and not a different simulation |
| Forward's rising edge is detected inside the simulation | The first version trusted the input layer to send the press once. A held button then walked the crab down the whole beach, which is the asymmetry gone. A contract enforced only by a comment is one that breaks later |
| `MIN_GAP` is per lane kind, and the drifting one is derived from the step duration | The first numbers sized gaps to the crab's width. A step cannot be steered, so at the fastest lane speed the gap slides most of ten units out from under the crab before it lands — the lanes looked passable and arithmetically were not. A bot that only stepped into provably clear gaps reached a median of one lane; after the fix, six |

## Open questions, answered

The spec's open questions #2, #3 and #5 do not block phase 1 and are not
settled by it. What phase 1 does settle:

- **#2 (one run a day)** — deliberately not enforced in phase 1. This is not a
  vote on the question; it is that a prototype built to be tuned has to be
  replayable. The decision stands for the shipping build.
- **#3 (win condition)** — untouched. Phase 1's beach does not end, which is a
  property of having no surf yet rather than a position on the question.
- **#5 (shells)** — untouched. No collectibles in phase 1.

## What phase 1 leaves ready for phase 2

- Lane kinds are a discriminated union, so `"tide"` and `"surf"` are new
  variants rather than a rewrite.
- `laneAt` takes the row index and nothing else, so a tide value that shifts
  which rows are which becomes an argument, not a restructuring.
- Hazards are a position function of the tick, so a hazard that pursues the
  player (the dog) is the first one that needs per-tick state — and it needs it
  in `SimState`, where the fixed timestep already keeps it deterministic.
- The renderer takes two states and an alpha, so anything added to the state is
  drawable without touching the loop.
