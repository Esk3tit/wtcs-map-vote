---
status: complete
priority: p2
issue_id: "036"
tags: [code-review, typescript, api-design]
dependencies: ["035"]
---

# Refactor `transitionSession` to use options object instead of 8 positional params

## Problem Statement
`transitionSession` has 8 parameters (5 required, 3 optional). Positional parameters are hard to read at call sites, easy to misorder, and difficult to extend. This function will be called by 8+ downstream mutations, so the API should be clean.

## Findings
- Location: `convex/lib/sessionLifecycle.ts:130-139`
- Flagged by 2/6 review agents (Simplicity, TypeScript)
- Current call pattern makes it hard to distinguish `actorType` from `actorId` from `patches` at a glance
- The existing `logAction` helper already uses an options object pattern (`LogActionArgs`)

## Proposed Solutions

### Option 1: Bundle last 5 params into `TransitionOptions` interface
- **Pros**: Self-documenting call sites, easier to extend, matches `LogActionArgs` pattern
- **Cons**: Slightly more verbose type definition
- **Effort**: Small
- **Risk**: Low

```typescript
interface TransitionOptions {
  auditAction: AuditAction;
  actorType: ActorType;
  actorId?: string;
  patches?: SessionStatePatches;
  auditDetails?: AuditDetails;
}

export async function transitionSession(
  ctx: MutationCtx,
  session: Doc<"sessions">,
  targetStatus: SessionStatus,
  options: TransitionOptions
): Promise<void>
```

## Recommended Action
Implement Option 1. Keep `ctx`, `session`, and `targetStatus` as positional (always required, always obvious), bundle the rest.

## Technical Details
- **Affected Files**: `convex/lib/sessionLifecycle.ts`, `convex/sessionLifecycle.test.ts`
- **Related Components**: All Phase 5 lifecycle mutations (WAR-38+)
- **Database Changes**: No

## Resources
- PR #59 code review
- Pattern reference: `convex/audit.ts:50-56` (`LogActionArgs` interface)

## Acceptance Criteria
- [ ] `TransitionOptions` interface created and exported
- [ ] `transitionSession` signature updated to 4 params
- [ ] All test call sites updated
- [ ] `bun run typecheck && bun run test` passes

## Work Log

### 2026-02-11 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session (auto-approved)
- Depends on #035 (narrow patches type feeds into options interface)

**Learnings:**
- Matches existing `LogActionArgs` pattern in `audit.ts`

## Notes
Source: PR #59 code review triage on 2026-02-11
