---
title: "N+1 Query Pattern in Convex - Query Inversion Solution"
category: performance-issues
tags: [convex, n-plus-one, index, query-optimization, database, full-table-scan]
date: 2026-01-12
severity: medium
component: convex/teams.ts
symptoms:
  - deleteTeam function would slow down as historical sessions accumulate
  - O(n * m) query complexity scanning all sessions then all players per session
  - Potential timeout with 5000+ sessions (estimated ~5001 DB queries)
  - Latency scaling: 50 sessions ~250ms, 500 sessions ~2.5s, 5000+ sessions timeout
---

# N+1 Query Optimization in Convex: Query Inversion Pattern

## Problem Statement

The `deleteTeam` mutation needed to check if a team was used in any active session before allowing deletion. The original implementation performed a full table scan of all sessions, then iterated through each session to query its players - a classic N+1 query anti-pattern.

**Symptoms:**
- Delete operation latency increased linearly with historical data
- Potential timeout failures as the database grew
- Unnecessary database reads for completed/expired sessions

## Root Cause

The original query strategy was **entity-centric** rather than **relationship-centric**:

```typescript
// BEFORE: O(n * m) complexity where n = sessions, m = players/session
const allSessions = await ctx.db.query("sessions").collect();  // Full table scan!
const activeStatuses = ["DRAFT", "WAITING", "IN_PROGRESS", "PAUSED"];

for (const session of allSessions) {
  if (!activeStatuses.includes(session.status)) continue;  // Filter AFTER fetching

  const players = await ctx.db
    .query("sessionPlayers")
    .withIndex("by_sessionId", (q) => q.eq("sessionId", session._id))
    .collect();  // N+1: One query per session

  if (players.some(p => p.teamName === team.name)) {
    throw new ConvexError("Team in active session");
  }
}
```

**Performance degradation:**

| Sessions | Players/Session | DB Queries | Estimated Latency |
|----------|-----------------|------------|-------------------|
| 50       | 8               | 51         | ~250ms            |
| 500      | 8               | 501        | ~2.5s             |
| 5000     | 8               | 5001       | **TIMEOUT**       |

## Solution

The fix **inverted the query direction** - instead of searching FROM sessions TO players, search FROM players (filtered by team) TO sessions:

```typescript
// AFTER: O(k) complexity where k = players in target team
// Step 1: Query players by teamName using index (single indexed query)
const playersInTeam = await ctx.db
  .query("sessionPlayers")
  .withIndex("by_teamName", (q) => q.eq("teamName", team.name))
  .collect();

if (playersInTeam.length > 0) {
  // Step 2: Batch-fetch only the relevant sessions
  const sessionIds = [...new Set(playersInTeam.map((p) => p.sessionId))];
  const sessions = await Promise.all(
    sessionIds.map((id) => ctx.db.get(id))  // Parallel fetches by ID
  );

  // Step 3: Check if any are active
  const activeSession = sessions.find(
    (session) => session && ACTIVE_SESSION_STATUSES.has(session.status)
  );

  if (activeSession) {
    throw new ConvexError(
      `Cannot delete team "${team.name}": used in active session "${activeSession.matchName}"`
    );
  }
}
```

**Schema requirement:** Added the `by_teamName` index to `sessionPlayers`:

```typescript
// convex/schema.ts
sessionPlayers: defineTable({
  sessionId: v.id("sessions"),
  teamName: v.string(),
  // ... other fields
})
  .index("by_sessionId", ["sessionId"])
  .index("by_token", ["token"])
  .index("by_teamName", ["teamName"])  // NEW: Enables O(1) team lookup
```

## Key Insight: The Query Inversion Pattern

When checking relationships between entities, **start from the more selective side**:

| Query Strategy | When to Use |
|----------------|-------------|
| **Session → Players** (original) | When you need ALL players for known sessions |
| **Players → Sessions** (optimized) | When you need sessions for a specific team/player attribute |

**The pattern:**
1. Identify what you're actually filtering by (team name)
2. Add an index on that field if it doesn't exist
3. Query the child table (sessionPlayers) with the filter FIRST
4. Batch-fetch parent records (sessions) using `Promise.all` + `db.get(id)`
5. Filter the small result set in memory

**Performance after fix:**

| Team Usage | DB Queries | Estimated Latency |
|------------|------------|-------------------|
| Team in 0 sessions | 1 | ~5ms |
| Team in 5 sessions | 6 | ~30ms |
| Team in 50 sessions | 51 | ~250ms |

---

## Best Practices Checklist

### When to Add Indexes

- **Equality queries on a field** - Any `.filter(q => q.eq("field", value))` should use `.withIndex()`
- **Common filter patterns** - Document query patterns in your spec, then add indexes upfront
- **Foreign key relationships** - Add indexes on foreign key fields used for joins
- **Scheduled job queries** - Token cleanup, heartbeat monitoring need indexes on time fields

### When to Use `withIndex()` vs `filter()`

| Use Case | Approach | Why |
|----------|----------|-----|
| Equality on indexed field | `withIndex()` | O(1) lookup, not O(n) scan |
| Range queries on indexed field | `withIndex()` with `.gt()`, `.lt()` | Index supports range |
| One-off admin queries | `filter()` acceptable | Low frequency, small data |
| User-facing queries | Always `withIndex()` | Must scale |

**Convex Rule:** From `docs/convex_rules.md`:
> Do NOT use `filter` in queries. Instead, define an index in the schema and use `withIndex` instead.

### Batch Fetching with Promise.all

Always use `Promise.all` for parallel database operations:

```typescript
// WRONG: Sequential fetches
for (const id of sessionIds) {
  const session = await ctx.db.get(id);  // Blocks each iteration
}

// RIGHT: Parallel fetches
const sessions = await Promise.all(
  sessionIds.map((id) => ctx.db.get(id))
);
```

---

## Code Review Checklist

When reviewing Convex PRs, flag these patterns:

### Red Flags (Must Fix)

- [ ] **Nested loops with db queries** - N+1 pattern
- [ ] **`.filter()` on unindexed fields** - Full table scan
- [ ] **`.collect()` without `.take(n)` on large tables** - Unbounded collection
- [ ] **Sequential awaits in loops** - Sequential fetches

### Review Questions

1. "What happens when this table has 10,000 rows?"
2. "How many database queries does this function make?"
3. "Can we query from the other side of this relationship?"
4. "Is there an index for this query pattern?"

---

## Quick Reference

### Pattern: Check if Parent Has Children

```typescript
// Instead of querying all parents then checking children...
// Query children first, batch-fetch unique parents

const children = await ctx.db.query("children")
  .withIndex("by_parentField", q => q.eq("parentField", targetValue))
  .collect();

const parentIds = [...new Set(children.map(c => c.parentId))];
const parents = await Promise.all(parentIds.map(id => ctx.db.get(id)));
```

### Pattern: Cascade Delete

```typescript
// 1. Collect all children (indexed queries)
// 2. Delete in dependency order (children before parents)
// 3. Use Promise.all for parallelism

await Promise.all(grandchildren.map(gc => ctx.db.delete(gc._id)));
await Promise.all(children.map(c => ctx.db.delete(c._id)));
await ctx.db.delete(parentId);
```

---

## Files Modified

- `convex/schema.ts` - Added `by_teamName` index (line 79)
- `convex/teams.ts` - Refactored `deleteTeam` and `updateTeam` mutations

---

## See Also

### Related Documentation

- [docs/convex_rules.md](../../convex_rules.md) - Convex coding guidelines (Query Guidelines section)
- [docs/SPECIFICATION.md](../../SPECIFICATION.md) - Database schema and index definitions

### Related Todos

- [todos/004 - Missing Performance Indexes](../../../todos/004-completed-p2-missing-performance-indexes.md) - Added 4 indexes for common query patterns
- [todos/010 - deleteTeam Performance](../../../todos/010-completed-p2-deleteteam-performance.md) - The original issue for this fix
- [todos/003 - Cascade Delete Strategy](../../../todos/003-completed-p1-cascade-delete-strategy.md) - Bulk delete operations using Promise.all pattern

### Pull Requests

- [PR #14](https://github.com/Esk3tit/wtcs-map-vote/pull/14) - Teams CRUD implementation where this N+1 issue was identified and fixed

### External Resources

- [Convex Indexes](https://docs.convex.dev/database/indexes) - How to design and use indexes effectively
- [Convex Query Performance](https://docs.convex.dev/database/reading-data#performance) - Best practices for efficient queries
