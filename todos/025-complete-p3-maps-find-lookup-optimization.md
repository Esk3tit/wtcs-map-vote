# Pre-build Map Lookup in buildSessionResults

**Priority:** P3
**Status:** ready
**Source:** WAR-35 review (performance-oracle)
**Files:** `convex/sessions.ts`

## Problem

In `buildSessionResults`, the `flatMap` over round history entries calls `maps.find(m => m._id.toString() === entry.mapId)` for each entry. This is O(n*m) where n = history entries, m = maps count.

While this is negligible at current scale (max 15 maps), it's a code quality improvement to use a Map lookup.

## Recommendation

```typescript
const mapLookup = new Map(maps.map(m => [m._id.toString(), m]));

// Then in flatMap:
const map = mapLookup.get(entry.mapId);
```

## References

- `convex/sessions.ts` `buildSessionResults` (lines 207-236)
