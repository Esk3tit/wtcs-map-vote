---
status: done
priority: p2
issue_id: "016"
tags: [code-review, quality, dry, convex]
dependencies: []
---

# Extract Duplicate Admin Helper Functions

## Problem Statement

The `convex/admins.ts` module contains duplicate code patterns that could be extracted into reusable helper functions. This violates DRY (Don't Repeat Yourself) and makes the code harder to maintain.

**Why it matters:** Duplicate code increases maintenance burden and risk of inconsistent bug fixes.

## Findings

**Source:** pattern-recognition-specialist agent

**Duplicate Pattern 1: "Admin not found" check (3 occurrences)**

Lines 263-267, 333-337, 385-389:
```typescript
const targetAdmin = await ctx.db.get(args.adminId);
if (!targetAdmin) {
  throw new Error("Admin not found");
}
```

**Duplicate Pattern 2: Last root admin check (2 occurrences)**

Lines 271-278, 346-353:
```typescript
const rootCount = await ctx.db
  .query("admins")
  .filter((q) => q.eq(q.field("isRootAdmin"), true))
  .collect();
if (rootCount.length === 1) {
  throw new Error("Cannot remove/demote the last root admin");
}
```

**Duplicate Pattern 3: User session lookup (2 occurrences)**

Lines 281-284, 391-395:
```typescript
const authUser = await ctx.db
  .query("users")
  .filter((q) => q.eq(q.field("email"), targetAdmin.email))
  .first();
```

## Proposed Solutions

### Option 1: Extract helper functions (Recommended)

**Approach:** Create private helper functions in `convex/admins.ts`

```typescript
async function getAdminOrThrow(
  ctx: MutationCtx,
  adminId: Id<"admins">
): Promise<Doc<"admins">> {
  const admin = await ctx.db.get(adminId);
  if (!admin) throw new ConvexError("Admin not found");
  return admin;
}

async function ensureNotLastRootAdmin(
  ctx: MutationCtx,
  errorMessage: string
): Promise<void> {
  const rootCount = await ctx.db
    .query("admins")
    .filter((q) => q.eq(q.field("isRootAdmin"), true))
    .collect();
  if (rootCount.length === 1) {
    throw new ConvexError(errorMessage);
  }
}

async function getAuthUserByEmail(
  ctx: MutationCtx,
  email: string
): Promise<Doc<"users"> | null> {
  return await ctx.db
    .query("users")
    .filter((q) => q.eq(q.field("email"), normalizeEmail(email)))
    .first();
}
```

| Aspect | Assessment |
|--------|------------|
| Effort | Small |
| Risk | Low |
| Pros | DRY, consistent behavior, easier testing |
| Cons | Minor refactoring |

### Option 2: Move to lib/auth.ts

**Approach:** Add helpers to the shared auth module

| Aspect | Assessment |
|--------|------------|
| Effort | Small |
| Risk | Low |
| Pros | Reusable across modules |
| Cons | May be admin-specific, not general auth |

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected Files:**
- `convex/admins.ts` - Extract 3 helper functions

**Database Changes:** None required

## Acceptance Criteria

- [x] `getAdminOrThrow` helper extracted and used in 3 places
- [x] `ensureNotLastRootAdmin` helper extracted and used in 2 places
- [x] `getAuthUserByEmail` helper extracted and used in 2 places
- [x] All existing tests still pass
- [x] No behavior changes

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-27 | Created during PR #44 review | DRY improves maintainability |
| 2026-01-27 | Implemented Option 1: Extracted 3 helper functions to Private Helpers section | ConvexError used for consistency with other modules |

## Resources

- PR #44: https://github.com/Esk3tit/wtcs-map-vote/pull/44
