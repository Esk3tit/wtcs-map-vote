---
status: pending
priority: p1
issue_id: "003"
tags: [code-review, data-integrity, convex, architecture]
dependencies: []
---

# Cascade Delete Strategy for Sessions

## Problem Statement

The schema has no mechanism to handle session deletion. If a session is deleted directly, all related records in `sessionPlayers`, `sessionMaps`, `votes`, and `auditLogs` become orphans with invalid `sessionId` references.

**Why it matters:** Orphaned records waste storage, cause query inconsistencies, and break referential integrity.

## Findings

**Source:** Data Integrity Guardian review

**Location:** `convex/schema.ts:33-67` (sessions) and related tables

**Relationships that require cascade handling:**
```
sessions
  ├── sessionPlayers (sessionId)
  │     └── votes (playerId)
  ├── sessionMaps (sessionId)
  │     └── votes (mapId)
  ├── auditLogs (sessionId)
  └── votes (sessionId)
```

## Proposed Solutions

### Option A: Internal cascade delete helper (Recommended)
**Pros:** Explicit, atomic, testable
**Cons:** Must use this helper instead of direct `ctx.db.delete()`
**Effort:** Medium
**Risk:** Low

```typescript
export const deleteSessionWithCascade = internalMutation({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    // 1. Delete votes (references both sessionPlayers and sessionMaps)
    const votes = await ctx.db.query("votes")
      .withIndex("by_sessionId_and_round", q => q.eq("sessionId", args.sessionId))
      .collect();
    await Promise.all(votes.map(v => ctx.db.delete(v._id)));

    // 2. Delete sessionPlayers
    const players = await ctx.db.query("sessionPlayers")
      .withIndex("by_sessionId", q => q.eq("sessionId", args.sessionId))
      .collect();
    await Promise.all(players.map(p => ctx.db.delete(p._id)));

    // 3. Delete sessionMaps
    const maps = await ctx.db.query("sessionMaps")
      .withIndex("by_sessionId", q => q.eq("sessionId", args.sessionId))
      .collect();
    await Promise.all(maps.map(m => ctx.db.delete(m._id)));

    // 4. Delete auditLogs (optional - may want to retain)
    // 5. Finally delete session
    await ctx.db.delete(args.sessionId);
  },
});
```

### Option B: Soft delete with status
**Pros:** Preserves historical data
**Cons:** More complex queries, storage not freed
**Effort:** Medium
**Risk:** Low

Add `deletedAt: v.optional(v.number())` to sessions table.

## Recommended Action

Option A for actual deletion, but document when soft delete (status: EXPIRED) is preferred.

## Technical Details

**Affected files:**
- `convex/sessions.ts` (when created)
- `convex/lib/helpers.ts` (cascade delete helper)

## Acceptance Criteria

- [ ] No direct session deletion - use cascade helper
- [ ] All child records deleted before parent
- [ ] Audit logs retention policy documented
- [ ] Tests verify no orphans after deletion

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-09 | Identified in code review | Convex has no automatic cascade |

## Resources

- [PR #11](https://github.com/Esk3tit/wtcs-map-vote/pull/11)
- docs/SPECIFICATION.md Section 8.7 (Scheduled Functions)
- docs/convex_rules.md
