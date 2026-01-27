---
status: done
priority: p3
issue_id: "019"
tags: [code-review, performance, convex]
dependencies: []
---

# Use Index Instead of Filter in Auth Callback

## Problem Statement

The `afterUserCreatedOrUpdated` callback in `convex/auth.ts` uses `.filter()` to look up admins by email instead of using the `by_email` index, causing a full table scan.

**Why it matters:** This runs on every login, so using the index improves login performance.

## Findings

**Source:** data-integrity-guardian agent, performance-oracle agent

**Evidence from `/convex/auth.ts` (line 28-31):**
```typescript
const existingAdmin = await ctx.db
  .query("admins")
  .filter((q) => q.eq(q.field("email"), normalizedEmail))
  .first();
```

**Compare to correct pattern in `/convex/admins.ts` (line 217):**
```typescript
const existing = await ctx.db
  .query("admins")
  .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
  .first();
```

## Proposed Solutions

### Option 1: Use index (Recommended)

**Approach:** Change filter to withIndex

```typescript
const existingAdmin = await ctx.db
  .query("admins")
  .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
  .first();
```

| Aspect | Assessment |
|--------|------------|
| Effort | Small |
| Risk | Low |
| Pros | O(log n) lookup instead of O(n) |
| Cons | None |

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected Files:**
- `convex/auth.ts` - line 28-31

**Database Changes:** None

## Acceptance Criteria

- [x] Auth callback uses `.withIndex("by_email", ...)`
- [x] Login flow still works correctly
- [x] First user bootstrap still works

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-27 | Created during PR #44 review | Always use indexes for equality lookups |
| 2026-01-27 | Implemented fix | Cast ctx to typed MutationCtx to enable schema-aware index access in auth callback |

## Resources

- PR #44: https://github.com/Esk3tit/wtcs-map-vote/pull/44
