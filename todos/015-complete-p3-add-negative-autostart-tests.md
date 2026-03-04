---
status: complete
priority: p3
issue_id: "015"
tags: [code-review, testing, auto-start]
dependencies: []
---

# Add Negative Tests for Auto-Start

## Problem Statement

The current test suite has a positive auto-start test (all players ready → session starts) but lacks negative test cases to verify auto-start does **not** fire when conditions aren't met.

## Findings

**Agent:** pattern-recognition-specialist

**Evidence:**
- `convex/playerAuth.test.ts` — has "starts session when all players are ready and connected" test
- Missing: test for disconnected player blocking auto-start
- Missing: test for not-all-players-assigned blocking auto-start
- Missing: test for session already started (idempotency)

## Proposed Solutions

### Option A: Add 3 Negative Test Cases

```typescript
it("does not auto-start when a player is disconnected", async () => { ... });
it("does not auto-start when not all players are assigned", async () => { ... });
it("does not auto-start when session is already IN_PROGRESS", async () => { ... });
```

- **Pros:** Comprehensive coverage of auto-start guard conditions
- **Cons:** More test code
- **Effort:** Small
- **Risk:** None

## Recommended Action

_To be decided during triage._

## Acceptance Criteria

- [ ] Test: disconnected player prevents auto-start
- [ ] Test: fewer players than `playerCount` prevents auto-start
- [ ] Test: session already IN_PROGRESS prevents duplicate auto-start
- [ ] All tests pass

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-03 | Created from code review of PR #98 | Only positive auto-start test exists |
| 2026-03-03 | Approved during triage — batch approved | Ready to work on |

## Resources

- PR #98: https://github.com/Esk3tit/wtcs-map-vote/pull/98
- `convex/playerAuth.test.ts` — existing auto-start test
