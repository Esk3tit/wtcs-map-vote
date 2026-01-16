---
status: resolved
priority: p2
issue_id: "015"
tags: [code-review, convex, audit, pr-21]
dependencies: []
---

# Missing Return Validators on Audit Queries

## Problem Statement

The `getSessionAuditLog` and `getRecentLogs` queries in `convex/audit.ts` are missing `returns` validators. This violates the project's Convex rules documented in `docs/convex_rules.md` (line 101): "ALWAYS include argument and return validators for all Convex functions."

**Why it matters:**
- Inconsistent with existing patterns (e.g., `getSession` has return validators)
- Reduced type safety for frontend consumers
- Violates documented project conventions

## Findings

**Source:** architecture-strategist agent, pattern-recognition-specialist agent, PR #21 review

**Location:** `/convex/audit.ts` lines 151-164, 179-193

```typescript
// getSessionAuditLog - missing returns validator
export const getSessionAuditLog = query({
  args: {
    sessionId: v.id("sessions"),
    paginationOpts: paginationOptsValidator,
  },
  // MISSING: returns: v.object({...})
  handler: async (ctx, args) => {...},
});

// getRecentLogs - missing returns validator
export const getRecentLogs = query({
  args: {...},
  // MISSING: returns: v.array(...)
  handler: async (ctx, args) => {...},
});
```

**Comparison with existing code:**
```typescript
// sessions.ts line 138-142 - has returns validator
export const getSession = query({
  args: { sessionId: v.id("sessions") },
  returns: v.union(sessionWithRelationsValidator, v.null()),
  handler: async (ctx, args) => {...}
});
```

## Proposed Solutions

### Solution 1: Add Return Validators (Recommended)

**Pros:** Matches project conventions, improves type safety
**Cons:** Slightly more code
**Effort:** Small
**Risk:** Low

```typescript
const auditLogValidator = v.object({
  _id: v.id("auditLogs"),
  _creationTime: v.number(),
  sessionId: v.id("sessions"),
  action: v.string(),
  actorType: actorTypeValidator,
  actorId: v.optional(v.string()),
  details: auditDetailsValidator,
  timestamp: v.number(),
});

export const getSessionAuditLog = query({
  args: {...},
  returns: v.object({
    page: v.array(auditLogValidator),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {...},
});

export const getRecentLogs = query({
  args: {...},
  returns: v.array(auditLogValidator),
  handler: async (ctx, args) => {...},
});
```

## Recommended Action

**RESOLVED**: Added `returns` validators to both `getSessionAuditLog` and `getRecentLogs` queries using an `auditLogValidator` that matches the auditLogs table schema.

## Technical Details

**Affected Files:**
- `convex/audit.ts` (lines 151-164, 179-193)

**Reference:**
- `docs/convex_rules.md` line 101

## Acceptance Criteria

- [ ] `getSessionAuditLog` has `returns` validator
- [ ] `getRecentLogs` has `returns` validator
- [ ] TypeScript build passes
- [ ] Validators match actual return structure

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-16 | Created from PR #21 review | Project convention requires all functions have return validators |
| 2026-01-16 | Resolved: Added return validators | Created auditLogValidator and added returns to both queries |

## Resources

- PR: https://github.com/Esk3tit/wtcs-map-vote/pull/21
- docs/convex_rules.md
