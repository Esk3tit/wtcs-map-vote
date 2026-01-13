---
status: completed
priority: p2
issue_id: "010"
tags: [code-review, performance, convex]
dependencies: []
---

# Inefficient deleteTeam Query Pattern

## Problem Statement

The `deleteTeam` function fetches ALL sessions, then iterates through each, querying players for each session. This is O(n * m) complexity where n = total sessions and m = players per session.

**Why it matters:** As the system accumulates historical sessions, delete operations will become increasingly slow, potentially timing out.

## Findings

**Source:** Performance Oracle review of PR #14

**Location:** `convex/teams.ts` lines 132-149

```typescript
const allSessions = await ctx.db.query("sessions").collect();  // Full table scan
const activeStatuses = ["DRAFT", "WAITING", "IN_PROGRESS", "PAUSED"];

for (const session of allSessions) {
  if (!activeStatuses.includes(session.status)) continue;

  const players = await ctx.db
    .query("sessionPlayers")
    .withIndex("by_sessionId", (q) => q.eq("sessionId", session._id))
    .collect();  // N+1 query pattern
  // ...
}
```

**Projected Impact:**
| Sessions | Players/Session | DB Queries | Estimated Latency |
|----------|-----------------|------------|-------------------|
| 50       | 8               | 51         | ~250ms            |
| 500      | 8               | 501        | ~2.5s             |
| 5000     | 8               | 5001       | TIMEOUT           |

## Proposed Solutions

### Option A: Query only active sessions using by_status index (Recommended)
**Pros:** Uses existing index, minimal change
**Cons:** Still N+1 pattern but with smaller N
**Effort:** Small
**Risk:** Low

```typescript
const activeStatuses = ["DRAFT", "WAITING", "IN_PROGRESS", "PAUSED"] as const;

for (const status of activeStatuses) {
  const sessions = await ctx.db
    .query("sessions")
    .withIndex("by_status", (q) => q.eq("status", status))
    .collect();

  for (const session of sessions) {
    const players = await ctx.db
      .query("sessionPlayers")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", session._id))
      .collect();
    // ...
  }
}
```

### Option B: Add by_teamName index to sessionPlayers
**Pros:** O(1) team lookup
**Cons:** Schema migration, additional index storage
**Effort:** Medium
**Risk:** Low

```typescript
// In schema.ts
sessionPlayers: defineTable({...})
  .index("by_teamName", ["teamName"])

// In deleteTeam
const playersWithTeam = await ctx.db
  .query("sessionPlayers")
  .withIndex("by_teamName", (q) => q.eq("teamName", team.name))
  .first();
```

## Recommended Action

Option A for now - use `by_status` index. Consider Option B if delete performance becomes critical.

## Technical Details

**Affected files:**
- `convex/teams.ts` (deleteTeam)
- Optionally `convex/schema.ts` for new index

## Acceptance Criteria

- [x] deleteTeam only queries active sessions (not COMPLETE/EXPIRED)
- [x] Performance is acceptable with 100+ historical sessions
- [x] Functionality unchanged - still blocks delete if team in active session

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-12 | Identified in PR #14 code review | Full table scan issue |
| 2026-01-12 | Fixed in commit bd980d2 | Inverted query: filter sessionPlayers by teamName first, then batch-fetch sessions |

## Resources

- [PR #14](https://github.com/Esk3tit/wtcs-map-vote/pull/14)
- convex/schema.ts (by_status index exists)
