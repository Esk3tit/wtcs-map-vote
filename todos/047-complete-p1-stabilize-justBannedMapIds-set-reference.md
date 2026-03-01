---
status: complete
priority: p1
issue_id: "047"
tags: [code-review, race-condition, react-hooks, animation]
dependencies: []
---

# Stabilize justBannedMapIds Set reference to prevent effect re-firing every render

## Problem Statement

`justBannedMapIds` is computed via `useMemo` and returns a **new `Set` object** on every recomputation, even when the result is logically identical (e.g., empty set). Since `Set` uses reference equality (`Object.is(new Set(), new Set()) === false`), the `useEffect` at line 277 of `vote.$token.tsx` fires on **every render**, not just when bans actually happen. The `if (justBannedMapIds.size > 0)` guard prevents actual state updates in the empty case, but:

1. The effect still tears down and re-establishes every render cycle (wasted work)
2. When a ban DOES happen, rapid Convex subscription updates during the 600ms animation window create multiple `setTimeout` closures referencing different Set instances, which can produce unpredictable cleanup patterns

## Findings

- **Source**: Frontend Races Reviewer (CRITICAL), Pattern Recognition (Low), Code Simplicity (Medium)
- **Location**: `src/routes/vote.$token.tsx` lines 259-292
- **Evidence**: `useMemo` returns `new Set<string>()` on every recomputation. React compares dependencies with `Object.is()`, so a new empty Set !== previous empty Set. The `useEffect` dependency `[justBannedMapIds]` triggers on every render.

## Proposed Solutions

### Option A: Stabilize via sorted string key (Recommended)

Add a stable string key derived from the Set contents, use that as the effect dependency:

```tsx
const justBannedKey = useMemo(
  () => [...justBannedMapIds].sort().join(","),
  [justBannedMapIds]
);

useEffect(() => {
  if (justBannedMapIds.size === 0) return;
  // ... animation logic
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [justBannedKey]);
```

- **Pros**: Simple, clear intent, effect only fires when ban content changes
- **Cons**: Requires eslint-disable for exhaustive-deps since we use the derived key
- **Effort**: Small
- **Risk**: Low

### Option B: Collapse into single useEffect (from Code Simplicity reviewer)

Merge the 4-hook chain (useRef + useMemo + useState + useEffect + useEffect) into 2 hooks (useRef + useEffect) that does diff, state update, and ref update in one place:

```tsx
useEffect(() => {
  // Diff current vs previous
  const newlyBanned = new Set<string>();
  for (const map of mapsForAnimation) {
    const prev = prevMapStatesRef.current.get(map._id);
    if (prev === "AVAILABLE" && map.state === "BANNED") {
      newlyBanned.add(map._id);
    }
  }
  // Update ref
  prevMapStatesRef.current = new Map(mapsForAnimation.map((m) => [m._id, m.state]));
  // Animate
  if (newlyBanned.size === 0) return;
  setAnimatingBanIds((prev) => new Set([...prev, ...newlyBanned]));
  const timer = setTimeout(() => { /* cleanup */ }, 600);
  return () => clearTimeout(timer);
}, [mapsForAnimation, sessionFormat]);
```

- **Pros**: Eliminates the referential instability entirely, reduces hook count, adds proper cleanup
- **Cons**: Larger refactor, changes cleanup semantics (clearing timer on re-fire)
- **Effort**: Medium
- **Risk**: Low-Medium (needs testing of rapid ban scenarios)

### Option C: Module-level empty Set sentinel

```tsx
const EMPTY_SET = new Set<string>();
// In useMemo: return justBanned.size > 0 ? justBanned : EMPTY_SET;
```

- **Pros**: Minimal change, referentially stable empty case
- **Cons**: Only fixes the empty case; rapid non-empty changes still create new Sets
- **Effort**: Small
- **Risk**: Low

## Recommended Action

Option B (collapse) is the most thorough fix. Option A is acceptable if you want a smaller change.

## Technical Details

- **Affected files**: `src/routes/vote.$token.tsx`
- **Affected components**: `PlayerVotingPage` animation state tracking

## Acceptance Criteria

- [ ] The ban animation effect does NOT fire on every Convex subscription update
- [ ] Ban animations still play correctly when a map transitions AVAILABLE -> BANNED
- [ ] Multiple rapid bans in ABBA mode animate independently without glitches
- [ ] Late-join safety preserved (no animations on first render)

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-02-28 | Created | From PR #87 code review |

## Resources

- PR: https://github.com/Esk3tit/wtcs-map-vote/pull/87
- File: `src/routes/vote.$token.tsx:259-292`
