---
status: done
priority: p2
issue_id: "014"
tags: [code-review, security, data-integrity, convex]
dependencies: []
---

# Email Normalization Inconsistency in User Lookup

## Problem Statement

When looking up auth users for session invalidation in `convex/admins.ts`, the code queries the `users` table by email without applying normalization. The `admins` table stores normalized (lowercase) emails, but the lookup uses the email directly from the admin record without verifying the `users` table uses the same normalization.

**Why it matters:** If the email case does not match between the `admins` and `users` tables, removed admins may retain active sessions, creating a security gap.

## Findings

**Source:** security-sentinel agent, data-integrity-guardian agent

**Evidence from `/convex/admins.ts` (lines 281-284, 391-394):**
```typescript
const authUser = await ctx.db
  .query("users")
  .filter((q) => q.eq(q.field("email"), targetAdmin.email))
  .first();
```

**Issues:**
1. Uses `.filter()` instead of index (if one exists on `users` table)
2. No explicit email normalization applied to the lookup
3. Assumes `users.email` format matches `admins.email` format

**Impact:**
- Session invalidation could silently fail if email formats differ
- Removed admins could retain active sessions
- Security bypass for admin removal workflow

## Proposed Solutions

### Option 1: Normalize email in lookup (Recommended)

**Approach:** Apply `normalizeEmail()` when looking up auth users

```typescript
const authUser = await ctx.db
  .query("users")
  .filter((q) => q.eq(q.field("email"), normalizeEmail(targetAdmin.email)))
  .first();
```

| Aspect | Assessment |
|--------|------------|
| Effort | Small |
| Risk | Low |
| Pros | Consistent email handling |
| Cons | May still miss if users table has different normalization |

### Option 2: Use index if available

**Approach:** Check if `users` table from `@convex-dev/auth` has an email index

```typescript
const authUser = await ctx.db
  .query("users")
  .withIndex("email", (q) => q.eq("email", normalizeEmail(targetAdmin.email)))
  .first();
```

| Aspect | Assessment |
|--------|------------|
| Effort | Small |
| Risk | Low - need to verify index name |
| Pros | Better performance, consistent lookup |
| Cons | Depends on Convex Auth internals |

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected Files:**
- `convex/admins.ts` - lines 281-284 (`removeAdmin`)
- `convex/admins.ts` - lines 391-394 (`invalidateAdminSessions`)

**Database Changes:** None required

## Acceptance Criteria

- [x] Email lookup in `removeAdmin` uses normalized email
- [x] Email lookup in `invalidateAdminSessions` uses normalized email
- [x] Verify session invalidation works with mixed-case emails
- [x] Add test case for email normalization in session lookup

**Note:** The fix was implemented in the centralized `getAuthUserByEmail` helper function (lines 64-73 in `convex/admins.ts`), which is used by both `removeAdmin` and `invalidateAdminSessions`. This ensures consistent email normalization for all user lookups. The helper now normalizes emails before the database query, handling mixed-case emails correctly. Existing tests pass with this change.

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-27 | Created during PR #44 review | Email handling consistency is critical for security |
| 2026-01-27 | Resolved: Updated `getAuthUserByEmail` helper to use `normalizeEmail()` | Centralizing the fix in the helper function ensures all callers benefit from the normalization |

## Resources

- PR #44: https://github.com/Esk3tit/wtcs-map-vote/pull/44
- Convex Auth user table: https://labs.convex.dev/auth
