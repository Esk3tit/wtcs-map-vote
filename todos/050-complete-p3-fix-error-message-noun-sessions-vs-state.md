---
status: complete
priority: p3
issue_id: "050"
tags: [code-review, error-messages, consistency]
dependencies: []
---

# Fix Error Message Noun: "sessions allowed" to "state allowed"

## Problem Statement

`requireSessionStatus()` generates error messages using "sessions allowed" as the noun:
```text
Cannot update session in IN_PROGRESS state. Only DRAFT or WAITING sessions allowed.
```

This diverges from the CLAUDE.md convention and the existing `deleteSession` error which uses "state" as the noun. "Only DRAFT or WAITING state allowed" is more precise.

## Findings

- **Pattern Recognition Specialist**: Low severity — minor wording inconsistency

### Evidence

```typescript
// convex/lib/sessionLifecycle.ts:138
throw new ConvexError(
  `Cannot ${action} in ${session.status} state. Only ${allowedList} sessions allowed.`
);
```

CLAUDE.md convention: `"Cannot update. Only DRAFT state allowed."`
`deleteSession` error: `"Cannot delete session in ${session.status} state."`

## Proposed Solutions

### Option A: Change "sessions" to "state" (Recommended)

```typescript
`Cannot ${action} in ${session.status} state. Only ${allowedList} state allowed.`
```

**Pros:** Matches CLAUDE.md convention and existing errors
**Cons:** Requires updating 4 test assertions
**Effort:** Trivial
**Risk:** None

## Technical Details

**Affected files:**
- `convex/lib/sessionLifecycle.ts` — error template (~line 138)
- `convex/sessionLifecycle.test.ts` — assertions matching "sessions allowed" pattern

## Acceptance Criteria

- [ ] Error message uses "state allowed" instead of "sessions allowed"
- [ ] Test assertions updated
- [ ] All tests pass

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-18 | Created from PR #72 code review | Pattern recognition specialist flagged convention divergence |
| 2026-02-18 | Approved for work during triage | Batch-approved with all PR #72 findings |

## Resources

- PR #72: https://github.com/Esk3tit/wtcs-map-vote/pull/72
