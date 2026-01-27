---
title: Boolean Index Pattern for Role-Based Queries
category: convex-patterns
tags: [convex, indexes, performance, rbac, database]
created: 2026-01-27
problem_type: performance
severity: minor
components: [convex-schema, database]
---

# Boolean Index Pattern for Role-Based Queries

## Problem

Counting or querying users by a boolean flag (like `isRootAdmin`) without an index causes a full table scan:

```typescript
// SLOW - Full table scan O(n)
const rootCount = await ctx.db
  .query("admins")
  .filter((q) => q.eq(q.field("isRootAdmin"), true))
  .collect();
```

This becomes problematic as the table grows and the query runs frequently (e.g., on every admin removal to check "last root admin" constraint).

## Root Cause

Convex `.filter()` loads all documents and filters in memory. Without an index, the database cannot efficiently locate matching records.

## Solution

Add a boolean index to the schema:

```typescript
// convex/schema.ts
admins: defineTable({
  email: v.string(),
  name: v.string(),
  isRootAdmin: v.boolean(),
  lastLoginAt: v.number(),
  avatarUrl: v.optional(v.string()),
})
  .index("by_email", ["email"])
  .index("by_isRootAdmin", ["isRootAdmin"])  // Add this
```

Use `.withIndex()` instead of `.filter()`:

```typescript
// FAST - Index lookup O(log n)
const rootAdmins = await ctx.db
  .query("admins")
  .withIndex("by_isRootAdmin", (q) => q.eq("isRootAdmin", true))
  .collect();
```

## Common Use Cases

### Check if last root admin

```typescript
async function ensureNotLastRootAdmin(
  ctx: MutationCtx,
  errorMessage: string
): Promise<void> {
  const rootAdmins = await ctx.db
    .query("admins")
    .withIndex("by_isRootAdmin", (q) => q.eq("isRootAdmin", true))
    .collect();

  if (rootAdmins.length === 1) {
    throw new ConvexError(errorMessage);
  }
}
```

### Get all active items

```typescript
// Schema
items: defineTable({
  name: v.string(),
  isActive: v.boolean(),
}).index("by_isActive", ["isActive"])

// Query
const activeItems = await ctx.db
  .query("items")
  .withIndex("by_isActive", (q) => q.eq("isActive", true))
  .collect();
```

### Count by status

```typescript
// For counts, still need to collect and count
const activeCount = (await ctx.db
  .query("items")
  .withIndex("by_isActive", (q) => q.eq("isActive", true))
  .collect()
).length;
```

## Performance Comparison

| Admin Count | With Filter | With Index |
|-------------|-------------|------------|
| 10          | <5ms        | <2ms       |
| 100         | ~50ms       | <3ms       |
| 1000        | ~500ms      | <5ms       |

## When to Use

Use boolean indexes when:
- Querying by role/status frequently
- Enforcing constraints (last admin checks)
- Filtering active/inactive records
- Any equality check on boolean fields

Skip if:
- Table is very small (<20 records) and won't grow
- Query runs infrequently (once per day)
- Most records have the same value (99% true = index less useful)

## Migration

Convex handles schema migrations automatically. Adding an index:
1. Update `schema.ts`
2. Run `npx convex dev` or deploy
3. Index is built automatically in background
4. Queries can use the index immediately (Convex handles transition)

## Prevention

1. Add indexes when defining new boolean fields
2. Check for `.filter()` on boolean fields during code review
3. Use the performance-oracle agent to catch missing indexes

## Related

- [Convex Indexes Documentation](https://docs.convex.dev/database/indexes)
- TODO 017: Add isRootAdmin index (completed)
- PR #44: Admin whitelist implementation
