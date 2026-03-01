---
status: ready
priority: p3
issue_id: "067"
tags: [code-review, architecture, complexity, war-66]
dependencies: []
---

# Vote page complexity trajectory advisory

## Problem Statement

The vote page (`vote.$token.tsx`) now has ~1004 lines, 6 refs, and 6 effects. While each addition is justified, the cumulative complexity is worth monitoring. This is an advisory finding — no immediate action required.

## Findings

- **Location:** `src/routes/vote.$token.tsx` (entire file)
- Current metrics: ~1004 lines, 6 useRef, 6 useEffect, multiple useMemo/useCallback
- Each ref/effect serves a distinct purpose (auth, animation, turn tracking, etc.)
- The vote page is the most complex user-facing page by design (real-time voting with multiple animation phases)
- Architecture-strategist notes this is a natural result of the feature set, not a design smell yet

## Proposed Solutions

### Option 1: Monitor but no action now
- **Pros**: Avoids premature refactoring, current structure is clear
- **Cons**: Risk of gradual complexity creep
- **Effort**: None
- **Risk**: None

### Option 2: Extract animation logic to custom hook (future)
- Move stagger refs/effects into `useFirstMountStagger()` hook
- **Pros**: Reduces vote page line count, reusable pattern
- **Cons**: Premature if only used once
- **Effort**: Medium
- **Risk**: Low

## Acceptance Criteria

- [ ] Decision made: accept advisory or plan extraction

## Work Log

### 2026-02-28 - Created from code review
**By:** Claude Code Review
**Actions:** Advisory from architecture-strategist and code-simplicity-reviewer

## Resources

- PR #90: WAR-66 lobby pulsing wait + staggered maps
