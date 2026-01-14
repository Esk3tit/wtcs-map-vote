---
title: "Convex Pagination Best Practices - Manual vs paginationOptsValidator"
category: pagination
tags: [convex, pagination, usePaginatedQuery, paginationOptsValidator, data-consistency, reactive-pagination]
date: 2026-01-14
severity: high
component: convex/teams.ts
symptoms:
  - Missing pages or duplicate items during pagination when data changes
  - Pagination state out of sync after real-time updates
  - usePaginatedQuery hook incompatibility
  - Frontend must manually track cursor state
  - No automatic reactive pagination (gapless pagination)
---

# Convex Pagination Best Practices: Avoid Manual Cursor/Limit Handling

## Problem Statement

Developers might manually implement pagination using separate `cursor` and `limit` arguments instead of using Convex's built-in `paginationOptsValidator`. This causes data consistency issues during pagination, particularly in real-time applications.

**Anti-pattern example (from `convex/teams.ts`):**

```typescript
// ANTI-PATTERN: Manual cursor/limit handling
export const listTeams = query({
  args: {
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),  // Manual cursor tracking
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    const result = await ctx.db
      .query("teams")
      .withIndex("by_name")
      .order("asc")
      .paginate({ cursor: args.cursor ?? null, numItems: limit });

    return {
      teams: result.page,
      continueCursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});
```

**Correct pattern (from `convex/sessions.ts`):**

```typescript
// CORRECT: Using paginationOptsValidator
import { paginationOptsValidator } from "convex/server";

export const listSessions = query({
  args: {
    paginationOpts: paginationOptsValidator,
    status: v.optional(sessionStatusValidator),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sessions")
      .order("desc")
      .paginate(args.paginationOpts);
  },
});
```

## Why This Matters

### 1. Data Consistency During Real-Time Updates

Manual pagination breaks Convex's **gapless reactive pagination**:

| Scenario | Manual Cursor/Limit | paginationOptsValidator |
|----------|---------------------|-------------------------|
| Item inserted before current page | May cause duplicate on next page | Automatically adjusts pages |
| Item deleted from current page | May skip an item on next page | Seamlessly fills the gap |
| Real-time subscription updates | Pages become stale | Pages react automatically |

### 2. Frontend Hook Compatibility

| Feature | useQuery (manual) | usePaginatedQuery |
|---------|-------------------|-------------------|
| Automatic cursor tracking | Manual | Built-in |
| Load more functionality | Manual state | `loadMore()` method |
| Page invalidation on change | Manual refresh | Automatic |
| TypeScript integration | Partial | Full type safety |

### 3. QueryJournal Tracking

`paginationOptsValidator` includes internal cursor state (QueryJournal) that tracks:
- Document IDs seen so far
- Exact position in the index
- Subscription boundaries for reactivity

Manual implementations lose this tracking and cannot provide gapless pagination.

---

## Correct Implementation Pattern

### Backend (Convex Function)

```typescript
import { query } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";

export const listItems = query({
  args: {
    paginationOpts: paginationOptsValidator,
    // Additional filter args are fine
    category: v.optional(v.string()),
  },
  // NOTE: Return type is inferred - don't manually specify for paginated queries
  handler: async (ctx, args) => {
    let query = ctx.db.query("items");

    // Apply index-based filtering
    if (args.category) {
      query = query.withIndex("by_category", (q) => q.eq("category", args.category));
    }

    // Always end with .paginate(args.paginationOpts)
    return await query.order("desc").paginate(args.paginationOpts);
  },
});
```

### Frontend (React)

```typescript
import { usePaginatedQuery } from "convex/react";
import { api } from "../convex/_generated/api";

function ItemList() {
  const { results, status, loadMore } = usePaginatedQuery(
    api.items.listItems,
    { category: "electronics" },  // Additional args
    { initialNumItems: 20 }       // Pagination config
  );

  return (
    <div>
      {results.map((item) => (
        <ItemCard key={item._id} item={item} />
      ))}

      {status === "CanLoadMore" && (
        <button onClick={() => loadMore(20)}>Load More</button>
      )}

      {status === "LoadingMore" && <LoadingSpinner />}
    </div>
  );
}
```

---

## Prevention Checklist

### For Developers Writing New Queries

- [ ] **Always use `paginationOptsValidator`** for list queries that may grow
- [ ] **Import from `convex/server`**: `import { paginationOptsValidator } from "convex/server";`
- [ ] **Name the arg `paginationOpts`** (convention for consistency)
- [ ] **End query chains with `.paginate(args.paginationOpts)`**
- [ ] **Do NOT manually specify return type** - let TypeScript infer the pagination shape
- [ ] **Use `usePaginatedQuery`** on frontend, not `useQuery`

### When Manual Pagination Might Seem Tempting

| Temptation | Better Solution |
|------------|-----------------|
| "I only need 10 items max" | Still use `paginationOptsValidator` - it handles small lists fine |
| "I want to control the limit" | `initialNumItems` in `usePaginatedQuery` config |
| "I need custom cursor logic" | You probably don't - Convex handles edge cases |
| "I need backward pagination" | Use `.order("asc")` or `.order("desc")` appropriately |

---

## Code Review Criteria

### Red Flags (Must Fix)

- [ ] **Separate `cursor` and `limit` args** without `paginationOptsValidator`
- [ ] **`useQuery` with manual cursor state** on frontend
- [ ] **Custom `continueCursor`/`isDone` response shape** instead of letting `.paginate()` return it
- [ ] **`v.optional(v.string())` for cursor** - signals manual implementation

### Review Questions to Ask

1. "Is this list query paginated? If so, does it use `paginationOptsValidator`?"
2. "What happens when an item is inserted/deleted while the user is on page 2?"
3. "Is the frontend using `usePaginatedQuery` or manually tracking cursor?"
4. "Does the return type match what `.paginate()` naturally returns?"

### Auto-Detection Patterns (for linting)

```typescript
// These patterns should trigger review:
args: {
  cursor: v.optional(v.string()),  // Manual cursor
  limit: v.optional(v.number()),   // Manual limit
}

// Without this import:
import { paginationOptsValidator } from "convex/server";
```

---

## Test Scenarios

### Unit Tests (Convex Functions)

```typescript
// Test that pagination returns expected shape
test("listItems returns paginated result", async () => {
  const result = await ctx.runQuery(api.items.listItems, {
    paginationOpts: { numItems: 10, cursor: null },
  });

  expect(result).toHaveProperty("page");
  expect(result).toHaveProperty("isDone");
  expect(result).toHaveProperty("continueCursor");
  expect(Array.isArray(result.page)).toBe(true);
});

// Test pagination cursor continuity
test("pagination cursor returns next page", async () => {
  // Insert 15 items
  // ...

  const page1 = await ctx.runQuery(api.items.listItems, {
    paginationOpts: { numItems: 10, cursor: null },
  });

  expect(page1.page).toHaveLength(10);
  expect(page1.isDone).toBe(false);

  const page2 = await ctx.runQuery(api.items.listItems, {
    paginationOpts: { numItems: 10, cursor: page1.continueCursor },
  });

  expect(page2.page).toHaveLength(5);
  expect(page2.isDone).toBe(true);
});
```

### Integration Tests (Frontend + Backend)

```typescript
// Test real-time consistency during pagination
test("inserting item during pagination shows on correct page", async () => {
  // 1. Load page 1 (items 1-10)
  // 2. Insert new item that sorts before item 10
  // 3. Load page 2
  // 4. Verify no duplicate items between pages
  // 5. Verify no skipped items
});

// Test delete consistency
test("deleting item during pagination fills gap", async () => {
  // 1. Load page 1 (items 1-10)
  // 2. Delete item 5
  // 3. Verify page 1 now has items 1-4, 6-11 (gap filled)
});
```

### Manual Testing Checklist

- [ ] Load first page of results
- [ ] Insert a new item (verify it appears correctly)
- [ ] Delete an item from current page (verify no gaps)
- [ ] Load more items
- [ ] Verify no duplicates between pages
- [ ] Test with browser DevTools Network tab - verify cursor changes

---

## Migration Guide

### Converting Manual Pagination to paginationOptsValidator

**Step 1: Update Backend**

```diff
- import { query } from "./_generated/server";
+ import { query } from "./_generated/server";
+ import { paginationOptsValidator } from "convex/server";
  import { v } from "convex/values";

  export const listTeams = query({
    args: {
-     limit: v.optional(v.number()),
-     cursor: v.optional(v.string()),
+     paginationOpts: paginationOptsValidator,
    },
-   returns: v.object({
-     teams: v.array(teamObjectValidator),
-     continueCursor: v.union(v.string(), v.null()),
-     isDone: v.boolean(),
-   }),
+   // Remove explicit returns - let TypeScript infer
    handler: async (ctx, args) => {
-     const limit = args.limit ?? 50;
-     const result = await ctx.db
+     return await ctx.db
        .query("teams")
        .withIndex("by_name")
        .order("asc")
-       .paginate({ cursor: args.cursor ?? null, numItems: limit });
-
-     return {
-       teams: result.page,
-       continueCursor: result.continueCursor,
-       isDone: result.isDone,
-     };
+       .paginate(args.paginationOpts);
    },
  });
```

**Step 2: Update Frontend**

```diff
- import { useQuery } from "convex/react";
+ import { usePaginatedQuery } from "convex/react";
  import { api } from "../convex/_generated/api";

  function TeamsPage() {
-   const [cursor, setCursor] = useState<string | null>(null);
-   const teamsResult = useQuery(api.teams.listTeams, { cursor, limit: 50 });
-
-   const loadMore = () => {
-     if (teamsResult?.continueCursor) {
-       setCursor(teamsResult.continueCursor);
-     }
-   };
+   const { results, status, loadMore } = usePaginatedQuery(
+     api.teams.listTeams,
+     {},
+     { initialNumItems: 50 }
+   );

-   const teams = teamsResult?.teams;
+   const teams = results;

    // ... rest of component
  }
```

---

## Quick Reference

### paginationOpts Shape

```typescript
type PaginationOpts = {
  numItems: number;     // Max items per page
  cursor: string | null; // null for first page
};
```

### Paginated Query Return Shape

```typescript
type PaginatedResult<T> = {
  page: T[];              // Current page items
  isDone: boolean;        // true if no more pages
  continueCursor: string; // Cursor for next page (even if isDone)
};
```

### usePaginatedQuery Status Values

| Status | Meaning |
|--------|---------|
| `"LoadingFirstPage"` | Initial load in progress |
| `"CanLoadMore"` | More pages available |
| `"LoadingMore"` | Loading additional page |
| `"Exhausted"` | All pages loaded |

---

## Reference Implementations

Correct implementation examples in this codebase:

- `convex/sessions.ts` - `listSessions` query uses `paginationOptsValidator`
- `convex/teams.ts` - `listTeams` query uses `paginationOptsValidator`
- `src/routes/admin/teams.tsx` - Uses `usePaginatedQuery` with load more button

---

## See Also

### Related Documentation

- [docs/convex_rules.md](../../convex_rules.md) - Convex coding guidelines (Pagination section)
- [Convex Pagination Docs](https://docs.convex.dev/database/pagination) - Official pagination guide
- [usePaginatedQuery API](https://docs.convex.dev/api/modules/react#usepaginatedquery) - Frontend hook reference

### External Resources

- [Convex Blog: Reactive Pagination](https://stack.convex.dev/pagination) - Deep dive on gapless pagination
- [Convex Pagination Tutorial](https://docs.convex.dev/database/pagination) - Step-by-step guide
