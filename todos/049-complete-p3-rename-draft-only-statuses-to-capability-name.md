---
status: complete
priority: p3
issue_id: "049"
tags: [code-review, naming, consistency]
dependencies: []
---

# Rename DRAFT_ONLY_STATUSES to Capability-Based Name

## Problem Statement

`DRAFT_ONLY_STATUSES` encodes its contents ("DRAFT only") rather than its capability, breaking the naming convention established by `EDITABLE_STATUSES`, `DELETABLE_STATUSES`, and `RESETTABLE_STATUSES` which all describe what action is permitted. The name also asserts singleness, creating a future maintenance trap — if the set ever needs a second member, the name becomes misleading without a rename.

## Findings

- **Pattern Recognition Specialist**: Low severity — naming risk for future-proofing
- **Kieran TypeScript Reviewer**: Medium severity — false abstraction
- **Code Simplicity Reviewer**: Noted as debatable

### Evidence

Existing convention uses capability-based names:
- `DELETABLE_STATUSES` — "can delete"
- `EDITABLE_STATUSES` — "can edit"
- `RESETTABLE_STATUSES` — "can reset"
- `DRAFT_ONLY_STATUSES` — describes contents, not capability

## Proposed Solutions

### Option A: Rename to MAP_POOL_STATUSES (Recommended)

```typescript
/** Statuses in which the map pool can be configured. */
export const MAP_POOL_STATUSES: ReadonlySet<SessionStatus> = new Set(["DRAFT"]);
```

**Pros:** Follows capability-based convention; name stays valid if set grows
**Cons:** Requires updating import in sessions.ts
**Effort:** Small (rename + import update)
**Risk:** None

### Option B: Keep current name with intent comment

```typescript
/** Statuses in which the map pool can be set. Currently DRAFT only by design. */
export const DRAFT_ONLY_STATUSES: ReadonlySet<SessionStatus> = new Set(["DRAFT"]);
```

**Pros:** No code changes; intent documented
**Cons:** Naming inconsistency persists
**Effort:** Trivial
**Risk:** None

## Technical Details

**Affected files:**
- `convex/lib/constants.ts` — constant declaration (~line 86)
- `convex/sessions.ts` — import and usage (~lines 33, 757)

## Acceptance Criteria

- [ ] Constant follows capability-based naming or has intent comment
- [ ] All tests pass
- [ ] Typecheck passes

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-18 | Created from PR #72 code review | Multiple agents flagged naming convention mismatch |
| 2026-02-18 | Approved for work during triage | Batch-approved with all PR #72 findings |

## Resources

- PR #72: https://github.com/Esk3tit/wtcs-map-vote/pull/72
