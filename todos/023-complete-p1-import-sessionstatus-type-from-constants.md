---
status: complete
priority: p1
issue_id: "023"
tags: [code-review, testing, typescript, maps]
dependencies: []
---

# Import SessionStatus Type from Constants

## Problem Statement

The `maps.test.ts` file defines a local `SessionStatus` type that duplicates the type already available in `convex/lib/constants.ts`. This violates DRY principles and risks type drift if the authoritative source changes.

## Findings

**Source:** Kieran TypeScript Reviewer, Pattern Recognition Specialist

**Location:** `convex/maps.test.ts` lines 17-24

**Evidence:**
```typescript
// Current: Duplicated type definition
type SessionStatus =
  | "DRAFT"
  | "WAITING"
  | "IN_PROGRESS"
  | "PAUSED"
  | "COMPLETE"
  | "EXPIRED";
```

**Reference:** `convex/lib/constants.ts` defines `ACTIVE_SESSION_STATUSES` which should be the source of truth.

## Proposed Solutions

### Option A: Import SessionStatus from constants (Recommended)

```typescript
import { SessionStatus } from "./lib/constants";
// Or derive from ACTIVE_SESSION_STATUSES
```

**Pros:** Single source of truth, automatic sync with production code
**Cons:** May need to export type from constants if not already
**Effort:** Small (5 minutes)
**Risk:** Low

### Option B: Keep Local Type with Comment

Add a comment explaining it mirrors the constant.

**Pros:** No changes to lib files
**Cons:** Still duplicated, can drift
**Effort:** Minimal
**Risk:** Medium (type drift)

## Recommended Action

Option A - Import from constants module

## Technical Details

**Affected Files:**
- `convex/maps.test.ts`
- `convex/lib/constants.ts` (may need export)

## Acceptance Criteria

- [ ] `SessionStatus` type imported from `convex/lib/constants`
- [ ] Local type definition removed
- [ ] All tests pass

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-19 | Created during PR #28 review | TypeScript type duplication detected |
| 2026-01-19 | Approved in triage | Ready to implement Option A |

## Resources

- PR #28: https://github.com/Esk3tit/wtcs-map-vote/pull/28
- Constants module: `convex/lib/constants.ts`
