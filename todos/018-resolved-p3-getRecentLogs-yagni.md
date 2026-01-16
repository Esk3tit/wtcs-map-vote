---
status: resolved
priority: p3
issue_id: "018"
tags: [code-review, simplicity, audit, pr-21]
dependencies: []
---

# getRecentLogs Query May Be YAGNI

## Problem Statement

The `getRecentLogs` query in `convex/audit.ts` (lines 179-193) duplicates functionality already available via `getSessionAuditLog` with pagination. No frontend exists yet to use it.

**Why it matters:**
- YAGNI (You Aren't Gonna Need It) - adds code without current use case
- The paginated query can serve "get recent N" by using `initialNumItems: 20`
- More API surface to maintain

## Findings

**Source:** simplicity-reviewer agent, PR #21 review

**Current state:**
```typescript
// Two ways to get recent logs:

// 1. Paginated (already exists)
const { results } = usePaginatedQuery(
  api.audit.getSessionAuditLog,
  { sessionId },
  { initialNumItems: 20 }  // Gets last 20
);

// 2. getRecentLogs (new, redundant)
const logs = useQuery(api.audit.getRecentLogs, { sessionId, limit: 20 });
```

**Lines added:** 16 LOC for essentially duplicate functionality

## Proposed Solutions

### Solution 1: Keep As-Is (Accept)

**Pros:** Simpler API for non-paginated use cases, explicit limit enforcement
**Cons:** Redundant with pagination
**Effort:** None
**Risk:** Low

### Solution 2: Remove getRecentLogs

**Pros:** Simpler API surface, follows YAGNI
**Cons:** Less convenient for simple use cases
**Effort:** Small
**Risk:** Low

### Solution 3: Defer Decision

**Pros:** Keep until frontend is built, then decide
**Cons:** May accumulate more unused code
**Effort:** None
**Risk:** Low

## Recommended Action

**RESOLVED**: Accepted Solution 1 (Keep As-Is). The `getRecentLogs` query provides a simpler API for non-paginated use cases with explicit limit enforcement (capped at 100). The docstring clearly documents when to use it vs the paginated query.

## Technical Details

**Affected Files:**
- `convex/audit.ts` (lines 179-193)

## Acceptance Criteria

- [ ] Decision made on whether to keep or remove
- [ ] If removed: no breaking changes (no current consumers)
- [ ] If kept: document when to use each query

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-16 | Created from PR #21 review | Consider YAGNI but also API convenience |
| 2026-01-16 | Resolved: Kept as-is | API convenience justified; well-documented |

## Resources

- PR: https://github.com/Esk3tit/wtcs-map-vote/pull/21
