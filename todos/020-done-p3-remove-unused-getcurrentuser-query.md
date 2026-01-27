---
status: done
priority: p3
issue_id: "020"
tags: [code-review, quality, yagni, convex]
dependencies: []
---

# Remove Unused getCurrentUser Query

## Problem Statement

The `getCurrentUser` query in `convex/admins.ts` duplicates functionality provided by `getMe` and is not used anywhere in the codebase.

**Why it matters:** Unused code adds maintenance burden and confusion about which API to use.

## Findings

**Source:** code-simplicity-reviewer agent

**Evidence from `/convex/admins.ts` (lines 53-72):**
```typescript
export const getCurrentUser = query({
  args: {},
  returns: v.union(
    v.object({
      name: v.string(),
      email: v.optional(v.string()),
      picture: v.optional(v.string()),
    }),
    v.null()
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    return {
      name: identity.name ?? "Admin",
      email: identity.email ?? undefined,
      picture: identity.pictureUrl ?? undefined,
    };
  },
});
```

**Comparison:**
- `getCurrentUser` returns basic identity info (name, email, picture)
- `getMe` returns full admin info including `isRootAdmin`, `_id`, `lastLoginAt`

**Usage in codebase:**
- `getCurrentUser`: Not imported anywhere
- `getMe`: Used in sidebar and settings page

## Proposed Solutions

### Option 1: Remove getCurrentUser (Recommended)

**Approach:** Delete the unused query

| Aspect | Assessment |
|--------|------------|
| Effort | Small |
| Risk | Low - not used anywhere |
| Pros | -20 LOC, cleaner API |
| Cons | None |

### Option 2: Keep for future use

**Approach:** Document intended purpose

| Aspect | Assessment |
|--------|------------|
| Effort | None |
| Risk | None |
| Pros | Available if needed |
| Cons | YAGNI violation |

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected Files:**
- `convex/admins.ts` - Remove lines 53-72

**Database Changes:** None

## Acceptance Criteria

- [x] `getCurrentUser` query removed from admins.ts
- [x] No import errors in codebase
- [x] Tests still pass

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-27 | Created during PR #44 review | Remove unused code promptly |
| 2026-01-27 | Removed getCurrentUser query from convex/admins.ts | Simple deletion, tests pass |

## Resources

- PR #44: https://github.com/Esk3tit/wtcs-map-vote/pull/44
