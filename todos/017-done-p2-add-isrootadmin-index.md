---
status: done
priority: p2
issue_id: "017"
tags: [code-review, performance, convex, schema]
dependencies: []
---

# Add Index for isRootAdmin Filter Query

## Problem Statement

The root admin count query in `convex/admins.ts` uses `.filter()` instead of an index, causing a full table scan of the admins table every time an admin is removed or demoted.

**Why it matters:** While currently acceptable for small admin counts, this establishes a poor performance pattern that will degrade as the admin list grows.

## Findings

**Source:** performance-oracle agent, data-integrity-guardian agent

**Evidence from `/convex/admins.ts` (lines 271-274, 346-349):**
```typescript
const rootCount = await ctx.db
  .query("admins")
  .filter((q) => q.eq(q.field("isRootAdmin"), true))
  .collect();
```

**Current Performance:**
- O(n) scan of admins table
- All root admin documents loaded into memory

**Projected Impact:**
| Admin Count | Estimated Latency |
|-------------|-------------------|
| 10 | <5ms |
| 50 | ~15ms |
| 500 | ~100ms |

## Proposed Solutions

### Option 1: Add index to schema (Recommended)

**Approach:** Add `by_isRootAdmin` index to admins table

```typescript
// In schema.ts
admins: defineTable({
  // ...fields
}).index("by_email", ["email"])
  .index("by_isRootAdmin", ["isRootAdmin"])
```

Then update the query:
```typescript
const rootAdmins = await ctx.db
  .query("admins")
  .withIndex("by_isRootAdmin", (q) => q.eq("isRootAdmin", true))
  .collect();
```

| Aspect | Assessment |
|--------|------------|
| Effort | Small |
| Risk | Low - schema migration is automatic in Convex |
| Pros | O(log n) lookup, follows best practices |
| Cons | Additional index storage |

### Option 2: Accept current implementation

**Approach:** Document the limitation and defer

| Aspect | Assessment |
|--------|------------|
| Effort | None |
| Risk | Low for current scale |
| Pros | No changes needed |
| Cons | Technical debt, poor pattern |

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected Files:**
- `convex/schema.ts` - Add index
- `convex/admins.ts` - Update query to use index

**Database Changes:** Add index (automatic migration)

## Acceptance Criteria

- [x] `by_isRootAdmin` index added to schema
- [x] Root admin count query uses `.withIndex()`
- [x] Tests pass with new query pattern
- [x] Verify index is used in Convex dashboard (confirmed via dev server output)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-27 | Created during PR #44 review | Always use indexes for equality filters |
| 2026-01-27 | Implemented index and updated query | Schema migration is automatic; tests pass after Convex type regeneration |

## Resources

- PR #44: https://github.com/Esk3tit/wtcs-map-vote/pull/44
- Convex indexes: https://docs.convex.dev/database/indexes
