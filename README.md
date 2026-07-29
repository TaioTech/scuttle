# Scuttle

A crab crossing a beach. Sideways is fast and fluid, forward is one slow step
you cannot take back, and everyone gets the same beach today.

Phase 1 only — the movement prototype. See [What exists](#what-exists).

## Quick start

```bash
npm install
npm run dev      # http://localhost:3000
```

Arrow keys on a desktop, or the three buttons at the bottom on a phone. Narrow
the window: this is built for a phone held in one hand.

## What exists

Phase 1 answers one question — is the sideways asymmetry fun? — and builds only
what is needed to answer it:

- Lateral movement that is continuous and instantly responsive, and a forward
  step that takes four tenths of a second, refuses all input while it runs, and
  cannot be cancelled.
- One band of dry-sand lanes, generated from the calendar date. Some lanes hold
  beachgoers walking across; some hold towels and sunbathers that do not move.
  Every fourth lane is clear.
- Three buttons, and a simulation that runs at a fixed sixty ticks a second
  regardless of the frame rate.

Not built, and specified: the tide, the surf and its waves, the seagull, the
dog, the frisbee, collectibles, the end-of-run result, the streak, sharing, and
the one-run-a-day limit. The lanes currently go on indefinitely because there is
no sea to reach yet, and a run can be retried as often as you like because a
prototype that can be played once a day cannot be tuned.

## Commands

```bash
npm run dev        # Dev server
npm run build      # Production build
npm run start      # Serve a production build
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm run test       # vitest run
```

All four must pass before anything is called done.

## Where it lives

Source is [`TaioTech/scuttle`](https://github.com/TaioTech/scuttle); the
prototype deploys to [scuttle.taiotech.com](https://scuttle.taiotech.com). The
[TaioTech hub](https://taiotech.com/scuttle) carries the project page that links
here, and nothing else — this repository owns the code and the spec.

Phase 1 was built inside the hub repository, at `scuttle/`, because this
repository did not exist yet. It was extracted with its history intact, so the
commit describing the movement work is the one that originally landed there.

## Docs

- [AGENTS.md](AGENTS.md) — orientation, architecture, and the gotchas that will
  otherwise be rediscovered the hard way
- [specs/scuttle.md](specs/scuttle.md) — the full specification, most of which
  is not built yet
- [CHANGELOG.md](CHANGELOG.md)
