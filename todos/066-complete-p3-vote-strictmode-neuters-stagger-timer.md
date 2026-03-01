---
status: ready
priority: p3
issue_id: "066"
tags: [code-review, dev-experience, animation, war-66]
dependencies: ["065"]
---

# StrictMode double-mount neuters stagger timer in dev

## Problem Statement

In React StrictMode (dev only), effects mount → cleanup → mount. On cleanup, `clearTimeout` fires, but `staggerTimerSet.current` remains `true`. On the second mount, the guard `if (staggerTimerSet.current) return` prevents the timer from being recreated. This means `isFirstMountRef.current` never flips to `false` in dev mode.

## Findings

- **Location:** `src/routes/vote.$token.tsx:268-277`
- This is **dev-only** behavior — production builds run effects once
- The visual impact is negligible: `isFirstMountRef` staying `true` means stagger classes are applied on every re-render, but since keys are stable, CSS animations don't visually restart
- The only observable effect: wrapper divs retain animation CSS classes they no longer need

## Proposed Solutions

### Option 1: Accept as dev-only quirk (No change)
- **Pros**: No production impact, simple
- **Cons**: Slightly misleading behavior in dev tools inspection
- **Effort**: None
- **Risk**: None

### Option 2: Reset staggerTimerSet in cleanup
- Add `staggerTimerSet.current = false` in the effect cleanup
- **Pros**: Timer works correctly in StrictMode
- **Cons**: Adds complexity for a dev-only issue
- **Effort**: Small (1 line)
- **Risk**: Low

## Acceptance Criteria

- [ ] Decision made: accept or fix
- [ ] If fixed: stagger timer fires correctly in dev mode

## Work Log

### 2026-02-28 - Created from code review
**By:** Claude Code Review
**Actions:** Identified by julik-frontend-races-reviewer

## Resources

- PR #90: WAR-66 lobby pulsing wait + staggered maps
- Depends on #065 decision (if refs are simplified, this becomes moot)
