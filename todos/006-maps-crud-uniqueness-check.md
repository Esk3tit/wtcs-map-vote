# RESOLVED: Add Map Name Uniqueness Validation

**Priority:** P2 - Medium
**Status:** RESOLVED (2025-01-12)
**Source:** Pattern Recognition Specialist Review - PR #15
**Created:** 2025-01-12

## Issue

Unlike `teams.ts` which checks for duplicate team names, `maps.ts` does not enforce unique map names. Multiple maps with identical names can be created.

## Impact

- User confusion in the UI
- Potential data integrity issues
- Could create confusion about which map was used in a session

## Location

- `convex/maps.ts` - `createMap` mutation (line 138)
- `convex/maps.ts` - `updateMap` mutation (lines 181-191)

## Resolution

Add uniqueness check to `createMap` before insert:
```typescript
// Check uniqueness (indexes don't enforce uniqueness in Convex)
const existing = await ctx.db
  .query("maps")
  .withIndex("by_name", (q) => q.eq("name", trimmedName))
  .first();

if (existing) {
  throw new ConvexError("A map with this name already exists");
}
```

Add uniqueness check to `updateMap` when name changes:
```typescript
if (trimmedName !== existing.name) {
  const duplicate = await ctx.db
    .query("maps")
    .withIndex("by_name", (q) => q.eq("name", trimmedName))
    .first();

  if (duplicate) {
    throw new ConvexError("A map with this name already exists");
  }
}
```

## Status

- [x] Add uniqueness check to createMap
- [x] Add uniqueness check to updateMap

## Resolution

Implemented in commit 08bace4. Both createMap and updateMap now check for duplicate map names using the `by_name` index before inserting/updating.

## Notes

The `by_name` index already exists in the schema and is used for sorting. This check should be added for consistency with teams.ts pattern.
