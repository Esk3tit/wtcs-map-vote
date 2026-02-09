---
status: complete
priority: p2
issue_id: "015"
tags: [code-review, data-integrity, architecture]
dependencies: []
---

# Document isRevoteRound guard rails for future admin reset/pause/resume

## Problem Statement

The `isRevoteRound` field on sessions tracks deadlock state during multiplayer voting. If a future pause/resume or admin-reset feature is added without clearing this flag, sessions could incorrectly treat a first deadlock as a double deadlock (triggering random selection instead of revote).

## Findings

- No admin pause/resume mutations exist yet (`PAUSED` status exists in schema but no transition logic)
- `isRevoteRound` is set to `true` on first deadlock (voting.ts:290), cleared on completion/advance
- `expireStaleSessions` only targets DRAFT/WAITING sessions — no risk there
- Source: Data Integrity Guardian reviewer

## Proposed Fix

Add a TODO comment to the `isRevoteRound` field in `convex/schema.ts` and/or a note in `docs/SPECIFICATION.md` that any future session reset/resume functionality must clear `isRevoteRound` to `false` and reset `currentRound` appropriately.

## Files to Modify

- `convex/schema.ts:69` — Add inline TODO comment
- `docs/SPECIFICATION.md` — Optional: add note in session lifecycle section
