---
status: ready
priority: p3
issue_id: "065"
tags: [code-review, simplification, animation, war-66]
dependencies: []
---

# Vote page two-ref stagger pattern may simplify to one ref

## Problem Statement

The first-mount stagger mechanism uses two refs (`isFirstMountRef` and `staggerTimerSet`) plus a `useEffect` with `setTimeout`. The code-simplicity-reviewer argues the `staggerTimerSet` ref is redundant and the entire timer may be unnecessary since CSS animations complete regardless of ref value — React's key stability preserves DOM nodes, so the wrapper div's animation classes only matter during the initial render.

## Findings

- **Location:** `src/routes/vote.$token.tsx:259-277`
- `isFirstMountRef` — controls whether stagger classes are applied in JSX
- `staggerTimerSet` — prevents the timer from being set more than once
- The timer flips `isFirstMountRef.current = false` after computed duration
- **Counter-argument (performance/architecture agents):** The timer is a deliberate safety mechanism. Without it, if React re-renders during animation, stagger classes would re-apply and restart animations. The ref latch ensures exactly-once behavior.
- **Simplicity argument:** Since `key={map._id}` is stable, React won't unmount/remount the wrapper divs, so the CSS animation plays once regardless. The ref flip only affects future re-renders which wouldn't restart animations anyway.

## Proposed Solutions

### Option 1: Keep current two-ref approach (No change)
- **Pros**: Explicit, defensive, handles hypothetical edge cases
- **Cons**: ~12 extra lines, two refs where semantically one concept exists
- **Effort**: None
- **Risk**: None

### Option 2: Simplify to single ref without timer
- Remove `staggerTimerSet`, remove `useEffect`, keep only `isFirstMountRef`
- Flip `isFirstMountRef.current = false` synchronously after first render reads it (via `useEffect(() => { isFirstMountRef.current = false; }, [])`)
- **Pros**: ~12 fewer lines, simpler mental model
- **Cons**: Less defensive against hypothetical re-render edge cases
- **Effort**: Small
- **Risk**: Low — CSS animations are DOM-stable with stable keys

## Acceptance Criteria

- [ ] Decision made: keep or simplify
- [ ] If simplified: stagger still only plays on first mount
- [ ] No visual regression on vote page animations

## Work Log

### 2026-02-28 - Created from code review
**By:** Claude Code Review
**Actions:** Identified by code-simplicity-reviewer, debated by performance-oracle and architecture-strategist

## Resources

- PR #90: WAR-66 lobby pulsing wait + staggered maps
