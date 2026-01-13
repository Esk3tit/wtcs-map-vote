---
status: complete
priority: p2
issue_id: "020"
tags: [code-review, data-integrity, convex, teams]
dependencies: []
---

# Storage Cleanup Order Can Cause Data Loss

## Problem Statement

In `updateTeam`, storage files are deleted BEFORE the database patch. If the patch fails after storage deletion, the old image is lost with no recovery path. The operation order should be reversed: patch database first, then delete old storage.

## Findings

### Architecture Review Finding
- **Location:** `convex/teams.ts:238-243`
- **Evidence:**
  ```typescript
  if (oldStorageIdToDelete) {
    await ctx.storage.delete(oldStorageIdToDelete);  // Deletes first
  }
  await ctx.db.patch(args.teamId, updates);  // Could fail after deletion
  ```

### Data Loss Scenario
1. Team has `logoStorageId = "file123"`
2. User updates to new `logoStorageId = "file456"`
3. `ctx.storage.delete("file123")` succeeds
4. `ctx.db.patch()` fails (e.g., concurrent modification, validation)
5. Result: Team still references "file123" but file is deleted

### Note on Convex Transactions
Convex mutations are atomic for database operations, but storage operations are NOT part of the transaction. Deleting storage before patching means storage changes cannot be rolled back.

## Proposed Solutions

### Solution 1: Reverse Operation Order (Recommended)
**Description:** Patch database first, then delete old storage files.

```typescript
// Patch first - ensures DB update succeeds
await ctx.db.patch(args.teamId, updates);

// Then cleanup old storage (safe to fail)
if (oldStorageIdToDelete) {
  await ctx.storage.delete(oldStorageIdToDelete);
}
```

**Pros:** Simple change, ensures data integrity
**Cons:** If storage delete fails, orphaned file (minor, recoverable)
**Effort:** Small (15 min)
**Risk:** Low

### Solution 2: Deferred Cleanup via Scheduled Function
**Description:** Queue storage cleanup for later execution.

**Pros:** Completely decouples storage from mutation
**Cons:** More complex, delayed cleanup
**Effort:** Medium (2 hours)
**Risk:** Low

## Recommended Action

[To be filled during triage]

## Technical Details

**Affected Files:**
- `convex/teams.ts` - `updateTeam` mutation (lines 238-243)

**Change Required:**
Swap order of `ctx.storage.delete()` and `ctx.db.patch()` calls.

## Acceptance Criteria

- [ ] Database patch happens before storage deletion
- [ ] If patch fails, old storage file is preserved
- [ ] Existing logo update functionality still works

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-13 | Created from code review | Architecture and data integrity agents both flagged this |

## Resources

- PR #17: https://github.com/Esk3tit/wtcs-map-vote/pull/17
- Convex transactions: https://docs.convex.dev/database/advanced/occ
