---
status: pending
priority: p2
issue_id: "011"
tags: [code-review, performance, sessions, pr-20]
dependencies: []
---

# Performance: Sequential Operations in setSessionMaps

## Problem Statement

The `setSessionMaps` mutation uses sequential `await` calls in a loop for both storage URL resolution and database inserts. With 15 maps (MAX_MAP_POOL_SIZE), this creates up to 30 sequential async operations, significantly impacting performance.

## Findings

### Performance Oracle Analysis

**Location:** `/Users/khaiphan/Documents/wtcs-map-vote/convex/sessions.ts` lines 599-616

```typescript
for (const map of maps) {
  let imageUrl = map!.imageUrl ?? "";
  if (map!.imageStorageId) {
    const storageUrl = await ctx.storage.getUrl(map!.imageStorageId);  // Await in loop!
    if (storageUrl) {
      imageUrl = storageUrl;
    }
  }
  await ctx.db.insert("sessionMaps", { ... });  // Another await in loop!
}
```

**Current Impact:**
- 15 maps = up to 30 sequential async operations
- ~50ms per operation = ~1.5 seconds total

## Proposed Solutions

### Option A: Parallel URL Resolution + Parallel Inserts (Recommended)

```typescript
// Parallel URL resolution
const imageUrls = await Promise.all(
  maps.map(async (map) => {
    if (map!.imageStorageId) {
      const storageUrl = await ctx.storage.getUrl(map!.imageStorageId);
      return storageUrl ?? map!.imageUrl ?? "";
    }
    return map!.imageUrl ?? "";
  })
);

// Parallel inserts
await Promise.all(
  maps.map((map, i) =>
    ctx.db.insert("sessionMaps", {
      sessionId: args.sessionId,
      mapId: map!._id,
      name: map!.name,
      imageUrl: imageUrls[i],
      state: "AVAILABLE",
    })
  )
);
```

**Pros:** 10-15x faster, same functionality
**Cons:** Slightly more complex code
**Effort:** Small
**Risk:** Low (Convex handles parallel operations)

### Option B: Single Combined Promise.all

Combine URL resolution into the insert operation:
```typescript
await Promise.all(
  maps.map(async (map) => {
    let imageUrl = map!.imageUrl ?? "";
    if (map!.imageStorageId) {
      const storageUrl = await ctx.storage.getUrl(map!.imageStorageId);
      if (storageUrl) imageUrl = storageUrl;
    }
    return ctx.db.insert("sessionMaps", { ... });
  })
);
```

**Pros:** Single Promise.all, still parallel
**Cons:** URL resolution happens during insert (fine)
**Effort:** Small
**Risk:** Low

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected Files:**
- `convex/sessions.ts` - setSessionMaps mutation (lines 599-616)

**Expected Performance Improvement:** From O(n) sequential to O(1) parallel (bounded by Convex limits)

## Acceptance Criteria

- [ ] Storage URL resolution is parallelized
- [ ] Database inserts are parallelized
- [ ] No sequential awaits in loops for this function
- [ ] Tests still pass

## Work Log

| Date | Action | Learning |
|------|--------|----------|
| 2026-01-14 | Created from PR #20 review | Performance review identified sequential await pattern |

## Resources

- PR #20: https://github.com/Esk3tit/wtcs-map-vote/pull/20
