---
status: complete
priority: p2
issue_id: "021"
tags: [code-review, data-integrity, convex, storage]
dependencies: []
---

# Orphaned Storage Files on Upload Failure

## Problem Statement

The client uploads files to Convex storage BEFORE calling `createTeam` or `updateTeam`. If the subsequent mutation fails, the uploaded file remains in storage but is never referenced by any database record, causing storage quota leakage and potential cost implications.

## Findings

### Data Integrity Review Finding
- **Location:** `src/routes/admin/teams.tsx:106-161`
- **Evidence:**
  ```typescript
  // File uploaded first (lines 106-120)
  if (imageSource.type === "upload") {
    const uploadUrl = await generateUploadUrl();
    const response = await fetch(uploadUrl, { /* ... */ });
    const { storageId } = await response.json();
    logoStorageId = storageId;  // File now in storage
  }

  // Mutation called AFTER - can fail (lines 125-161)
  if (editingTeamId) {
    await updateTeam(updateArgs);  // If this throws, file is orphaned
  } else {
    await createTeam({ name, logoUrl, logoStorageId });  // Same issue
  }
  ```

### Orphan Scenarios
1. Duplicate name validation fails
2. Active session check fails
3. Network error during mutation
4. User closes browser after upload but before save

### Impact
- Storage quota accumulation
- Cost implications for cloud storage
- No automatic cleanup mechanism

## Proposed Solutions

### Solution 1: Scheduled Garbage Collection (Recommended)
**Description:** Create a scheduled function that identifies and cleans up orphaned storage files.

```typescript
// convex/crons.ts
export const cleanupOrphanedStorage = internalMutation({
  handler: async (ctx) => {
    const allStorageFiles = await ctx.db.system.query("_storage").collect();
    const referencedIds = new Set(
      (await ctx.db.query("teams").collect())
        .map(t => t.logoStorageId)
        .filter(Boolean)
    );
    for (const file of allStorageFiles) {
      if (!referencedIds.has(file._id) && isOlderThan(file, 1, "hour")) {
        await ctx.storage.delete(file._id);
      }
    }
  }
});
```

**Pros:** Handles all orphan scenarios, non-blocking
**Cons:** Requires scheduled function, delayed cleanup
**Effort:** Medium (2-3 hours)
**Risk:** Low

### Solution 2: Upload Action Wrapper
**Description:** Create an action that combines upload + team create/update atomically.

**Pros:** No orphans possible
**Cons:** Changes client workflow significantly, more complex
**Effort:** High (4-6 hours)
**Risk:** Medium

### Solution 3: Client-Side Retry with Cleanup
**Description:** If mutation fails, client deletes the uploaded file.

**Pros:** Immediate cleanup
**Cons:** Client can't always cleanup (browser close), no delete mutation exposed
**Effort:** Medium (2 hours)
**Risk:** Medium

## Recommended Action

[To be filled during triage]

## Technical Details

**Affected Files:**
- `convex/crons.ts` - New scheduled function (Solution 1)
- `convex/teams.ts` - Optional upload action wrapper (Solution 2)

**Considerations:**
- Need to check both `teams.logoStorageId` and future `maps.imageStorageId`
- Should have a grace period before cleanup (1 hour) to avoid race conditions

## Acceptance Criteria

- [ ] Orphaned storage files are eventually cleaned up
- [ ] Active/pending uploads are not accidentally deleted
- [ ] Storage usage is bounded

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-13 | Created from code review | Security and data integrity agents flagged this |

## Resources

- PR #17: https://github.com/Esk3tit/wtcs-map-vote/pull/17
- Convex scheduled functions: https://docs.convex.dev/scheduling/cron-jobs
