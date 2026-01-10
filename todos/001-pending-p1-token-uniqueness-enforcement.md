---
status: pending
priority: p1
issue_id: "001"
tags: [code-review, security, data-integrity, convex]
dependencies: []
---

# Token Uniqueness Enforcement

## Problem Statement

The `sessionPlayers.token` field uses an index (`by_token`) for lookups but Convex indexes do not enforce uniqueness at the database level. Multiple sessionPlayers could theoretically have the same token value, leading to security vulnerabilities.

**Why it matters:** If tokens collide, one player could authenticate as another player, or `.unique()` queries would throw errors.

## Findings

**Source:** Security Sentinel, Data Integrity Guardian reviews

**Location:** `convex/schema.ts:74, 82`

```typescript
sessionPlayers: defineTable({
  // ...
  token: v.string(),
  // ...
}).index("by_token", ["token"]),
```

**Evidence:**
- Convex documentation confirms indexes do not enforce uniqueness
- Token is the primary authentication mechanism for players (spec Section 2.5)
- Spec Section 12.1 mentions using `crypto.randomUUID()` which has negligible collision risk, but enforcement is still needed

## Proposed Solutions

### Option A: Mutation-level validation (Recommended)
**Pros:** Simple, explicit, follows Convex patterns
**Cons:** Must be applied consistently to all mutations that create/update tokens
**Effort:** Small
**Risk:** Low

```typescript
// In createSessionPlayer mutation:
const existingPlayer = await ctx.db
  .query("sessionPlayers")
  .withIndex("by_token", (q) => q.eq("token", args.token))
  .first();
if (existingPlayer) {
  throw new Error("Token collision - regenerate");
}
```

### Option B: Token hashing
**Pros:** Defense in depth, prevents token exposure in DB dumps
**Cons:** More complex, requires hash comparison
**Effort:** Medium
**Risk:** Low

Store SHA-256 hash of token instead of plaintext.

## Recommended Action

Option A - Add validation in mutations that create sessionPlayers.

## Technical Details

**Affected files:**
- `convex/sessions.ts` (when created)
- Any mutation that generates player tokens

**Components:** Convex mutations

## Acceptance Criteria

- [ ] All mutations that create sessionPlayers check for token uniqueness
- [ ] Collision throws descriptive error
- [ ] Test case for collision handling

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-09 | Identified in code review | Convex indexes don't enforce uniqueness |

## Resources

- [PR #11](https://github.com/Esk3tit/wtcs-map-vote/pull/11)
- docs/SPECIFICATION.md Section 12.1 (Authentication & Authorization)
- Convex docs on indexes
