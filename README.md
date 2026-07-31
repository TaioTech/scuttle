# Scuttle

A crab crossing a beach. Sideways is fast and fluid, forward is one slow step
you cannot take back, and everyone gets the same beach today.

Play it at [scuttle.taiotech.com](https://scuttle.taiotech.com).

## Quick start

```bash
npm install
npm run dev      # http://localhost:3000
```

Arrow keys on a desktop, or the three buttons at the bottom on a phone. Narrow
the window: this is built for a phone held in one hand.

## The game

Frogger's shape with one mechanic changed. Crabs walk sideways, so moving across
the beach is quick and continuous while moving down it is a committed step that
takes four tenths of a second and refuses all input while it runs. Everything
else follows from that asymmetry.

- **Thirty-two lanes, and a sea at the end of them.** Reaching the water wins.
  The beach is a fixed length on every day of the year — only what is in the
  lanes varies — which is the only reason two days' times can be compared.
- **One beach a day, the same for everyone.** Generated from the local calendar
  date, with no server involved: two people playing the same day, offline and
  with no contact between them, cross the same beach.
- **Three bands.** Dry sand, then the tide line, then the surf — where waves
  pick the crab up and carry it. A wave cannot kill; being carried somewhere
  awkward can.
- **What is in the lanes.** Beachgoers walking across, towels and sunbathers
  that do not move, and a seagull. Some lanes are clear.
- **Shells**, scattered toward the riskier side of the beach, worth the detour
  or not.
- **A time, a distance, and a personal best**, kept on the device. Reaching the
  sea on consecutive days builds a streak. Every run can be shared as a line
  that names the day and gives nothing about the beach away.

Not built, and specified: the two pursuing hazards — the dog was deferred before
it shipped, and the frisbee was built, played and pulled — and the one-run-a-day
limit. Retries are unlimited for now, because a prototype that can be played once
a day cannot be tuned. See [specs/](specs) before assuming a missing thing is an
oversight.

## Commands

```bash
npm run dev        # Dev server
npm run build      # Production build
npm run start      # Serve a production build
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm run test       # vitest run
```

All four gates must pass before anything is called done.

## The profile

When a run ends, Scuttle reports that day to the [TaioTech
hub](https://taiotech.com)'s player-profile ledger — the day's best rather than
the last run. It reports two things: `shells`, the most picked up in one run
that day, and `wins`, which is 1 on a day the sea was reached. Both appear on
the profile the hub shows for whoever is playing, alongside whatever the other
games in the arcade have minted.

**Play is unaffected when the ledger is unreachable.** Nothing waits on a
submission and a failure is silent: offline, or with the service down, a run
plays start to finish exactly as it always did. The personal best and the streak
live in this device's local storage and are never read back from the hub, so the
game's own screens do not depend on the ledger at all. A run that could not be
sent is queued and tried again the next time the game is opened.

`NEXT_PUBLIC_LEDGER_ORIGIN` points submissions somewhere other than
`https://taiotech.com`, which is what local development against a hub on another
hostname needs.

## Versions

The footer carries a version and a short commit — `v0.2.0 · e0476c8`. They
answer different questions: the version says which release this is, and the
commit says which build, which matters when a preview URL, a production domain
and a dev server all look identical.

Merging to `master` ships. CI bumps the version and tags the commit from the
merged commit's type, so `version` in `package.json` is not edited by hand.

## Where it lives

Source is [`TaioTech/scuttle`](https://github.com/TaioTech/scuttle), deploying to
[scuttle.taiotech.com](https://scuttle.taiotech.com). The
[TaioTech hub](https://taiotech.com/scuttle) carries the project page that links
here and the profile that collects what this game reports; the code and the spec
live here.

Scuttle's first phase was built inside the hub repository, at `scuttle/`, because
this repository did not exist yet. It was extracted with its history intact, so
the commit describing the movement work is the one that originally landed there.

## Docs

- [AGENTS.md](AGENTS.md) — orientation, architecture, and the gotchas that will
  otherwise be rediscovered the hard way
- [specs/scuttle.md](specs/scuttle.md) — the specification, and the two things
  in it that are still unbuilt
- [CHANGELOG.md](CHANGELOG.md)
