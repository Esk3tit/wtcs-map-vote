---
status: pending
priority: p2
issue_id: "012"
tags: [code-review, audit-logging, sessions, pr-20]
dependencies: []
---

# Missing Audit Log for updateSession

## Problem Statement

The `updateSession` mutation does not create an audit log entry, unlike `createSession`, `deleteSession`, `assignPlayer`, and `setSessionMaps` which all log their actions. This creates a gap in the audit trail.

## Findings

### Security Sentinel Analysis

**Location:** `/Users/khaiphan/Documents/wtcs-map-vote/convex/sessions.ts` lines 326-373

```typescript
export const updateSession = mutation({
  // ...
  handler: async (ctx, args) => {
    // ... updates session ...
    await ctx.db.patch(args.sessionId, updates);
    return { success: true };
    // NO AUDIT LOG CREATED
  },
});
```

**Compared to other mutations:**
- `createSession` logs `SESSION_CREATED` (lines 305-312)
- `deleteSession` logs `SESSION_DELETED` (lines 422-429)
- `assignPlayer` logs `PLAYER_ASSIGNED` (lines 522-530)
- `setSessionMaps` logs `MAPS_ASSIGNED` (lines 624-630)

## Proposed Solutions

### Option A: Add SESSION_UPDATED Audit Log (Recommended)

Add audit logging with before/after values:
```typescript
await ctx.db.insert("auditLogs", {
  sessionId: args.sessionId,
  action: "SESSION_UPDATED",
  actorType: "ADMIN",
  actorId: undefined, // TODO: Get from ctx.auth when integrated
  details: {
    changes: {
      ...(args.matchName !== undefined && { matchName: { from: session.matchName, to: updates.matchName } }),
      ...(args.turnTimerSeconds !== undefined && { turnTimerSeconds: { from: session.turnTimerSeconds, to: updates.turnTimerSeconds } }),
    },
  },
  timestamp: Date.now(),
});
```

**Pros:** Complete audit trail, includes what changed
**Cons:** More code, slightly larger audit logs
**Effort:** Small
**Risk:** Low

### Option B: Simple Audit Log Without Changes

Just log that an update occurred without before/after values.

**Pros:** Simpler, consistent with other mutations
**Cons:** Less detail for debugging
**Effort:** Small
**Risk:** Low

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected Files:**
- `convex/sessions.ts` - updateSession mutation

## Acceptance Criteria

- [ ] `updateSession` creates an audit log entry
- [ ] Audit log includes relevant details about the change
- [ ] Follows same pattern as other mutation audit logs

## Work Log

| Date | Action | Learning |
|------|--------|----------|
| 2026-01-14 | Created from PR #20 review | Security review identified audit gap |

## Resources

- PR #20: https://github.com/Esk3tit/wtcs-map-vote/pull/20
