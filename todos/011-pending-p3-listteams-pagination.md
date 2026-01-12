---
status: pending
priority: p3
issue_id: "011"
tags: [code-review, performance, convex]
dependencies: []
---

# Add Pagination to listTeams

## Problem Statement

The `listTeams` query returns ALL teams without pagination using `.collect()`. With a growing team registry, this could cause performance degradation and memory issues.

**Why it matters:** Unbounded queries can cause slow responses and client-side memory issues as data grows.

## Findings

**Source:** Performance Oracle, Security Sentinel reviews of PR #14

**Location:** `convex/teams.ts` lines 18-24

```typescript
handler: async (ctx) => {
  return await ctx.db
    .query("teams")
    .withIndex("by_name")
    .order("asc")
    .collect();  // Returns ALL teams
},
```

## Proposed Solutions

### Option A: Add optional pagination (Recommended for future)
**Pros:** Flexible, backwards compatible
**Cons:** Requires frontend changes to handle pagination
**Effort:** Medium
**Risk:** Low

```typescript
export const listTeams = query({
  args: {
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  returns: v.object({
    teams: v.array(v.object({...})),
    nextCursor: v.union(v.string(), v.null()),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;
    const results = await ctx.db
      .query("teams")
      .withIndex("by_name")
      .order("asc")
      .paginate({ numItems: limit, cursor: args.cursor ?? null });

    return {
      teams: results.page,
      nextCursor: results.continueCursor,
      isDone: results.isDone,
    };
  },
});
```

### Option B: Add simple limit with .take()
**Pros:** Minimal change, no cursor management
**Cons:** Can't load more items
**Effort:** Small
**Risk:** Low

```typescript
.take(100)  // Limit to 100 teams
```

## Recommended Action

Defer - current scale (~20-100 teams) doesn't require pagination. Revisit if team count exceeds 100.

## Technical Details

**Affected files:**
- `convex/teams.ts` (listTeams)
- Frontend components consuming listTeams

## Acceptance Criteria

- [ ] listTeams returns bounded results
- [ ] Frontend can load more teams if needed
- [ ] Existing functionality works for reasonable team counts

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-12 | Identified in PR #14 code review | Future scalability concern |

## Resources

- [PR #14](https://github.com/Esk3tit/wtcs-map-vote/pull/14)
- docs/convex_rules.md (pagination patterns)
