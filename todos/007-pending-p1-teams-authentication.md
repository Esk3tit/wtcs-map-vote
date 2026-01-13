---
status: pending
priority: p1
issue_id: "007"
tags: [code-review, security, authentication, convex]
dependencies: []
---

# Missing Authentication on Team Mutations

## Problem Statement

All three team mutations (`createTeam`, `updateTeam`, `deleteTeam`) are registered as public `mutation` functions but contain no authentication or authorization checks. Any anonymous user can create, modify, or delete teams.

**Why it matters:** Per the specification (Section 2.3), team management is an admin-only capability. The current implementation exposes administrative functions to the public internet.

## Findings

**Source:** Security Sentinel review of PR #14

**Location:** `convex/teams.ts` lines 30-60 (createTeam), 66-113 (updateTeam), 118-154 (deleteTeam)

```typescript
// Current - no authentication check
export const createTeam = mutation({
  args: {
    name: v.string(),
    logoUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Anyone can call this - no auth check
    const teamId = await ctx.db.insert("teams", {...});
    return { teamId };
  },
});
```

**Impact:**
- Any anonymous user can create unlimited teams
- Any anonymous user can modify or delete existing teams
- Potential for data vandalism, spam injection, or denial of service

## Proposed Solutions

### Option A: Add inline auth check to each mutation (Recommended)
**Pros:** Simple, explicit, no new abstractions
**Cons:** Repeated code in each mutation
**Effort:** Small
**Risk:** Low

```typescript
handler: async (ctx, args) => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError("Authentication required");
  }

  const admin = await ctx.db
    .query("admins")
    .withIndex("by_email", (q) => q.eq("email", identity.email))
    .first();

  if (!admin) {
    throw new ConvexError("Unauthorized: Admin access required");
  }
  // ... rest of handler
}
```

### Option B: Create shared auth helper function
**Pros:** DRY, consistent enforcement
**Cons:** Additional abstraction
**Effort:** Small
**Risk:** Low

```typescript
async function requireAdmin(ctx: MutationCtx): Promise<Doc<"admins">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError("Authentication required");

  const admin = await ctx.db
    .query("admins")
    .withIndex("by_email", (q) => q.eq("email", identity.email))
    .first();
  if (!admin) throw new ConvexError("Unauthorized");

  return admin;
}
```

## Recommended Action

Option A for now - add auth check to each mutation. Can extract to helper in follow-up if pattern repeats across other files.

## Technical Details

**Affected files:**
- `convex/teams.ts` (createTeam, updateTeam, deleteTeam)

## Acceptance Criteria

- [ ] All three mutations verify user is authenticated
- [ ] All three mutations verify user is in admins table
- [ ] Unauthenticated requests receive "Authentication required" error
- [ ] Non-admin authenticated requests receive "Unauthorized" error
- [ ] Existing functionality works for authenticated admins

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-12 | Identified in PR #14 code review | Critical security gap |

## Resources

- [PR #14](https://github.com/Esk3tit/wtcs-map-vote/pull/14)
- docs/SPECIFICATION.md Section 2.3 (Admin capabilities)
- convex/schema.ts lines 6-12 (admins table)
