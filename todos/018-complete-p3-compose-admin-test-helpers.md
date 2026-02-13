---
status: complete
priority: p3
issue_id: "018"
tags: [code-review, testing, duplication]
dependencies: []
---

# Compose admin test helpers from existing session setup helpers

## Problem Statement

`createAdminABBASession` (lines 2741-2807) and `createAdminMultiplayerSession` (lines 2810-2872) duplicate ~80% of the logic from the existing `createABBASession` (lines 67-153) and `createMultiplayerSession` (lines 864-938). The only differences are admin auth context creation and slightly different return shapes.

## Findings

- **Location:** `convex/voting.test.ts:2741-2872` (admin helpers) vs `convex/voting.test.ts:67-153, 864-938` (player helpers)
- **Agents:** code-simplicity-reviewer, pattern-recognition-specialist
- **Context:** ~130 lines of test setup code could be reduced to ~30 by wrapping existing helpers. Minor inconsistency: admin helpers use `Team 1`/`Team 2` while player helpers use `Team Alpha`/`Team Beta` (ABBA) and `Team A`/`Team B` (MULTIPLAYER).

## Proposed Solutions

### Option 1: Compose admin helpers by wrapping player helpers (Recommended)
- Admin helpers call `createAuthenticatedAdmin()` for auth context, then delegate session/player/map creation to the existing helper patterns
- **Pros:** ~100 LOC reduction, consistent naming
- **Cons:** May need slight refactoring of existing helpers to accept external admin ID
- **Effort:** Small-Medium
- **Risk:** Low

### Option 2: Accept duplication in test code
- Test code duplication is more tolerable than production code duplication
- **Pros:** No refactoring risk
- **Cons:** Maintenance burden when session setup patterns change
- **Effort:** None
- **Risk:** Low

## Recommended Action

Option 1: Compose admin helpers by wrapping player helpers. Reduces ~100 LOC of test setup duplication.

## Acceptance Criteria

- [ ] Admin test helpers compose existing session setup logic
- [ ] Team naming consistent across all test helpers
- [ ] All tests pass

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-13 | Created from PR #63 code review | Test setup duplication is lower priority than production code duplication |
| 2026-02-13 | Approved during triage | Status: pending → ready. |

## Resources

- PR #63: https://github.com/Esk3tit/wtcs-map-vote/pull/63
