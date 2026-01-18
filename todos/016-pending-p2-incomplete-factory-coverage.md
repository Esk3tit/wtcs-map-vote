---
status: pending
priority: p2
issue_id: "016"
tags: [code-review, testing, factories]
dependencies: ["015"]
---

# Incomplete Factory Coverage for Database Tables

## Problem Statement

The `convex/test.factories.ts` provides factories for only 4 of 8 database tables. Missing factories for `sessionPlayers`, `sessionMaps`, `votes`, and `auditLogs` will limit test coverage for the core voting functionality.

## Findings

**Source:** Multiple Review Agents (Architecture, Pattern, TypeScript)

- Current factories: admins, teams, maps, sessions (4/8)
- Missing factories: sessionPlayers, sessionMaps, votes, auditLogs
- These missing tables represent the core voting workflow
- Tests for session functionality will need to manually create this data

**Schema analysis:**
- `sessionPlayers`: Requires `sessionId` (foreign key)
- `sessionMaps`: Requires `sessionId`, `mapId` (foreign keys)
- `votes`: Requires `sessionId`, `playerId`, `mapId` (foreign keys)
- `auditLogs`: Requires `sessionId`, `adminId` (foreign keys)

## Proposed Solutions

### Option A: Add All Missing Factories Now

Add factories for all 4 missing tables following the existing pattern:

```typescript
export const sessionPlayerFactory = (
  sessionId: Id<"sessions">,
  overrides: Partial<{...}> = {}
) => ({...});
```

**Pros:** Complete infrastructure ready for all tests
**Cons:** Factories may need adjustment when actual tests are written
**Effort:** Medium (1 hour)
**Risk:** Low

### Option B: Add Factories When Needed (Recommended)

Defer factory creation to when specific tests require them (WAR-16, WAR-17, etc.)

**Pros:** Factories designed with actual test needs in mind
**Cons:** Incomplete infrastructure until then
**Effort:** Distributed across future PRs
**Risk:** Low

## Recommended Action

Option B - Add factories as needed during specific test PRs (WAR-16 Sessions, WAR-17 SessionPlayers, etc.)

## Technical Details

**Affected Files:**
- `convex/test.factories.ts`

## Acceptance Criteria

- [ ] sessionPlayerFactory added with sessionId as required parameter
- [ ] sessionMapFactory added with sessionId, mapId as required parameters
- [ ] voteFactory added with sessionId, playerId, mapId as required parameters
- [ ] auditLogFactory added with sessionId, adminId as required parameters

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-18 | Created during code review | Identified factory gaps |

## Resources

- PR #26: https://github.com/Esk3tit/wtcs-map-vote/pull/26
- Schema: `convex/schema.ts`
