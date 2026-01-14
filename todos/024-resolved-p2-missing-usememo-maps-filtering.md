---
status: resolved
priority: p2
issue_id: "024"
tags: [code-review, performance, react, frontend]
dependencies: []
---

# Missing useMemo for Map Filtering in maps.tsx

## Problem Statement

The maps admin page filters `activeMaps` and `inactiveMaps` on every render without memoization. This causes unnecessary computation when unrelated state changes (dialog open, input typing, etc.) trigger re-renders.

## Findings

### Evidence
Location: `/src/routes/admin/maps.tsx` lines 75-76

```typescript
const activeMaps = maps?.filter((m) => m.isActive) ?? [];
const inactiveMaps = maps?.filter((m) => !m.isActive) ?? [];
```

### Impact Analysis
- **Current (10-20 maps):** Negligible performance impact
- **At 100+ maps:** Noticeable on every keystroke in form fields
- **Pattern:** Both filter operations run on ANY state change

### Root Cause
These derived values are not memoized despite `maps` being stable between renders (only changes when Convex subscription updates).

## Proposed Solutions

### Option 1: Add useMemo (Recommended)
```typescript
import { useMemo } from "react";

const { activeMaps, inactiveMaps } = useMemo(() => {
  if (!maps) return { activeMaps: [], inactiveMaps: [] };
  return {
    activeMaps: maps.filter((m) => m.isActive),
    inactiveMaps: maps.filter((m) => !m.isActive),
  };
}, [maps]);
```

**Pros:** Simple fix, standard React pattern
**Cons:** None
**Effort:** Small (5 min)
**Risk:** Low

### Option 2: Single-pass filter
```typescript
const { activeMaps, inactiveMaps } = useMemo(() => {
  if (!maps) return { activeMaps: [], inactiveMaps: [] };
  return maps.reduce(
    (acc, map) => {
      acc[map.isActive ? 'activeMaps' : 'inactiveMaps'].push(map);
      return acc;
    },
    { activeMaps: [], inactiveMaps: [] }
  );
}, [maps]);
```

**Pros:** Single iteration instead of two
**Cons:** Less readable
**Effort:** Small (10 min)
**Risk:** Low

## Recommended Action

_To be filled during triage_

## Technical Details

### Affected Files
- `src/routes/admin/maps.tsx`

### Components Affected
- MapsPage component

## Acceptance Criteria

- [ ] Filtering is wrapped in useMemo
- [ ] Filter only re-runs when `maps` data changes
- [ ] No visual regressions
- [ ] Build passes

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-14 | Created during PR #18 code review | Performance oracle identified unnecessary re-computation |

## Resources

- PR #18: feat(maps): Add maps admin page with image upload support
- React docs: https://react.dev/reference/react/useMemo
