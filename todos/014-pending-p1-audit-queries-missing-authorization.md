---
status: pending
priority: p1
issue_id: "014"
tags: [code-review, security, audit, pr-21]
dependencies: []
---

# Missing Authorization on Audit Log Queries

## Problem Statement

The `getSessionAuditLog` and `getRecentLogs` queries in `convex/audit.ts` are public endpoints with no authentication or authorization checks. Any unauthenticated client can read audit logs for any session by simply knowing or guessing a session ID.

**Why it matters:**
- Information disclosure: Attackers can enumerate session activity, player actions, team names, and timing information
- Session IDs in Convex are predictable, making enumeration feasible
- Audit logs may contain sensitive operational details (actorId, teamName, reason fields)

## Findings

**Source:** security-sentinel agent, PR #21 review

**Location:** `/convex/audit.ts` lines 151-193

```typescript
// Lines 151-165 - No auth check
export const getSessionAuditLog = query({
  args: {
    sessionId: v.id("sessions"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    // No authentication check!
    return await ctx.db.query("auditLogs")...
  },
});

// Lines 179-193 - Same issue
export const getRecentLogs = query({...});
```

**OWASP Classification:** A01 - Broken Access Control, A07 - Authentication Failures

## Proposed Solutions

### Solution 1: Add Admin-Only Authorization (Recommended)

**Pros:** Restricts access to admins only, consistent with other admin-facing queries
**Cons:** Requires auth system integration (currently marked as TODO)
**Effort:** Medium
**Risk:** Low

```typescript
export const getSessionAuditLog = query({
  args: {...},
  handler: async (ctx, args) => {
    // TODO: Add when auth is implemented
    // const admin = await getAdminFromAuth(ctx);
    // if (!admin) throw new ConvexError("Unauthorized");

    return await ctx.db.query("auditLogs")...
  },
});
```

### Solution 2: Add TODO Comment Acknowledging Auth Gap

**Pros:** Documents the issue, defers to auth phase
**Cons:** Leaves vulnerability open
**Effort:** Small
**Risk:** Medium - vulnerability remains

### Solution 3: Restrict to Session Creator Only

**Pros:** Limits exposure to session owners
**Cons:** Players cannot view audit logs, more complex authorization logic
**Effort:** Medium
**Risk:** Low

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected Files:**
- `convex/audit.ts` (lines 151-165, 179-193)

**Related Patterns:**
- Other queries in sessions.ts have similar TODO comments for auth
- Auth system is planned for next phase per CLAUDE.md

## Acceptance Criteria

- [ ] Queries include authentication check (or documented TODO)
- [ ] Unauthenticated requests are rejected
- [ ] Error messages don't leak information
- [ ] Tests verify auth behavior

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-16 | Created from PR #21 security review | Auth is deferred but should be documented |

## Resources

- PR: [`#21`](https://github.com/Esk3tit/wtcs-map-vote/pull/21)
- [OWASP Broken Access Control](https://owasp.org/Top10/A01_2021-Broken_Access_Control/)
- CLAUDE.md mentions auth is next phase
