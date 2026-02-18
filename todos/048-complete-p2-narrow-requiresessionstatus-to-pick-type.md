---
status: complete
priority: p2
issue_id: "048"
tags: [code-review, typescript, type-safety]
dependencies: []
---

# Narrow requireSessionStatus Parameter to Pick<Doc<"sessions">, "status">

## Problem Statement

`requireSessionStatus()` accepts `Doc<"sessions">` (the full session document) but only accesses `session.status`. This couples every callsite to having a fully-hydrated document even though the contract does not need it. Additionally, the test file requires an awkward `as import(...)` cast to create stub sessions.

## Findings

- **Kieran TypeScript Reviewer**: Severity Medium — "The `Pick` change is the one I would push on before merge"
- **Pattern Recognition Specialist**: Noted the test cast as a symptom

### Evidence

```typescript
// convex/lib/sessionLifecycle.ts:130 — current signature
export function requireSessionStatus(
  session: Doc<"sessions">,  // <-- only uses .status
  allowed: ReadonlySet<SessionStatus>,
  action: string
): void {
  if (!allowed.has(session.status)) {  // <-- only field accessed
```

```typescript
// convex/sessionLifecycle.test.ts:752-753 — awkward cast required
const stubSession = (status: SessionStatus) =>
  ({ status }) as import("./_generated/dataModel").Doc<"sessions">;
```

## Proposed Solutions

### Option A: Use Pick (Recommended)

```typescript
export function requireSessionStatus(
  session: Pick<Doc<"sessions">, "status">,
  allowed: ReadonlySet<SessionStatus>,
  action: string
): void {
```

**Pros:** Contract is honest; all existing callsites pass full Doc (structurally compatible, zero changes); test stub simplifies to `({ status })` with no cast; future callers that query only status field work without changes
**Cons:** None identified
**Effort:** Small (10 minutes — signature change + test cleanup)
**Risk:** None — Pick is a structural subtype of Doc

### Option B: Keep Doc<"sessions">

Keep current signature for consistency with `guardFinalize`/`guardStart`.

**Pros:** Uniform signatures across all guards
**Cons:** `guardFinalize`/`guardStart` actually use `session._id`, `session.playerCount`, etc. — they genuinely need the full doc. `requireSessionStatus` does not.
**Effort:** None
**Risk:** None

## Technical Details

**Affected files:**
- `convex/lib/sessionLifecycle.ts` — function signature (~line 130)
- `convex/sessionLifecycle.test.ts` — stub factory (~line 752), remove `as` cast

## Acceptance Criteria

- [ ] `requireSessionStatus` accepts `Pick<Doc<"sessions">, "status">`
- [ ] Test stub no longer requires `as import(...)` cast
- [ ] All existing tests pass
- [ ] Typecheck passes

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-18 | Created from PR #72 code review | TypeScript reviewer identified as top priority fix |
| 2026-02-18 | Approved for work during triage | Batch-approved with all PR #72 findings |

## Resources

- PR #72: https://github.com/Esk3tit/wtcs-map-vote/pull/72
