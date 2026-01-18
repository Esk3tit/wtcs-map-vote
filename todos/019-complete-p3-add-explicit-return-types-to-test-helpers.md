---
status: complete
priority: p3
issue_id: "019"
tags: [code-review, testing, typescript]
dependencies: ["017"]
---

# Add Explicit Return Types to Test Helpers

## Problem Statement

The test helper functions rely on TypeScript inference for return types instead of explicit type annotations. This can lead to type drift if the implementation changes.

## Findings

**Source:** Kieran TypeScript Reviewer

**Location:** `convex/teams.test.ts` lines 25-45

**Evidence:**
```typescript
// Current: Inferred return type
async function createTeamInActiveSession(
  t: ReturnType<typeof createTestContext>,
  status: "DRAFT" | "WAITING" | "IN_PROGRESS" | "PAUSED" = "IN_PROGRESS"
) {
  return await t.run(async (ctx) => {
    // ...
    return { teamId, sessionId, adminId };
  });
}
```

## Proposed Solutions

### Option A: Add Explicit Return Types (Recommended)

```typescript
import { Id } from "./_generated/dataModel";

async function createTeamInActiveSession(
  t: ReturnType<typeof createTestContext>,
  status: "DRAFT" | "WAITING" | "IN_PROGRESS" | "PAUSED" = "IN_PROGRESS"
): Promise<{
  teamId: Id<"teams">;
  sessionId: Id<"sessions">;
  adminId: Id<"admins">;
}> {
```

**Pros:** Explicit contract, catches type drift
**Cons:** Slightly more verbose
**Effort:** Small (10 minutes)
**Risk:** Low

## Recommended Action

Option A - Add explicit return types (can be done when consolidating helpers in #017)

## Technical Details

**Affected Files:**
- `convex/teams.test.ts`

## Acceptance Criteria

- [ ] Helper functions have explicit return types
- [ ] `Id` type is imported from `_generated/dataModel`

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-18 | Created during code review | Type safety improvement |
| 2026-01-18 | Approved in triage | Ready to implement with #017 |

## Resources

- PR #27: https://github.com/Esk3tit/wtcs-map-vote/pull/27
