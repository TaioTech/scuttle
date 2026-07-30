# Shared scores across TaioTech apps

> **Status**: Idea — deferred, not scheduled
> **Scope**: Larger than Scuttle. Touches the hub and every app that would use it.
> **Date**: 2026-07-29

## What this is

A record of an idea, not a plan to build one. Scuttle wants a persistent high
score board. The interesting version of that is not Scuttle's alone: it is a
score service owned by TaioTech that Scuttle, Chroma and whatever comes next all
write to, so a player has one identity and one history across the workshop
rather than a separate island per app.

It is written down here because the decision to defer it should be a decision,
not a thing that quietly never got discussed.

## Why it is deferred

Scuttle's spec puts "any backend, account, or leaderboard" out of scope, and that
was a deliberate call rather than an omission — the seeded-daily design exists
precisely so the game needs no server. Adding a global board reverses it, and
reversing it well is a bigger piece of work than it first looks:

- **It needs identity.** A leaderboard without one is a list of anonymous
  numbers. Identity means accounts, or at minimum a durable anonymous ID, and
  that is the thing the current design was built to avoid.
- **Client-reported scores are forgeable.** A seeded daily scored on the client
  is trivial to fake — open the console and post any distance you like. A board
  that can be cheated in ten seconds is worse than no board, because it looks
  authoritative. The honest fixes are server-side replay validation (send the
  input sequence, re-run the deterministic sim on the server, trust the result)
  or accepting that the board is for fun and saying so plainly.
- **It fights offline play.** Scuttle's AC #10 requires a complete run playable
  offline after first load. A board can be written behind that — queue the
  result, sync when there is a network — but the game must never wait on it.
- **It is a shared component with one consumer.** Building a cross-app service
  for a single app is how a service gets a shape that fits only that app. It
  wants at least two real consumers before its interface is settled.

The good news is that the determinism Scuttle already has is exactly what makes
server-side validation cheap later: the sim is pure and takes no clock, so the
same input sequence replays to the same distance anywhere. That property is
worth protecting even while this stays unbuilt.

## The shape it would probably take

Sketched to the depth that is useful now, and no further.

- A small service owned by the hub, not by any one game. One endpoint to submit
  a run, one to read a board.
- A run submission is the app, the day number, the score, and — if validation is
  wanted — the input sequence that produced it.
- Anonymous-first identity: a generated ID held on the device, with an optional
  claim step later if names are ever wanted. No passwords.
- Each app keeps its local board as the source of truth for the player's own
  history, and the service is additive. Losing the network, or the service,
  costs the global board and never the game.

## What to do in the meantime

Nothing in this repo. Scuttle already commits to a device-local personal best
and streak in AC #13, and that is unaffected by any of the above. If a local
board of recent runs is wanted before this is settled, it is a small, purely
local piece of work that this document does not block.

## Open questions

| # | Question | Context |
|---|----------|---------|
| 1 | Is the board global, or per-app with a shared identity? | One list everyone competes on, versus one player history spanning apps. These are different products and only the second needs a shared service. |
| 2 | Does it validate, or does it trust? | Replay validation is affordable because the sim is deterministic, but it is real work. Trusting the client is free and honest if labelled. |
| 3 | Does it need names? | A board of anonymous IDs is not very compelling; a board with names needs moderation. |
| 4 | Which second app justifies it? | The interface should not be designed against Scuttle alone. |
