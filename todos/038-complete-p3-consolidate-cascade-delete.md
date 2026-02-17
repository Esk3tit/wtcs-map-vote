---
status: complete
priority: p3
issue_id: "038"
tags: [code-review, architecture, dry, sessions]
dependencies: []
---

# Consolidate Cascade Delete Logic

## Problem Statement

Two separate cascade delete implementations exist: inline in `deleteSession` (`convex/sessions.ts:617-642`) and `deleteSessionWithCascade` (`convex/lib/cascadeDelete.ts`). The utility version is unused in production (only has tests). The two implementations differ in deletion order (parallel vs sequential), audit log handling, and return values. If a new child table is added, both must be updated.

## Findings

- **Flagged by:** Architecture Strategist, Pattern Recognition Specialist, Performance Oracle, Data Integrity Guardian (4/7 agents)
- **Location:** `convex/sessions.ts:617-642` (inline) vs `convex/lib/cascadeDelete.ts` (utility)
- **Pre-existing issue:** Not introduced by PR #70
- **Key difference:** `cascadeDelete.ts` defaults to deleting audit logs; `deleteSession` preserves them

## Proposed Solutions

### Option 1: Extract shared helper function (Recommended)
Create a plain async function (not a mutation) that both can call:
```typescript
// convex/lib/cascadeDelete.ts
export async function cascadeDeleteSessionRecords(ctx, sessionId) { ... }
```
- **Pros**: Single source of truth, both callers share logic, stays in same transaction
- **Cons**: Minor refactor of existing code
- **Effort**: Small (30 min)
- **Risk**: Low

### Option 2: Remove cascadeDelete.ts
Delete the unused utility and keep only the inline version.
- **Pros**: Eliminates dead code, simplest approach
- **Cons**: Loses the configurable `preserveAuditLogs` option
- **Effort**: Small (15 min)
- **Risk**: Low

### Option 3: Have deleteSession delegate to internal mutation
- **Pros**: DRY
- **Cons**: Creates separate transaction (breaks atomicity with guard check)
- **Effort**: Small
- **Risk**: Medium (transaction boundary concern)

## Recommended Action

Go with Option 1: Extract a shared `cascadeDeleteSessionRecords` helper function that both `deleteSession` and `deleteSessionWithCascade` call.

## Technical Details

- **Affected Files**: `convex/sessions.ts`, `convex/lib/cascadeDelete.ts`, `convex/cascadeDelete.test.ts`
- **Related Components**: Session lifecycle, deletion cleanup
- **Database Changes**: None

## Acceptance Criteria

- [ ] Single cascade delete implementation used by all callers
- [ ] Audit log preservation behavior maintained for `deleteSession`
- [ ] All existing tests pass
- [ ] No dead code remains

## Work Log

### 2026-02-17 - Identified during PR #70 review
**By:** Code Review (7-agent parallel review)
**Actions:**
- Pre-existing technical debt flagged by 4 of 7 agents
- Two parallel implementations with diverging behavior

### 2026-02-17 - Approved for Work
**By:** Triage (approve all)
**Actions:**
- Status changed from pending to ready
- Recommended Option 1: Extract shared helper function

## Resources

- PR #70: https://github.com/Esk3tit/wtcs-map-vote/pull/70
- Inline cascade: `convex/sessions.ts:617-642`
- Utility: `convex/lib/cascadeDelete.ts`
