---
status: complete
priority: p3
issue_id: "017"
tags: [code-review, testing]
dependencies: []
---

# Add missing test coverage for adminVoteOnBehalf edge cases

## Problem Statement

The admin vote-on-behalf test suite covers 13 scenarios but is missing several edge cases that are tested in the player-facing paths. While the shared `resolveRound`/`completeSession` functions are well-tested via the player paths, the admin entry point to these paths is not end-to-end tested.

## Findings

- **Location:** `convex/voting.test.ts:2732-3290` (admin tests)
- **Agents:** pattern-recognition-specialist, data-integrity-guardian, architecture-strategist, security-sentinel
- **Missing scenarios:**
  1. Defense-in-depth duplicate vote (MULTIPLAYER): `hasVotedThisRound` is false but a vote record exists in DB — tests the DB check at lines 872-879
  2. Admin vote triggers WINNER outcome (MULTIPLAYER): admin submits last vote that leads to session completion
  3. Admin vote triggers deadlock/revote/RANDOM_WINNER (MULTIPLAYER): tests the full resolution chain through admin path
  4. Non-existent player ID or map ID (deleted entities)
  5. Expired session (expiresAt in past, status still IN_PROGRESS) — depends on #015 resolution

## Proposed Solutions

### Option 1: Add the 3-4 highest-value tests (Recommended)
- Add defense-in-depth duplicate vote test (critical correctness path)
- Add admin-triggered WINNER test (end-to-end completion via admin)
- Add non-existent player/map ID tests
- **Pros:** Covers the most important gaps
- **Cons:** More test code
- **Effort:** Small-Medium (~60-80 lines)
- **Risk:** Low

## Recommended Action

Option 1: Add the 3-4 highest-value tests — defense-in-depth, WINNER outcome, non-existent IDs.

## Acceptance Criteria

- [ ] Defense-in-depth duplicate vote test added
- [ ] WINNER outcome via admin vote test added
- [ ] Non-existent entity ID tests added
- [ ] All tests pass

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-13 | Created from PR #63 code review | Player paths have these tests; admin path does not |
| 2026-02-13 | Approved during triage | Status: pending → ready. |

## Resources

- PR #63: https://github.com/Esk3tit/wtcs-map-vote/pull/63
- `convex/voting.test.ts:2467-2520` — existing defense-in-depth tests for player path
