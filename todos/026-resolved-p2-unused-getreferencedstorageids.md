---
status: resolved
priority: p2
issue_id: "026"
tags: [code-review, dead-code, cleanup]
dependencies: []
---

# Unused getReferencedStorageIds Function (Dead Code)

## Problem Statement

The `getReferencedStorageIds` internal query in `convex/storage.ts` is never called. The `cleanupOrphanedFiles` mutation directly queries both teams and maps tables itself (lines 54-63), making this function dead code.

## Findings

### Evidence
Location: `/convex/storage.ts` lines 9-32

```typescript
export const getReferencedStorageIds = internalQuery({
  args: {},
  returns: v.array(v.id("_storage")),
  handler: async (ctx) => {
    const storageIds: Array<Id<"_storage">> = [];
    // ... 24 lines of unused code
    return storageIds;
  },
});
```

### Usage Search
```bash
grep -r "getReferencedStorageIds" convex/
# Only found: definition in storage.ts
# Not imported or called anywhere
```

### Why It Exists
Likely created as a utility then superseded by inline queries in `cleanupOrphanedFiles`. The inline version is more efficient (avoids extra function call overhead).

## Proposed Solutions

### Option 1: Delete the Function (Recommended)
Remove lines 9-32 from `convex/storage.ts`.

**Pros:** Removes 24 lines of dead code, reduces maintenance burden
**Cons:** None
**Effort:** Small (5 min)
**Risk:** None (unused code)

### Option 2: Refactor cleanupOrphanedFiles to Use It
Have `cleanupOrphanedFiles` call `getReferencedStorageIds`.

**Pros:** DRY principle
**Cons:** Adds function call overhead, no benefit
**Effort:** Small (15 min)
**Risk:** Low

## Recommended Action

_To be filled during triage_

## Technical Details

### Affected Files
- `convex/storage.ts`

### Components Affected
- None (dead code removal)

## Acceptance Criteria

- [ ] `getReferencedStorageIds` function removed
- [ ] Build passes
- [ ] Storage cleanup cron still works correctly

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-14 | Created during PR #18 code review | Simplicity reviewer identified dead code |

## Resources

- PR #18: feat(maps): Add maps admin page with image upload support
