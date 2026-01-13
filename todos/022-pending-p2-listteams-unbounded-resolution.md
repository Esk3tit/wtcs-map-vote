---
status: pending
priority: p2
issue_id: "022"
tags: [code-review, performance, convex, n+1]
dependencies: ["011"]
---

# N+1 Storage URL Resolution in listTeams

## Problem Statement

The `listTeams` query loads all teams without pagination and makes N separate `ctx.storage.getUrl()` calls to resolve storage URLs. While `Promise.all` parallelizes the calls, this pattern doesn't scale well and will cause performance degradation as team count grows.

## Findings

### Performance Review Finding
- **Location:** `convex/teams.ts:42-65`
- **Evidence:**
  ```typescript
  const teams = await ctx.db
    .query("teams")
    .withIndex("by_name")
    .order("asc")
    .collect();  // Loads ALL teams

  const teamsWithResolvedLogos = await Promise.all(
    teams.map(async (team) => {
      if (team.logoStorageId) {
        const resolvedUrl = await ctx.storage.getUrl(team.logoStorageId);
        return { ...team, logoUrl: resolvedUrl ?? team.logoUrl };
      }
      return team;
    })
  );
  ```

### Scale Projections
| Teams with Logos | Storage Calls | Estimated Latency |
|-----------------|---------------|-------------------|
| 10 | 10 | ~50ms |
| 50 | 50 | ~200ms |
| 200 | 200 | ~800ms+ |

### Related Issue
This compounds with the existing pagination issue tracked in `011-pending-p3-listteams-pagination.md`.

## Proposed Solutions

### Solution 1: Add Pagination (Recommended)
**Description:** Implement cursor-based pagination to limit teams per request.

```typescript
export const listTeams = query({
  args: {
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    const result = await ctx.db
      .query("teams")
      .withIndex("by_name")
      .order("asc")
      .paginate({ cursor: args.cursor ?? null, numItems: limit });

    // Resolve logos for page only (max 50 calls)
    const teamsWithLogos = await Promise.all(
      result.page.map(async (team) => { /* ... */ })
    );

    return { teams: teamsWithLogos, continueCursor: result.continueCursor };
  },
});
```

**Pros:** Bounds resource usage, scales well
**Cons:** Frontend needs pagination UI changes
**Effort:** Medium (2-3 hours)
**Risk:** Low

### Solution 2: Cache Resolved URLs in Database
**Description:** Store resolved URLs alongside storage IDs, update on access.

**Pros:** No N+1 pattern
**Cons:** URLs can expire, adds complexity
**Effort:** Medium (2 hours)
**Risk:** Medium

## Recommended Action

[To be filled during triage]

## Technical Details

**Affected Files:**
- `convex/teams.ts` - Add pagination to `listTeams`
- `src/routes/admin/teams.tsx` - Handle paginated response

**Default Page Size:** 50 teams (reasonable for admin panel)

## Acceptance Criteria

- [ ] listTeams returns paginated results
- [ ] Frontend displays pagination controls (or infinite scroll)
- [ ] Response time bounded regardless of total team count

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-13 | Created from code review | Performance agent flagged this with scale projections |

## Resources

- PR #17: https://github.com/Esk3tit/wtcs-map-vote/pull/17
- Related: `todos/011-pending-p3-listteams-pagination.md`
- Convex pagination: https://docs.convex.dev/database/pagination
