---
status: complete
priority: p3
issue_id: "038"
tags: [code-review, guard, defensive-programming]
dependencies: []
---

# Add player count validation to `guardStart`

## Problem Statement
`guardStart` only checks player connectivity but not player count. With 0 players, `disconnected.length === 0` evaluates true, so the guard passes silently. This is inconsistent with `guardFinalize` which does check player count.

## Findings
- Location: `convex/lib/sessionLifecycle.ts:94-110`
- Flagged by 2/6 review agents (Pattern Recognition, TypeScript)
- Edge case: if players are deleted between finalize and start, guardStart wouldn't catch it
- Test at line 489-503 documents this as expected behavior but it's arguably a gap

## Proposed Solutions

### Option 1: Add player count check before connectivity check
- **Pros**: Consistent with guardFinalize, more defensive
- **Cons**: Slightly redundant if guardFinalize always precedes
- **Effort**: Small
- **Risk**: Low

```typescript
if (players.length !== session.playerCount) {
  throw new ConvexError(
    `Cannot start: ${players.length} of ${session.playerCount} players assigned`
  );
}
```

## Recommended Action
Add the check. Update the edge case test to expect a throw instead of passing.

## Technical Details
- **Affected Files**: `convex/lib/sessionLifecycle.ts`, `convex/sessionLifecycle.test.ts`
- **Database Changes**: No

## Acceptance Criteria
- [ ] Player count validated in `guardStart`
- [ ] Edge case test updated (0 players now throws)
- [ ] All tests pass

## Work Log

### 2026-02-11 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session (auto-approved)

## Notes
Source: PR #59 code review triage on 2026-02-11
