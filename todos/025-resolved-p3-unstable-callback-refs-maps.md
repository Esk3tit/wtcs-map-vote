---
status: resolved
priority: p3
issue_id: "025"
tags: [code-review, performance, react, frontend]
dependencies: ["024"]
---

# Unstable Callback References in MapCard Rendering

## Problem Statement

Inline arrow functions in the map card rendering create new function references on every render, preventing React from optimizing re-renders of MapCard children.

## Findings

### Evidence
Location: `/src/routes/admin/maps.tsx` lines 294-327

```tsx
{activeMaps.map((map) => (
  <MapCard
    key={map._id}
    map={map}
    onEdit={() => handleEditMap(map)}           // New function each render
    onDeactivate={() =>                          // New function each render
      handleDeactivateClick(map._id, map.name)
    }
  />
))}
```

### Impact Analysis
- With 50 maps displayed: 50 unnecessary MapCard re-renders on every parent state change
- Compounded by both activeMaps and inactiveMaps sections
- **Current impact:** Low (small dataset)
- **Scalability concern:** Medium (grows with map count)

## Proposed Solutions

### Option 1: Memoize MapCard Component
```typescript
const MapCard = React.memo(function MapCard({ ... }) {
  // existing implementation
});
```

**Pros:** Simple, accepts callback recreation, leverages React's built-in optimization
**Cons:** All props still compared on every render
**Effort:** Small (5 min)
**Risk:** Low

### Option 2: Pass IDs and Let MapCard Call Handlers
```typescript
// Parent
const handleEdit = useCallback((mapId: Id<"maps">) => {
  const map = maps?.find(m => m._id === mapId);
  if (map) handleEditMap(map);
}, [maps]);

// MapCard accepts mapId and calls onEdit(map._id)
```

**Pros:** Stable references, cleanest solution
**Cons:** More refactoring needed
**Effort:** Medium (20 min)
**Risk:** Low

### Option 3: Do Nothing (Acceptable)
Given the admin-only use case with low traffic, this optimization may be premature.

**Pros:** No changes needed
**Cons:** Technical debt if usage scales
**Effort:** None
**Risk:** None

## Recommended Action

_To be filled during triage_

## Technical Details

### Affected Files
- `src/routes/admin/maps.tsx`

### Components Affected
- MapsPage component
- MapCard component

## Acceptance Criteria

- [x] MapCard does not re-render when unrelated parent state changes
- [x] Edit/deactivate/reactivate still work correctly
- [x] No visual regressions

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-14 | Created during PR #18 code review | Performance oracle identified re-render pattern |
| 2026-01-14 | Resolved with React.memo wrapper | Option 1 implemented - simple and effective solution

## Resources

- PR #18: feat(maps): Add maps admin page with image upload support
- React docs: https://react.dev/reference/react/memo
