---
status: complete
priority: p2
issue_id: "035"
tags: [code-review, typescript, type-safety, architecture]
dependencies: []
---

# Narrow `patches` parameter from `Partial<Doc<"sessions">>` to allowed fields

## Problem Statement
`transitionSession` accepts `Partial<Doc<"sessions">>` for its `patches` parameter, allowing callers to accidentally overwrite protected fields like `createdBy`, `format`, `status`, `expiresAt`, or `matchName`. The type system should catch these mistakes at compile time.

## Findings
- Location: `convex/lib/sessionLifecycle.ts:137`
- Flagged by 3/6 review agents (Architecture, Security, TypeScript)
- The `status` field in patches could theoretically override the explicit `targetStatus` parameter via object spread
- Protected config fields (`format`, `playerCount`, `mapPoolSize`, `turnTimerSeconds`) should never be patched during transitions

## Proposed Solutions

### Option 1: Create `SessionStatePatches` type with `Pick`
- **Pros**: Type-safe at compile time, self-documenting allowed fields, no runtime cost
- **Cons**: Must be updated when new patchable fields are added
- **Effort**: Small
- **Risk**: Low

```typescript
type SessionStatePatches = Partial<Pick<Doc<"sessions">,
  | "currentTurn" | "currentRound" | "isRevoteRound"
  | "winnerMapId" | "completedAt" | "startedAt"
  | "timerStartedAt" | "timerPausedAt"
>>;
```

## Recommended Action
Implement Option 1. Create the narrow type and export it for downstream mutations.

## Technical Details
- **Affected Files**: `convex/lib/sessionLifecycle.ts`, `convex/sessionLifecycle.test.ts`
- **Related Components**: All Phase 5 lifecycle mutations (WAR-38+)
- **Database Changes**: No

## Resources
- PR #59 code review
- Related: SESSION_RESET_PATCHES already defines the expected patchable fields

## Acceptance Criteria
- [ ] `SessionStatePatches` type created and exported
- [ ] `transitionSession` signature uses narrow type
- [ ] Attempting to pass `{ createdBy: ... }` or `{ status: ... }` causes TypeScript error
- [ ] All existing tests still pass
- [ ] `bun run typecheck` passes

## Work Log

### 2026-02-11 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session (auto-approved)
- Status: ready
- Highest priority P2 finding from code review

**Learnings:**
- 3 of 6 review agents flagged this independently

## Notes
Source: PR #59 code review triage on 2026-02-11
