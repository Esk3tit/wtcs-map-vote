---
status: pending
priority: p1
issue_id: "002"
tags: [code-review, security, data-integrity, convex]
dependencies: []
---

# Admin Email Uniqueness Enforcement

## Problem Statement

The `admins.email` field uses an index (`by_email`) for OAuth lookups but Convex indexes do not enforce uniqueness. Multiple admin records could be created with the same email, causing authentication ambiguity.

**Why it matters:** Could lead to permission escalation if one record is root admin and another is not, or inconsistent admin state during OAuth flows.

## Findings

**Source:** Security Sentinel, Data Integrity Guardian reviews

**Location:** `convex/schema.ts:6-13`

```typescript
admins: defineTable({
  email: v.string(),
  name: v.string(),
  avatarUrl: v.optional(v.string()),
  isRootAdmin: v.boolean(),
  lastLoginAt: v.number(),
}).index("by_email", ["email"]),
```

## Proposed Solutions

### Option A: Mutation-level validation (Recommended)
**Pros:** Simple, explicit
**Cons:** Must be applied to all admin creation paths
**Effort:** Small
**Risk:** Low

```typescript
// In authenticateAdmin / addAdminToWhitelist:
const existingAdmin = await ctx.db
  .query("admins")
  .withIndex("by_email", (q) => q.eq("email", email))
  .first();
if (existingAdmin && action === "create") {
  throw new Error("Admin already exists");
}
```

## Recommended Action

Option A - Add uniqueness check in admin creation mutations.

## Technical Details

**Affected files:**
- `convex/admins.ts` (when created)

## Acceptance Criteria

- [ ] Admin creation mutations check for email uniqueness
- [ ] Duplicate email throws descriptive error
- [ ] OAuth flow handles existing admins correctly

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-09 | Identified in code review | Part of authentication flow |

## Resources

- [PR #11](https://github.com/Esk3tit/wtcs-map-vote/pull/11)
- docs/SPECIFICATION.md Section 2.5 (Authentication Flow)
