---
status: complete
priority: p2
issue_id: "028"
tags: [code-review, architecture, duplication]
dependencies: []
---

# Duplicated Round-Advancement Logic in Timer Expiry

## Problem Statement

The zero-vote timer expiry path in `sessionCleanup.ts` duplicates round-advancement logic (increment round, reset turn, clear timer fields) that also exists in `resolveRound`. If advancement logic changes, both locations must be updated in sync.

## Findings

- **Location**: `convex/sessionCleanup.ts` (zero-vote timer expiry paths for ABBA and MULTIPLAYER) and `convex/lib/votingHelpers.ts` (`resolveRound`)
- **Raised by**: architecture-strategist, pattern-recognition-specialist, code-simplicity-reviewer (3/7 agents)
- Zero-vote path manually patches `currentRound`, `currentTurn`, `timerStartedAt`, `timerPausedAt`
- `resolveRound` does the same advancement after banning

## Proposed Solutions

### Option A: Extract shared `advanceRound` helper
- Create a helper in `votingHelpers.ts` that both paths call
- **Pros**: Single source of truth, DRY
- **Cons**: Larger refactor, needs to handle both ABBA and MULTIPLAYER contexts
- **Effort**: Medium
- **Risk**: Medium (touches critical voting flow)

### Option B: Leave as-is with documentation
- Add comments linking the two locations
- **Pros**: No code change risk
- **Cons**: Duplication remains
- **Effort**: Small
- **Risk**: Low

## Acceptance Criteria

- [ ] Round advancement logic is not duplicated (if Option A)
- [ ] OR both locations are clearly cross-referenced (if Option B)
- [ ] All tests pass

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-02-25 | Created | From PR #82 code review |
| 2026-02-25 | Approved | Triage: approved for work |
