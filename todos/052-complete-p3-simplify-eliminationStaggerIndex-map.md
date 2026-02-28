---
status: complete
priority: p3
issue_id: "052"
tags: [code-review, simplification, react-hooks]
dependencies: []
---

# Simplify eliminationStaggerIndex from Map to inline indexOf

## Problem Statement

The `eliminationStaggerIndex` useMemo (lines 302-311 in `vote.$token.tsx`) pre-computes a `Map<string, number>` from the `eliminatedMapIds` array just so the render can call `.get(mapId)`. With at most ~9 maps in a session, `indexOf` is trivially fast and eliminates the need for the `useMemo` + `Map` construction.

## Findings

- **Source**: Code Simplicity Reviewer
- **Location**: `src/routes/vote.$token.tsx` lines 302-311

## Proposed Solutions

### Option A: Replace with inline helper function

```typescript
const getStaggerIndex = (mapId: Id<"sessionMaps">) => {
  if (!isAnyReveal || !revealData?.eliminatedMapIds) return undefined;
  const idx = revealData.eliminatedMapIds.indexOf(mapId);
  return idx >= 0 ? idx : undefined;
};
```

- **Effort**: Small (~10 lines removed, 5 added)
- **Risk**: Low

## Acceptance Criteria

- [ ] `eliminationStaggerIndex` useMemo removed
- [ ] Stagger indices still computed correctly for eliminated maps
- [ ] Non-eliminated maps receive `undefined` (no stagger)

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-02-28 | Created | From PR #87 code review |
