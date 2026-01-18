---
status: pending
priority: p2
issue_id: "017"
tags: [code-review, testing, refactoring]
dependencies: []
---

# Consolidate Test Helper Functions

## Problem Statement

The `teams.test.ts` file defines two helper functions (`createTeamInActiveSession` and `createTeamInInactiveSession`) that share 90% identical code. This duplication increases maintenance burden and violates DRY principles.

## Findings

**Source:** Pattern Recognition Specialist, Architecture Strategist, Code Simplicity Reviewer

**Location:** `convex/teams.test.ts` lines 25-70

**Evidence:**
```typescript
// Two nearly identical functions
async function createTeamInActiveSession(
  t: ReturnType<typeof createTestContext>,
  status: "DRAFT" | "WAITING" | "IN_PROGRESS" | "PAUSED" = "IN_PROGRESS"
) {
  return await t.run(async (ctx) => {
    const adminId = await ctx.db.insert("admins", adminFactory());
    const teamId = await ctx.db.insert("teams", teamFactory({ name: "Active Team" }));
    const sessionId = await ctx.db.insert("sessions", sessionFactory(adminId, { status }));
    await ctx.db.insert("sessionPlayers", sessionPlayerFactory(sessionId, { teamName: "Active Team" }));
    return { teamId, sessionId, adminId };
  });
}

async function createTeamInInactiveSession(
  t: ReturnType<typeof createTestContext>,
  status: "COMPLETE" | "EXPIRED" = "COMPLETE"
) {
  // Nearly identical implementation...
}
```

## Proposed Solutions

### Option A: Merge into Single Function (Recommended)

Consolidate into one parameterized helper:

```typescript
type SessionStatus = "DRAFT" | "WAITING" | "IN_PROGRESS" | "PAUSED" | "COMPLETE" | "EXPIRED";

async function createTeamInSession(
  t: ReturnType<typeof createTestContext>,
  status: SessionStatus
) {
  return await t.run(async (ctx) => {
    const adminId = await ctx.db.insert("admins", adminFactory());
    const teamId = await ctx.db.insert("teams", teamFactory({ name: "Test Team" }));
    const sessionId = await ctx.db.insert("sessions", sessionFactory(adminId, { status }));
    await ctx.db.insert("sessionPlayers", sessionPlayerFactory(sessionId, { teamName: "Test Team" }));
    return { teamId, sessionId, adminId };
  });
}
```

**Pros:** Single source of truth, ~15 LOC saved, easier to maintain
**Cons:** Minor update to all calling tests
**Effort:** Small (15 minutes)
**Risk:** Low

### Option B: Keep Separate with Shared Core

Extract common logic to a private helper, keep two public functions for type safety:

**Pros:** Maintains strict type separation for active vs inactive
**Cons:** More code, added indirection
**Effort:** Small (20 minutes)
**Risk:** Low

## Recommended Action

Option A - Merge into single function

## Technical Details

**Affected Files:**
- `convex/teams.test.ts`

## Acceptance Criteria

- [ ] Single `createTeamInSession` helper function exists
- [ ] All tests using the helpers are updated
- [ ] All tests pass after refactoring

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-18 | Created during code review | Identified duplication in test helpers |

## Resources

- PR #27: https://github.com/Esk3tit/wtcs-map-vote/pull/27
