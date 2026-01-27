---
status: done
priority: p3
issue_id: "021"
tags: [code-review, api, agent-native, convex]
dependencies: []
---

# Add getAdmin Query for Single Admin Lookup

## Problem Statement

There is no query to fetch a single admin by ID. The UI works around this by fetching all admins via `listAdmins`, but an agent needing to verify a specific admin's state must do the same client-side filtering.

**Why it matters:** Agent workflows are less efficient without direct single-entity lookups.

## Findings

**Source:** agent-native-reviewer agent

**Current API surface:**
- `getMe` - Get current admin
- `listAdmins` - Get all admins
- `isEmailWhitelisted` - Check if email is whitelisted (boolean)

**Missing:**
- `getAdmin(adminId)` - Get specific admin by ID
- `getAdminByEmail(email)` - Get specific admin by email

## Proposed Solutions

### Option 1: Add getAdmin query (Recommended)

**Approach:** Add a simple query for single admin lookup

```typescript
export const getAdmin = query({
  args: { adminId: v.id("admins") },
  returns: v.union(
    v.object({
      _id: v.id("admins"),
      email: v.string(),
      name: v.string(),
      avatarUrl: v.optional(v.string()),
      isRootAdmin: v.boolean(),
      lastLoginAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await ctx.db.get(args.adminId);
  },
});
```

| Aspect | Assessment |
|--------|------------|
| Effort | Small |
| Risk | Low |
| Pros | Better agent ergonomics |
| Cons | Additional API surface |

### Option 2: Add getAdminByEmail query

**Approach:** Also add email-based lookup

```typescript
export const getAdminByEmail = query({
  args: { email: v.string() },
  returns: v.union(v.object({...}), v.null()),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const normalized = normalizeEmail(args.email);
    return await ctx.db.query("admins")
      .withIndex("by_email", (q) => q.eq("email", normalized))
      .first();
  },
});
```

| Aspect | Assessment |
|--------|------------|
| Effort | Small |
| Risk | Low |
| Pros | Email is natural identifier for admin management |
| Cons | Additional API surface |

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected Files:**
- `convex/admins.ts` - Add new queries

**Database Changes:** None

## Acceptance Criteria

- [x] `getAdmin` query added for ID-based lookup
- [x] `getAdminByEmail` query added for email-based lookup (optional)
- [x] Both queries require admin authentication
- [x] Add tests for new queries

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-27 | Created during PR #44 review | Agent-native APIs need entity lookups |
| 2026-01-27 | Implemented getAdmin and getAdminByEmail queries | Added 9 tests for authorization and success cases |

## Resources

- PR #44: https://github.com/Esk3tit/wtcs-map-vote/pull/44
