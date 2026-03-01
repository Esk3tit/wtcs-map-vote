---
status: complete
priority: p2
issue_id: "048"
tags: [code-review, react-hooks, memory-leak, animation]
dependencies: ["047"]
---

# Add unmount cleanup for ban animation setTimeout

## Problem Statement

The `setTimeout` in the `animatingBanIds` effect (line 282 of `vote.$token.tsx`) has no cleanup. If the component unmounts before the 600ms timer fires (player navigates away, session ends, disconnect overlay), `setAnimatingBanIds` is called on an unmounted component. React 18+ silently drops this, but it is still a wasted operation and the closure captures `justBannedMapIds` unnecessarily.

The cleanup was intentionally removed per a PR review comment to prevent animation cancellation when a new ban arrives. The correct fix is to clean up on **unmount only**, not on effect re-run.

## Findings

- **Source**: Architecture Strategist, Frontend Races Reviewer (HIGH), Performance Oracle (Low), Code Simplicity Reviewer
- **Location**: `src/routes/vote.$token.tsx` lines 277-292
- **Evidence**: `setTimeout(() => { setAnimatingBanIds(...) }, 600)` with no `return () => clearTimeout(...)` and no ref-based unmount cleanup

## Proposed Solutions

### Option A: Ref-based unmount-only cleanup (Recommended)

```tsx
const banTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

useEffect(() => {
  return () => {
    for (const id of banTimersRef.current) clearTimeout(id);
  };
}, []); // unmount only

useEffect(() => {
  if (justBannedMapIds.size === 0) return;
  setAnimatingBanIds((prev) => new Set([...prev, ...justBannedMapIds]));
  const tid = setTimeout(() => {
    banTimersRef.current.delete(tid);
    setAnimatingBanIds((prev) => { /* cleanup */ });
  }, 600);
  banTimersRef.current.add(tid);
}, [justBannedMapIds]);
```

- **Pros**: Independent timeouts preserved, unmount cleanup added
- **Cons**: More code complexity with ref tracking
- **Effort**: Small
- **Risk**: Low

### Option B: Accept current behavior (if fixing #047 with Option B collapse)

If #047 is fixed by collapsing into a single `useEffect` with `return () => clearTimeout(timer)`, this issue is automatically resolved since the cleanup function handles both re-fire and unmount.

- **Pros**: No additional work
- **Cons**: Only works if #047 uses Option B
- **Effort**: None
- **Risk**: None

## Recommended Action

If #047 is fixed with Option B (collapse), this is automatically resolved. Otherwise use Option A.

## Acceptance Criteria

- [ ] No `setState` calls on unmounted components
- [ ] Ban animations still play to completion during normal operation
- [ ] Multiple independent ban timeouts work correctly

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-02-28 | Created | From PR #87 code review |

## Resources

- PR: https://github.com/Esk3tit/wtcs-map-vote/pull/87
- Depends on: #047
