---
status: complete
priority: p2
issue_id: "012"
tags: [code-review, refactoring, duplication]
dependencies: []
---

# Extract shared winner declaration helper

## Problem Statement

The "declare winner and complete session" logic is duplicated in 3 locations within `convex/voting.ts`. The WINNER branch (lines 206-213) and RANDOM_WINNER branch (lines 331-338) are character-identical. The `submitBan` completion (lines 522-530) is nearly identical, differing only in the absence of `isRevoteRound: false`. This creates maintenance risk if session completion logic changes.

## Findings

- `convex/voting.ts:206-213` — WINNER branch in `resolveRound`
- `convex/voting.ts:331-338` — RANDOM_WINNER branch in `resolveRound`
- `convex/voting.ts:522-530` — `submitBan` ABBA completion (no `isRevoteRound`)
- All three patch the winner map to `state: "WINNER"`, patch the session to `COMPLETE`, and log `WINNER_DECLARED`
- Source: Pattern Recognition + Code Simplicity reviewers

## Proposed Fix

Extract a `completeSession(ctx, session, winnerMapId)` helper that handles:
- Patching winner map state
- Patching session to COMPLETE with winnerMapId, completedAt, updatedAt, isRevoteRound
- Called from all 3 locations

Estimated savings: ~14 duplicated lines replaced by 3 function calls + 8-line helper = ~6 LOC net reduction.

## Files to Modify

- `convex/voting.ts` — Extract helper, replace 3 code blocks
